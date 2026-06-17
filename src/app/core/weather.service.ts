import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom, timeout } from 'rxjs';
import { API, CACHE_TTL_MS } from './config';
import { hpaToMmHg } from './pressure.util';
import { DailySun, GeoPoint, WeatherData } from './types';

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

    // Пробуем Open-Meteo, при ошибке — wttr.in (работает в РФ без VPN)
    let data: WeatherData;
    try {
      data = await this.loadOpenMeteo(point);
    } catch {
      data = await this.loadWttr(point);
    }

    this.writeCache(key, data);
    return data;
  }

  private async loadOpenMeteo(point: GeoPoint): Promise<WeatherData> {
    const params = new HttpParams({
      fromObject: {
        latitude: point.lat,
        longitude: point.lon,
        hourly: 'surface_pressure,temperature_2m,wind_speed_10m,cloud_cover,precipitation',
        current:
          'surface_pressure,pressure_msl,temperature_2m,wind_speed_10m,cloud_cover,precipitation',
        daily: 'sunrise,sunset',
        wind_speed_unit: 'ms',
        past_days: 2,
        forecast_days: 3,
        timezone: 'auto',
      },
    });

    const raw = await firstValueFrom(
      this.http.get<any>(API.forecast, { params }).pipe(timeout(12000)),
    );
    return this.parseOpenMeteo(point, raw);
  }

  /** Fallback: wttr.in — не заблокирован в РФ, CORS открыт */
  private async loadWttr(point: GeoPoint): Promise<WeatherData> {
    const url = `${API.wttr}/${point.lat},${point.lon}?format=j1`;
    const raw = await firstValueFrom(
      this.http.get<any>(url).pipe(timeout(12000)),
    );
    return this.parseWttr(point, raw);
  }

  private parseOpenMeteo(point: GeoPoint, j: any): WeatherData {
    const times: string[] = j.hourly.time;
    const mmHg: number[] = (j.hourly.surface_pressure as number[]).map(hpaToMmHg);
    const tempC: number[] = (j.hourly.temperature_2m as number[]).map((v: number) => Math.round(v));
    const windMs: number[] = (j.hourly.wind_speed_10m as number[]).map((v: number) => Math.round(v));
    const cloud: number[] = (j.hourly.cloud_cover as number[]).map((v: number) => Math.round(v));
    const precip: number[] = j.hourly.precipitation as number[];
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

    // daily sunrise/sunset массивом
    const dailyDates: string[] = j.daily?.time ?? [];
    const daily: DailySun[] = dailyDates.map((d: string, i: number) => ({
      date: d,
      sunrise: j.daily?.sunrise?.[i] ?? '',
      sunset: j.daily?.sunset?.[i] ?? '',
    }));

    return {
      point,
      fetchedAt: Date.now(),
      current: {
        time: nowTime,
        pressureMmHg: hpaToMmHg(j.current.surface_pressure),
        pressureMslMmHg: hpaToMmHg(j.current.pressure_msl),
        tempC: Math.round(j.current.temperature_2m),
        windMs: Math.round(j.current.wind_speed_10m),
        cloud: Math.round(j.current.cloud_cover ?? 0),
        precip: j.current.precipitation ?? 0,
      },
      series: { time: times, mmHg, tempC, windMs, cloud, precip },
      daily,
      sun: this.sunForDayOpenMeteo(j, nowTime),
      nowIndex,
    };
  }

  /**
   * Парсит ответ wttr.in (?format=j1).
   * wttr даёт 3 дня × 8 точек (каждые 3 ч), давление в мбар, скорость в км/ч.
   * Строим синтетический часовой ряд интерполяцией для совместимости с графиком.
   */
  private parseWttr(point: GeoPoint, j: any): WeatherData {
    const cur = j.current_condition?.[0];
    const now = new Date();
    const nowIso = this.toLocalIso(now);

    // Собираем почасовой ряд из 3-часовых точек wttr
    const times: string[] = [];
    const mmHg: number[] = [];
    const tempC: number[] = [];
    const windMs: number[] = [];
    const cloud: number[] = [];
    const precip: number[] = [];

    for (const day of (j.weather ?? []) as any[]) {
      const dateStr: string = day.date; // "YYYY-MM-DD"
      for (const h of (day.hourly ?? []) as any[]) {
        const hourMin = String(h.time).padStart(4, '0'); // "300" → "0300"
        const hh = hourMin.slice(0, -2).padStart(2, '0');
        const mm = hourMin.slice(-2);
        times.push(`${dateStr}T${hh}:${mm}`);
        mmHg.push(hpaToMmHg(Number(h.pressure)));
        tempC.push(Math.round(Number(h.tempC ?? 0)));
        windMs.push(Math.round(Number(h.windspeedKmph ?? 0) / 3.6));
        cloud.push(Math.round(Number(h.cloudcover ?? 0)));
        precip.push(Number(h.precipMM ?? 0));
      }
    }

    // nowIndex — ближайшая точка к текущему времени
    const tnow = now.getTime();
    let nowIndex = 0;
    let minDiff = Infinity;
    for (let i = 0; i < times.length; i++) {
      const diff = Math.abs(new Date(times[i]).getTime() - tnow);
      if (diff < minDiff) { minDiff = diff; nowIndex = i; }
    }

    // Восход/закат из astronomy (wttr возвращает "03:45 AM")
    const daily: DailySun[] = ((j.weather ?? []) as any[]).map((day: any) => {
      const astro = day.astronomy?.[0];
      const d = day.date ?? now.toISOString().slice(0, 10);
      return {
        date: d,
        sunrise: astro?.sunrise ? this.parseWttrTime(d, astro.sunrise) : '',
        sunset: astro?.sunset ? this.parseWttrTime(d, astro.sunset) : '',
      };
    });
    const todaySun = daily[0] ?? { date: '', sunrise: '', sunset: '' };

    // Давление: wttr даёт pressure в мбар (= гПа)
    const pressureMmHg = hpaToMmHg(Number(cur?.pressure ?? 0));
    // Ветер: wttr в км/ч → м/с
    const curWindMs = Math.round(Number(cur?.windspeedKmph ?? 0) / 3.6);

    return {
      point,
      fetchedAt: Date.now(),
      current: {
        time: nowIso,
        pressureMmHg,
        pressureMslMmHg: pressureMmHg,
        tempC: Math.round(Number(cur?.temp_C ?? 0)),
        windMs: curWindMs,
        cloud: Math.round(Number(cur?.cloudcover ?? 0)),
        precip: Number(cur?.precipMM ?? 0),
      },
      series: { time: times, mmHg, tempC, windMs, cloud, precip },
      daily,
      sun: { sunrise: todaySun.sunrise, sunset: todaySun.sunset },
      nowIndex,
    };
  }

  /** "03:45 AM" + "2026-06-17" → "2026-06-17T03:45" */
  private parseWttrTime(date: string, timeStr: string): string {
    const m = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
    if (!m) return '';
    let h = parseInt(m[1], 10);
    const min = m[2];
    if (m[3].toUpperCase() === 'PM' && h !== 12) h += 12;
    if (m[3].toUpperCase() === 'AM' && h === 12) h = 0;
    return `${date}T${String(h).padStart(2, '0')}:${min}`;
  }

  private toLocalIso(d: Date): string {
    const off = d.getTimezoneOffset();
    const local = new Date(d.getTime() - off * 60000);
    return local.toISOString().slice(0, 16);
  }

  /** Восход/закат для текущих суток (daily содержит и прошлые дни). */
  private sunForDayOpenMeteo(j: any, nowTime: string): { sunrise: string; sunset: string } {
    const day = nowTime.slice(0, 10);
    const dates: string[] = j.daily?.time ?? [];
    const i = Math.max(0, dates.indexOf(day));
    return {
      sunrise: j.daily?.sunrise?.[i] ?? '',
      sunset: j.daily?.sunset?.[i] ?? '',
    };
  }

  private cacheKey(p: GeoPoint): string {
    const hour = new Date().toISOString().slice(0, 13);
    return `wx3:${p.lat.toFixed(2)}:${p.lon.toFixed(2)}:${hour}`;
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
