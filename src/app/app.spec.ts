import { hpaToMmHg, computeTrends } from './core/pressure.util';
import { pressureScore } from './core/forecast.util';
import { evaluateBite } from './core/bite.util';
import { moonInfo } from './core/moon.util';
import { METHODS } from './core/config';
import { BiteInput } from './core/types';

const FLOAT = METHODS.find((m) => m.id === 'float')!;
const SPIN = METHODS.find((m) => m.id === 'spinning')!;

describe('Давление', () => {
  it('переводит гПа в мм рт. ст.', () => {
    expect(hpaToMmHg(1013)).toBeCloseTo(759.8, 1);
  });

  it('стабильное давление — приличная под-оценка', () => {
    const series = Array.from({ length: 37 }, () => 748);
    const t = computeTrends(series, [], 24);
    expect(pressureScore(t)).toBeGreaterThanOrEqual(70);
  });

  it('резкий рост давления — низкая под-оценка', () => {
    const series = Array.from({ length: 37 }, (_, i) => 740 + i * 0.5);
    const t = computeTrends(series, [], 24);
    expect(pressureScore(t)).toBeLessThan(45);
  });

  it('плавное падение перед фронтом — максимум', () => {
    const series = Array.from({ length: 37 }, (_, i) => 752 - i * 0.1);
    const t = computeTrends(series, [], 24);
    expect(pressureScore(t)).toBeGreaterThanOrEqual(85);
  });
});

describe('Луна', () => {
  it('освещённость в пределах 0..1', () => {
    const m = moonInfo(Date.UTC(2024, 0, 25, 12));
    expect(m.illumination).toBeGreaterThanOrEqual(0);
    expect(m.illumination).toBeLessThanOrEqual(1);
  });
});

describe('Мультифакторный клёв', () => {
  const base = (over: Partial<BiteInput>): BiteInput => ({
    trends: computeTrends(Array.from({ length: 37 }, () => 748), [], 24),
    tempC: 18,
    windMs: 3,
    cloud: 50,
    precip: 0,
    nowMs: Date.UTC(2024, 5, 1, 12, 30),
    sunriseMs: NaN,
    sunsetMs: NaN,
    ...over,
  });

  it('возвращает 6 факторов и балл 0..100', () => {
    const v = evaluateBite(base({}), FLOAT);
    expect(v.factors).toHaveLength(6);
    expect(v.score).toBeGreaterThanOrEqual(0);
    expect(v.score).toBeLessThanOrEqual(100);
  });

  it('зорька поднимает оценку выше глухого полудня', () => {
    const sunrise = Date.UTC(2024, 5, 1, 4, 0);
    const sunset = Date.UTC(2024, 5, 1, 21, 0);
    const dawn = evaluateBite(base({ nowMs: sunrise, sunriseMs: sunrise, sunsetMs: sunset }), FLOAT);
    const noon = evaluateBite(
      base({ nowMs: Date.UTC(2024, 5, 1, 12, 30), sunriseMs: sunrise, sunsetMs: sunset }),
      FLOAT,
    );
    expect(dawn.score).toBeGreaterThan(noon.score);
  });

  it('шторм и резкое давление дают слабый клёв', () => {
    const sharp = computeTrends(Array.from({ length: 37 }, (_, i) => 740 + i * 0.5), [], 24);
    const v = evaluateBite(base({ trends: sharp, windMs: 16, precip: 8 }), FLOAT);
    expect(v.level).toBe('bad');
  });

  it('в сильный ветер спиннинг оценивается выше поплавка', () => {
    const input = base({ windMs: 7 });
    expect(evaluateBite(input, SPIN).score).toBeGreaterThan(evaluateBite(input, FLOAT).score);
  });

  it('в ясную погоду по хищнику небо тянет ниже, чем по мирной рыбе', () => {
    const input = base({ cloud: 5, precip: 0 });
    const spinSky = evaluateBite(input, SPIN).factors.find((f) => f.key === 'sky')!;
    const floatSky = evaluateBite(input, FLOAT).factors.find((f) => f.key === 'sky')!;
    expect(spinSky.score).toBeLessThan(floatSky.score);
  });
});
