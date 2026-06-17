// Перевод гектопаскалей в мм рт. ст.
export const HPA_TO_MMHG = 0.750062;

// Кэш погоды: давление меняется почасово, держим час
export const CACHE_TTL_MS = 60 * 60 * 1000;

// Точка по умолчанию, если ничего не определилось
export const DEFAULT_POINT = { lat: 55.75, lon: 37.62, name: 'Москва' };

// Открытые API без ключа (CORS включён)
export const API = {
  forecast: 'https://api.open-meteo.com/v1/forecast',
  geocode: 'https://geocoding-api.open-meteo.com/v1/search',
  reverse: 'https://api-bdc.net/data/reverse-geocode-client',
  ipGeojs: 'https://get.geojs.io/v1/ip/geo.json',
  ipWhois: 'https://ipwho.is/',
};

// Пороги вердикта по баллам (0..100)
export const LEVEL_THRESHOLDS = { good: 68, mid: 48 };

// Способ ловли. Меняет веса факторов и кривые по ветру/небу:
// поплавок боится ветра, фидеру он не мешает, спиннингу рябь и облачность в плюс.
export type FishingMethod = 'float' | 'feeder' | 'spinning';

export interface MethodWeights {
  pressure: number;
  time: number;
  wind: number;
  temp: number;
  moon: number;
  sky: number;
}

export interface MethodProfile {
  id: FishingMethod;
  label: string; // полное название
  short: string; // для кнопки
  icon: string;  // иконка Tabler
  weights: MethodWeights; // в сумме 1.0
}

export const METHODS: MethodProfile[] = [
  {
    id: 'float',
    label: 'Поплавочная удочка',
    short: 'Поплавок',
    icon: 'ti-fish-hook',
    weights: { pressure: 0.32, time: 0.25, wind: 0.15, temp: 0.08, moon: 0.08, sky: 0.12 },
  },
  {
    id: 'feeder',
    label: 'Фидер',
    short: 'Фидер',
    icon: 'ti-basket',
    weights: { pressure: 0.38, time: 0.14, wind: 0.1, temp: 0.12, moon: 0.06, sky: 0.2 },
  },
  {
    id: 'spinning',
    label: 'Спиннинг',
    short: 'Спиннинг',
    icon: 'ti-bolt',
    weights: { pressure: 0.4, time: 0.17, wind: 0.15, temp: 0.06, moon: 0.06, sky: 0.16 },
  },
];

export const DEFAULT_METHOD: FishingMethod = 'float';
