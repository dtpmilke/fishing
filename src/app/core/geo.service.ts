import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom, timeout } from 'rxjs';
import { API } from './config';
import { GeoPoint } from './types';

@Injectable({ providedIn: 'root' })
export class GeoService {
  private http = inject(HttpClient);

  /** Точное местоположение по GPS (нужно разрешение пользователя). */
  getByGPS(): Promise<GeoPoint> {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) return reject('geolocation unsupported');
      navigator.geolocation.getCurrentPosition(
        (p) =>
          resolve({
            lat: +p.coords.latitude.toFixed(4),
            lon: +p.coords.longitude.toFixed(4),
          }),
        (e) => reject(e),
        { timeout: 8000, maximumAge: 600_000 },
      );
    });
  }

  /** Приблизительное местоположение по IP — без разрешения. */
  async getByIP(): Promise<GeoPoint | null> {
    try {
      const j = await firstValueFrom(
        this.http.get<any>(API.ipGeojs).pipe(timeout(4000)),
      );
      if (j.latitude && j.longitude)
        return { lat: +j.latitude, lon: +j.longitude, name: j.city };
    } catch {
      /* пробуем запасной */
    }
    try {
      const j = await firstValueFrom(
        this.http.get<any>(API.ipWhois).pipe(timeout(4000)),
      );
      if (j.latitude && j.longitude)
        return { lat: j.latitude, lon: j.longitude, name: j.city };
    } catch {
      /* нет связи */
    }
    return null;
  }

  /** Поиск точки по названию (геокодинг Open-Meteo). */
  async search(name: string): Promise<GeoPoint[]> {
    if (!name.trim()) return [];
    const params = new HttpParams({
      fromObject: { name, count: 6, language: 'ru', format: 'json' },
    });
    const j = await firstValueFrom(
      this.http.get<any>(API.geocode, { params }).pipe(timeout(8000)),
    );
    return ((j.results ?? []) as any[]).map((x) => ({
      lat: x.latitude,
      lon: x.longitude,
      name: [x.name, x.admin1, x.country_code].filter(Boolean).join(', '),
    }));
  }

  /** Координаты → читаемое название (обратный геокодинг BigDataCloud). */
  async reverse(lat: number, lon: number): Promise<string> {
    const fallback = `${lat.toFixed(3)}, ${lon.toFixed(3)}`;
    try {
      const params = new HttpParams({
        fromObject: { latitude: lat, longitude: lon, localityLanguage: 'ru' },
      });
      const j = await firstValueFrom(
        this.http.get<any>(API.reverse, { params }).pipe(timeout(6000)),
      );
      return j.locality || j.city || j.principalSubdivision || fallback;
    } catch {
      return fallback;
    }
  }
}
