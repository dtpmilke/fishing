export interface GeoPoint {
  lat: number;
  lon: number;
  name?: string;
}

export interface CurrentWeather {
  time: string;
  pressureMmHg: number;     // surface_pressure → мм рт. ст.
  pressureMslMmHg: number;  // pressure_msl → мм рт. ст.
  tempC: number;
  windMs: number;
  cloud: number;            // облачность, %
  precip: number;           // осадки, мм/ч
}

export interface SunTimes {
  sunrise: string; // локальное ISO время восхода (сегодня)
  sunset: string;  // локальное ISO время заката (сегодня)
}

export interface WeatherData {
  point: GeoPoint;
  fetchedAt: number;
  current: CurrentWeather;
  series: { time: string[]; mmHg: number[] }; // surface_pressure, почасово
  sun: SunTimes;
  nowIndex: number;
}

export interface ForecastPoint {
  time: string; // локальное ISO-время из Open-Meteo
  mmHg: number;
}

export interface PressureTrends {
  now: number;
  delta24: number;   // изменение за 24 ч
  maxStep: number;   // макс. почасовой скачок за сутки
  deltaFwd: number;  // прогнозный тренд на 12 ч
  past: number[];
  fwd: number[];
}

export type BiteLevel = 'good' | 'mid' | 'bad';

/** Вклад одного фактора в итоговую оценку клёва. */
export interface BiteFactor {
  key: 'pressure' | 'time' | 'wind' | 'temp' | 'moon' | 'sky';
  icon: string;   // имя иконки Tabler
  label: string;  // «Давление»
  detail: string; // «плавно падает»
  score: number;  // 0..100
  level: BiteLevel;
}

/** Входные данные мультифакторной модели клёва. */
export interface BiteInput {
  trends: PressureTrends;
  tempC: number;
  windMs: number;
  cloud: number;
  precip: number;
  nowMs: number;     // текущее время, мс
  sunriseMs: number; // восход, мс (NaN если нет данных)
  sunsetMs: number;  // закат, мс
}

export interface Verdict {
  score: number;
  level: BiteLevel;
  label: string;
  hint: string;
  factors: BiteFactor[];
}

export type SpotKind = 'fishing' | 'water' | 'river';

export interface FishingSpot {
  lat: number;
  lon: number;
  name: string;
  kind: SpotKind;
}
