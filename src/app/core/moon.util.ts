export interface MoonInfo {
  phase: number;        // 0..1 (0 — новолуние, 0.5 — полнолуние)
  illumination: number; // 0..1 доля освещённого диска
  name: string;
}

// Средний синодический месяц и опорное новолуние (2000-01-06 18:14 UTC).
const SYNODIC = 29.530588853;
const NEW_MOON_REF = Date.UTC(2000, 0, 6, 18, 14, 0);

/** Фаза и освещённость Луны на момент времени (клиентский расчёт, без API). */
export function moonInfo(nowMs = Date.now()): MoonInfo {
  if (!isFinite(nowMs)) nowMs = Date.now();
  const days = (nowMs - NEW_MOON_REF) / 86_400_000;
  let phase = (days % SYNODIC) / SYNODIC;
  if (phase < 0) phase += 1;
  const illumination = (1 - Math.cos(2 * Math.PI * phase)) / 2;
  return { phase, illumination, name: moonName(phase) };
}

function moonName(p: number): string {
  if (p < 0.03 || p > 0.97) return 'Новолуние';
  if (p < 0.22) return 'Растущий месяц';
  if (p < 0.28) return 'Первая четверть';
  if (p < 0.47) return 'Растущая луна';
  if (p < 0.53) return 'Полнолуние';
  if (p < 0.72) return 'Убывающая луна';
  if (p < 0.78) return 'Последняя четверть';
  return 'Старый месяц';
}
