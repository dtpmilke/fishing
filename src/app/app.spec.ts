import { hpaToMmHg, computeTrends } from './core/pressure.util';
import { biteScore, interpret } from './core/forecast.util';

describe('Логика давления и клёва', () => {
  it('переводит гПа в мм рт. ст.', () => {
    expect(hpaToMmHg(1013)).toBeCloseTo(759.8, 1);
  });

  it('стабильное давление → хороший клёв', () => {
    const series = Array.from({ length: 37 }, () => 748);
    const t = computeTrends(series, [], 24);
    expect(biteScore(t)).toBeGreaterThanOrEqual(70);
    expect(interpret(t).level).toBe('good');
  });

  it('резкий скачок давления → слабый клёв', () => {
    const series = Array.from({ length: 37 }, (_, i) => 740 + i * 0.5);
    const t = computeTrends(series, [], 24);
    expect(biteScore(t)).toBeLessThan(45);
    expect(interpret(t).level).toBe('bad');
  });
});
