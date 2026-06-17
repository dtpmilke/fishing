import { computed, inject, Injectable, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { DEFAULT_METHOD, DEFAULT_POINT, FishingMethod, METHODS } from '../core/config';
import { computeTrends, forwardSeries } from '../core/pressure.util';
import { evaluateBite } from '../core/bite.util';
import { GeoService } from '../core/geo.service';
import { WeatherService } from '../core/weather.service';
import { SpotsService } from '../core/spots.service';
import { ToastService } from '../core/toast.service';
import { FishingSpot, GeoPoint, WeatherData } from '../core/types';

type Status = 'idle' | 'loading' | 'error';

@Injectable({ providedIn: 'root' })
export class AppStore {
  private weatherApi = inject(WeatherService);
  private geo = inject(GeoService);
  private spotsApi = inject(SpotsService);
  private toast = inject(ToastService);

  readonly point = signal<GeoPoint>(DEFAULT_POINT);
  readonly placeName = signal<string>(DEFAULT_POINT.name ?? '');
  readonly weather = signal<WeatherData | null>(null);
  readonly status = signal<Status>('idle');
  readonly favorites = signal<GeoPoint[]>(this.read('favs', []));

  // рыбные места рядом (Overpass)
  readonly spots = signal<FishingSpot[]>([]);
  readonly spotsLoading = signal(false);

  // способ ловли (влияет на прогноз)
  readonly methods = METHODS;
  readonly method = signal<FishingMethod>(this.read('method', DEFAULT_METHOD));
  readonly methodProfile = computed(
    () => METHODS.find((m) => m.id === this.method()) ?? METHODS[0],
  );

  readonly trends = computed(() => {
    const w = this.weather();
    return w ? computeTrends(w.series.mmHg, w.series.time, w.nowIndex) : null;
  });

  readonly verdict = computed(() => {
    const w = this.weather();
    const t = this.trends();
    if (!w || !t) return null;
    return evaluateBite({
      trends: t,
      tempC: w.current.tempC,
      windMs: w.current.windMs,
      cloud: w.current.cloud,
      precip: w.current.precip,
      nowMs: Date.parse(w.current.time),
      sunriseMs: Date.parse(w.sun?.sunrise ?? ''),
      sunsetMs: Date.parse(w.sun?.sunset ?? ''),
    }, this.methodProfile());
  });

  // Прогноз давления на 48 ч вперёд (почасово)
  readonly forecast = computed(() => {
    const w = this.weather();
    return w ? forwardSeries(w.series.mmHg, w.series.time, w.nowIndex) : null;
  });

  readonly isFavorite = computed(() => {
    const p = this.point();
    return this.favorites().some((f) => f.lat === p.lat && f.lon === p.lon);
  });

  /** Стартовый каскад: последняя точка → IP → дефолт. */
  async init(): Promise<void> {
    const last = this.read<GeoPoint | null>('lastPoint', null);
    if (last) return this.select(last, false);

    const ip = await this.geo.getByIP();
    if (!ip) this.toast.warn('Не удалось определить город по IP — используем Москву');
    return this.select(ip ?? DEFAULT_POINT, !!ip);
  }

  async useGPS(): Promise<void> {
    try {
      await this.select(await this.geo.getByGPS(), true);
    } catch (e: any) {
      const msg = e?.code === 1
        ? 'Нет доступа к геолокации — разрешите в настройках браузера'
        : e?.code === 3
          ? 'Геолокация не ответила вовремя'
          : 'Не удалось получить координаты GPS';
      this.toast.warn(msg);
    }
  }

  /** Выбор точки + загрузка погоды (+ обратный геокодинг названия). */
  async select(p: GeoPoint, reverse = true): Promise<void> {
    this.point.set(p);
    this.status.set('loading');
    if (p.name) this.placeName.set(p.name);

    try {
      const [w, name] = await Promise.all([
        this.weatherApi.load(p),
        reverse && !p.name
          ? this.geo.reverse(p.lat, p.lon)
          : Promise.resolve(p.name ?? this.placeName()),
      ]);
      this.weather.set(w);
      if (name) this.placeName.set(name);
      this.status.set('idle');
      this.write('lastPoint', { ...p, name: this.placeName() });
    } catch (e: any) {
      this.status.set('error');
      // HttpErrorResponse уже показан interceptor'ом — не дублируем
      if (!(e instanceof HttpErrorResponse)) {
        const isTimeout = e?.name === 'TimeoutError';
        this.toast.error(isTimeout
          ? 'Сервер погоды не ответил — проверьте соединение'
          : 'Не удалось загрузить погоду');
      }
    }
  }

  async refresh(): Promise<void> {
    this.status.set('loading');
    try {
      this.weather.set(await this.weatherApi.load(this.point(), true));
      this.status.set('idle');
    } catch (e: any) {
      this.status.set('error');
      if (!(e instanceof HttpErrorResponse)) {
        const isTimeout = e?.name === 'TimeoutError';
        this.toast.error(isTimeout ? 'Сервер погоды не ответил' : 'Ошибка обновления погоды');
      }
    }
  }

  /** Найти рыбные места рядом с текущей точкой (или скрыть, если уже показаны). */
  async findSpots(): Promise<void> {
    if (this.spots().length) {
      this.spots.set([]);
      return;
    }
    this.spotsLoading.set(true);
    try {
      const p = this.point();
      this.spots.set(await this.spotsApi.findNear(p.lat, p.lon));
      if (!this.spots().length) this.toast.warn('Рыбные места рядом не найдены');
    } catch (e) {
      this.spots.set([]);
      // HttpErrorResponse уже показан interceptor'ом
      if (!(e instanceof HttpErrorResponse)) {
        this.toast.error('Не удалось загрузить рыбные места');
      }
    } finally {
      this.spotsLoading.set(false);
    }
  }

  setMethod(id: FishingMethod): void {
    this.method.set(id);
    this.write('method', id);
  }

  toggleFavorite(): void {
    const p = { ...this.point(), name: this.placeName() };
    const favs = this.favorites();
    const next = this.isFavorite()
      ? favs.filter((f) => !(f.lat === p.lat && f.lon === p.lon))
      : [...favs, p];
    this.favorites.set(next);
    this.write('favs', next);
  }

  private read<T>(key: string, fallback: T): T {
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : fallback;
    } catch {
      return fallback;
    }
  }

  private write(key: string, value: unknown): void {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* игнорируем */
    }
  }
}
