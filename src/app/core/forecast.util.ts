import { SCORE_THRESHOLDS } from './config';
import { BiteLevel, PressureTrends, Verdict } from './types';

/**
 * Балльная оценка клёва (0..100) по давлению.
 * Ключевое — стабильность и направление тренда, а не абсолютное значение.
 */
export function biteScore(t: PressureTrends): number {
  let s = 50;

  // 1. Тренд за сутки
  if (Math.abs(t.delta24) <= 1) s += 25;           // стабильно
  else if (t.delta24 < 0 && t.delta24 >= -3) s += 30; // плавное падение — жор
  else if (t.delta24 > 0 && t.delta24 <= 3) s += 10;  // плавный рост
  else s -= 20;                                     // резкий скачок

  // 2. Стабильность (нет рывков)
  if (t.maxStep <= 0.7) s += 15;
  else if (t.maxStep <= 1.5) s += 5;
  else s -= 15;

  // 3. Прогнозный тренд
  if (t.deltaFwd < 0 && t.deltaFwd >= -2) s += 10;  // начинает падать — хорошо
  else if (Math.abs(t.deltaFwd) > 3) s -= 10;       // ожидается рывок

  return Math.max(0, Math.min(100, s));
}

export function interpret(t: PressureTrends): Verdict {
  const score = biteScore(t);
  const level: BiteLevel =
    score >= SCORE_THRESHOLDS.good ? 'good'
    : score >= SCORE_THRESHOLDS.mid ? 'mid'
    : 'bad';

  const label =
    level === 'good' ? 'Отличный клёв'
    : level === 'mid' ? 'Средний клёв'
    : 'Слабый клёв';

  return { score, level, label, hint: buildHint(t) };
}

function buildHint(t: PressureTrends): string {
  if (t.maxStep > 1.5 || Math.abs(t.delta24) > 3)
    return 'Давление скачет — рыба пассивна, поклёвки редкие.';
  if (t.delta24 < 0 && t.delta24 >= -3)
    return 'Давление плавно падает — рыба активна, хорошее время для рыбалки.';
  if (Math.abs(t.delta24) <= 1)
    return 'Давление стабильное — ровный, предсказуемый клёв.';
  if (t.delta24 > 0)
    return 'Давление растёт — клёв возможен, но осторожный.';
  return 'Условия средние, стоит попробовать.';
}
