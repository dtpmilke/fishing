import { HPA_TO_MMHG } from './config';
import { ForecastPoint, PressureTrends } from './types';

/** Гектопаскали → мм рт. ст., округление до 0.1 */
export const hpaToMmHg = (hpa: number): number =>
  Math.round(hpa * HPA_TO_MMHG * 10) / 10;

const r1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Считает тренды давления вокруг текущего часа:
 * изменение за сутки, максимальный почасовой скачок и прогноз на 12 ч.
 */
export function computeTrends(
  mmHg: number[],
  _times: string[],
  nowIndex: number,
): PressureTrends {
  const start = Math.max(0, nowIndex - 24);
  const past = mmHg.slice(start, nowIndex + 1);
  const now = mmHg[nowIndex];
  const delta24 = r1(now - mmHg[start]);

  let maxStep = 0;
  for (let i = start + 1; i <= nowIndex; i++) {
    maxStep = Math.max(maxStep, Math.abs(mmHg[i] - mmHg[i - 1]));
  }

  const fwdEnd = Math.min(mmHg.length - 1, nowIndex + 12);
  const fwd = mmHg.slice(nowIndex, fwdEnd + 1);
  const deltaFwd = r1(mmHg[fwdEnd] - now);

  return { now: r1(now), delta24, maxStep: r1(maxStep), deltaFwd, past, fwd };
}

/**
 * Прогноз давления вперёд от текущего часа (по умолчанию 48 ч).
 * Возвращает почасовые точки начиная с «сейчас».
 */
export function forwardSeries(
  mmHg: number[],
  times: string[],
  nowIndex: number,
  hours = 48,
): ForecastPoint[] {
  const end = Math.min(mmHg.length - 1, nowIndex + hours);
  const out: ForecastPoint[] = [];
  for (let i = nowIndex; i <= end; i++) {
    out.push({ time: times[i], mmHg: mmHg[i] });
  }
  return out;
}
