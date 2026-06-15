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
export const SCORE_THRESHOLDS = { good: 70, mid: 45 };
