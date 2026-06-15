import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API, CACHE_TTL_MS } from './config';
import { hpaToMmHg } from './pressure.util';
import { GeoPoint, WeatherData } from './types';

@Injectable({ providedIn: 'root' })
export class WeatherService {
  private http = inject(HttpClient);

  /** Грузит погоду для точки. Использует часовой кэш в localStorage. */
  async load(point: GeoPoint, force = false): Promise<WeatherData> {
    const key = this.cacheKey(point);
    if (!force) {
      const cached = this.readCache(key);
      if (cached) return cached;
    }

    const params = new HttpParams({
      fromObject: {
        latitude: point.lat,
        longitude: point.lon,
        hourly: 'surface_pressure',
        current: 'surface_pressure,pressure_msl,temperature_2m,wind_speed_10m',
        wind_speed_unit: 'ms',
        past_days: 2,
        forecast_days: 2,
        timezone: 'auto',
      },
    });

    const raw = await firstValueFrom(this.http.get<any>(API.forecast, { params }));
    const data = this.parse(point, raw);
    this.writeCache(key, data);
    return data;
  }

  private parse(point: GeoPoint, j: any): WeatherData {
    const times: string[] = j.hourly.time;
    const mmHg: number[] = (j.hourly.surface_pressure as number[]).map(hpaToMmHg);
    const nowTime: string = j.current.time;

    let nowIndex = times.indexOf(nowTime);
    if (nowIndex < 0) {
      const tnow = new Date(nowTime).getTime();
      nowIndex = times.reduce(
        (best, t, i) =>
          Math.abs(new Date(t).getTime() - tnow) <
          Math.abs(new Date(times[best]).getTime() - tnow)
            ? i
            : best,
        0,
      );
    }

    return {
      point,
      fetchedAt: Date.now(),
      current: {
        time: nowTime,
        pressureMmHg: hpaToMmHg(j.current.surface_pressure),
        pressureMslMmHg: hpaToMmHg(j.current.pressure_msl),
        tempC: Math.round(j.current.temperature_2m),
        windMs: Math.round(j.current.wind_speed_10m),
      },
      series: { time: times, mmHg },
      nowIndex,
    };
  }

  private cacheKey(p: GeoPoint): string {
    const hour = new Date().toISOString().slice(0, 13);
    return `wx:${p.lat.toFixed(2)}:${p.lon.toFixed(2)}:${hour}`;
  }

  private readCache(key: string): WeatherData | null {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const d = JSON.parse(raw) as WeatherData;
      return Date.now() - d.fetchedAt > CACHE_TTL_MS ? null : d;
    } catch {
      return null;
    }
  }

  private writeCache(key: string, data: WeatherData): void {
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch {
      /* квота переполнена — не критично */
    }
  }
}
