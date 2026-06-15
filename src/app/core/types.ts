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
}

export interface WeatherData {
  point: GeoPoint;
  fetchedAt: number;
  current: CurrentWeather;
  series: { time: string[]; mmHg: number[] }; // surface_pressure, почасово
  nowIndex: number;
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

export interface Verdict {
  score: number;
  level: BiteLevel;
  label: string;
  hint: string;
}

export type SpotKind = 'fishing' | 'water' | 'river';

export interface FishingSpot {
  lat: number;
  lon: number;
  name: string;
  kind: SpotKind;
}
