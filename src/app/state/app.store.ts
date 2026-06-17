import { computed, inject, Injectable, signal } from '@angular/core';
import { DEFAULT_METHOD, DEFAULT_POINT, FishingMethod, METHODS } from '../core/config';
import { computeTrends, forwardSeries } from '../core/pressure.util';
import { evaluateBite } from '../core/bite.util';
import { GeoService } from '../core/geo.service';
import { WeatherService } from '../core/weather.service';
import { SpotsService } from '../core/spots.service';
import { FishingSpot, GeoPoint, WeatherData } from '../core/types';

type Status = 'idle' | 'loading' | 'error';

@Injectable({ providedIn: 'root' })
export class AppStore {
  private weatherApi = inject(WeatherService);
  private geo = inject(GeoService);
  private spotsApi = inject(SpotsService);

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
    return this.select(ip ?? DEFAULT_POINT, !!ip);
  }

  async useGPS(): Promise<void> {
    try {
      await this.select(await this.geo.getByGPS(), true);
    } catch {
      /* пользователь не дал разрешение — остаёмся на текущей точке */
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
    } catch {
      this.status.set('error');
    }
  }

  async refresh(): Promise<void> {
    this.status.set('loading');
    try {
      this.weather.set(await this.weatherApi.load(this.point(), true));
      this.status.set('idle');
    } catch {
      this.status.set('error');
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
    } catch {
      this.spots.set([]);
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
