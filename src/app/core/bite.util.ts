import { FishingMethod, LEVEL_THRESHOLDS, MethodProfile } from './config';
import { pressureDetail, pressureScore } from './forecast.util';
import { moonInfo } from './moon.util';
import { BiteFactor, BiteInput, BiteLevel, Verdict } from './types';

const clamp = (n: number): number => Math.max(0, Math.min(100, n));
const r = (n: number): number => Math.round(n);

const levelOf = (s: number): BiteLevel =>
  s >= LEVEL_THRESHOLDS.good ? 'good' : s >= LEVEL_THRESHOLDS.mid ? 'mid' : 'bad';

type Sub = { score: number; detail: string };

/** Время суток: пик на зорьке (±90 мин у восхода/заката). */
function timeScore(nowMs: number, sunriseMs: number, sunsetMs: number): Sub {
  if (!isFinite(sunriseMs) || !isFinite(sunsetMs)) return { score: 60, detail: '—' };
  const toSr = Math.abs(nowMs - sunriseMs);
  const toSs = Math.abs(nowMs - sunsetMs);
  const dMin = Math.min(toSr, toSs) / 60_000;
  if (dMin <= 90) {
    return {
      score: clamp(100 - (dMin / 90) * 18), // 100 в центре зорьки → 82 на краю окна
      detail: toSr < toSs ? 'утренняя зорька' : 'вечерняя зорька',
    };
  }
  const isDay = nowMs > sunriseMs && nowMs < sunsetMs;
  return isDay ? { score: 58, detail: 'день' } : { score: 50, detail: 'ночь' };
}

/** Ветер: реакция зависит от снасти — поплавок боится, спиннинг любит рябь. */
function windScore(ms: number, method: FishingMethod): Sub {
  let s: number;
  if (method === 'spinning') {
    if (ms <= 1) s = 68;                              // мёртвый штиль — хищник вялый
    else if (ms <= 7) s = 100;                        // «щучий» ветерок
    else if (ms <= 11) s = 100 - ((ms - 7) / 4) * 28; // 100 → 72
    else s = 50;
  } else if (method === 'feeder') {
    if (ms <= 0.5) s = 80;
    else if (ms <= 7) s = 100;                        // тяжёлая кормушка держит дно
    else if (ms <= 11) s = 100 - ((ms - 7) / 4) * 30; // 100 → 70
    else s = 55;
  } else {
    // поплавок — ветер сносит снасть
    if (ms <= 3) s = 100;
    else if (ms <= 5) s = 100 - ((ms - 3) / 2) * 12;  // 100 → 88
    else if (ms <= 8) s = 88 - ((ms - 5) / 3) * 40;   // 88 → 48
    else s = 36;
  }
  const detail = ms <= 0.5 ? 'штиль' : ms <= 5 ? 'лёгкая рябь' : ms <= 8 ? 'умеренный' : 'сильный';
  return { score: clamp(s), detail };
}

/** Температура воздуха как мягкий прокси комфорта (вес небольшой). */
function tempScore(c: number): Sub {
  let s: number;
  if (c >= 10 && c <= 24) s = 100;
  else if (c >= 4 && c < 10) s = 70 + ((c - 4) / 6) * 30;   // 70 → 100
  else if (c > 24 && c <= 30) s = 100 - ((c - 24) / 6) * 45; // 100 → 55
  else if (c >= 0 && c < 4) s = 50 + (c / 4) * 20;           // 50 → 70
  else if (c < 0) s = 45;
  else s = 52; // > 30
  return { score: clamp(s), detail: `${r(c)}°` };
}

/** Луна: новолуние и полнолуние — активнее (солунарная теория). */
function moonScore(phase: number): number {
  const dd = Math.min(phase, Math.abs(phase - 0.5), 1 - phase); // 0..0.25
  return clamp(100 - (dd / 0.25) * 35); // 100 в нов./полн. → 65 в четвертях
}

/** Небо: пасмурно и лёгкий дождь — в плюс. Для хищника облачность критичнее. */
function skyScore(cloud: number, precip: number, method: FishingMethod): Sub {
  if (precip > 5) return { score: method === 'spinning' ? 55 : 48, detail: 'ливень' };
  if (precip >= 0.2) return { score: method === 'spinning' ? 92 : 86, detail: 'дождит' };
  const overcast = method === 'spinning' ? 96 : method === 'feeder' ? 92 : 90;
  const clear = method === 'spinning' ? 60 : method === 'feeder' ? 72 : 76;
  if (cloud >= 60) return { score: overcast, detail: 'облачно' };
  if (cloud <= 20) return { score: clear, detail: 'ясно' };
  return { score: Math.round((overcast + clear) / 2), detail: 'переменно' };
}

/** Мультифакторная оценка клёва с разбором по факторам и с учётом снасти. */
export function evaluateBite(i: BiteInput, profile: MethodProfile): Verdict {
  const m = profile.id;
  const moon = moonInfo(i.nowMs);

  const pScore = pressureScore(i.trends);
  const time = timeScore(i.nowMs, i.sunriseMs, i.sunsetMs);
  const wind = windScore(i.windMs, m);
  const temp = tempScore(i.tempC);
  const mScore = moonScore(moon.phase);
  const sky = skyScore(i.cloud, i.precip, m);

  const factors: BiteFactor[] = [
    factor('pressure', 'ti-gauge', 'Давление', pressureDetail(i.trends), pScore),
    factor('time', 'ti-sun', 'Время', time.detail, time.score),
    factor('wind', 'ti-wind', 'Ветер', wind.detail, wind.score),
    factor('temp', 'ti-temperature', 'Температура', temp.detail, temp.score),
    factor('moon', 'ti-moon', 'Луна', moon.name, mScore),
    factor('sky', 'ti-cloud', 'Небо', sky.detail, sky.score),
  ];

  const W = profile.weights;
  const weighted =
    pScore * W.pressure +
    time.score * W.time +
    wind.score * W.wind +
    temp.score * W.temp +
    mScore * W.moon +
    sky.score * W.sky;

  // Подтягивание к худшему фактору: один «убийственный» фактор (шторм, резкое
  // давление) должен ощутимо ронять итог, а не растворяться в среднем.
  const worst = Math.min(pScore, time.score, wind.score, temp.score, mScore, sky.score);
  const total = r(0.8 * weighted + 0.2 * worst);

  const level = levelOf(total);
  return {
    score: total,
    level,
    label: level === 'good' ? 'Отличный клёв' : level === 'mid' ? 'Средний клёв' : 'Слабый клёв',
    hint: buildHint(factors),
    factors,
  };
}

function factor(
  key: BiteFactor['key'],
  icon: string,
  label: string,
  detail: string,
  score: number,
): BiteFactor {
  const s = clamp(r(score));
  return { key, icon, label, detail, score: s, level: levelOf(s) };
}

/** Подсказка: называет главный плюс или, если что-то тормозит, главный минус. */
function buildHint(factors: BiteFactor[]): string {
  const top = factors.reduce((a, b) => (b.score > a.score ? b : a));
  const low = factors.reduce((a, b) => (b.score < a.score ? b : a));

  if (low.score < 45) return `${LIMITER[low.key]} — это сдерживает клёв.`;
  if (top.score >= 80) return `${DRIVER[top.key]} — хорошее время для рыбалки.`;
  return 'Условия средние — стоит попробовать, поклёвки возможны.';
}

const DRIVER: Record<BiteFactor['key'], string> = {
  pressure: 'Давление плавно падает, рыба активна',
  time: 'Зорька — пик клёва',
  wind: 'Лёгкая рябь по воде',
  temp: 'Комфортная температура',
  moon: 'Фаза луны располагает к жору',
  sky: 'Пасмурно — рыба смелее',
};

const LIMITER: Record<BiteFactor['key'], string> = {
  pressure: 'Давление скачет, рыба пассивна',
  time: 'Глухое время суток',
  wind: 'Слишком сильный ветер',
  temp: 'Некомфортная температура воды',
  moon: 'Луна в четверти',
  sky: 'Ливень',
};
