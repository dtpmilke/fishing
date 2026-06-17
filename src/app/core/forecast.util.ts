import { PressureTrends } from './types';

/**
 * Под-оценка клёва по давлению (0..100) — база мультифакторной модели.
 * Ключевое — направление и стабильность тренда, а не абсолютное значение.
 * Калибровка: ровный день ≈ 77, плавное падение перед фронтом → ~100,
 * резкий скачок/рост → < 45.
 */
export function pressureScore(t: PressureTrends): number {
  let s = 55;

  // 1. Тренд за сутки
  if (t.delta24 <= -0.7 && t.delta24 >= -3) s += 30; // плавное падение — жор
  else if (Math.abs(t.delta24) <= 0.7) s += 8;       // стабильно — ровно, но не «жор»
  else if (t.delta24 > 0.7 && t.delta24 <= 3) s -= 8; // плавный рост
  else s -= 30;                                       // резкий скачок (|Δ|>3)

  // 2. Стабильность (нет почасовых рывков)
  if (t.maxStep <= 0.6) s += 14;
  else if (t.maxStep <= 1.2) s += 4;
  else if (t.maxStep <= 2) s -= 8;
  else s -= 20;

  // 3. Прогнозный тренд на 12 ч
  if (t.deltaFwd <= -0.3 && t.deltaFwd >= -2.5) s += 8; // продолжает плавно падать
  else if (t.deltaFwd > 3 || t.deltaFwd < -4) s -= 10;  // ожидается рывок

  return Math.max(0, Math.min(100, s));
}

/** Короткое описание поведения давления для разбора по факторам. */
export function pressureDetail(t: PressureTrends): string {
  if (t.maxStep > 2 || Math.abs(t.delta24) > 3) return 'скачет';
  if (t.delta24 <= -0.7) return 'плавно падает';
  if (t.delta24 >= 0.7) return 'растёт';
  return 'стабильно';
}
