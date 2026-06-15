import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { FishingSpot, SpotKind } from './types';

/**
 * Поиск рыбных мест рядом с точкой через Overpass API (OpenStreetMap, без ключа).
 * Ищем водоёмы (озёра/пруды/водохранилища), реки и точки с тегом leisure=fishing.
 */
@Injectable({ providedIn: 'root' })
export class SpotsService {
  private http = inject(HttpClient);
  private readonly endpoint = 'https://overpass-api.de/api/interpreter';
  private readonly cacheTtl = 30 * 24 * 60 * 60 * 1000; // 30 дней — места меняются редко

  async findNear(lat: number, lon: number, radius = 12000): Promise<FishingSpot[]> {
    const cacheKey = `spots:${lat.toFixed(2)}:${lon.toFixed(2)}`;
    const cached = this.readCache(cacheKey);
    if (cached) return cached;

    const q = `[out:json][timeout:25];
(
  node["leisure"="fishing"](around:${radius},${lat},${lon});
  way["natural"="water"]["name"](around:${radius},${lat},${lon});
  relation["natural"="water"]["name"](around:${radius},${lat},${lon});
  way["waterway"="riverbank"]["name"](around:${radius},${lat},${lon});
);
out center 60;`;

    const body = new URLSearchParams({ data: q }).toString();
    const j = await firstValueFrom(
      this.http.post<any>(this.endpoint, body, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      }),
    );

    const seen = new Set<string>();
    const spots: FishingSpot[] = [];

    for (const el of (j.elements ?? []) as any[]) {
      const lt = el.lat ?? el.center?.lat;
      const ln = el.lon ?? el.center?.lon;
      if (lt == null || ln == null) continue;

      const tags = el.tags ?? {};
      const kind: SpotKind =
        tags.leisure === 'fishing' ? 'fishing' : tags.waterway ? 'river' : 'water';
      const name: string =
        tags.name ||
        (kind === 'fishing' ? 'Место для рыбалки' : kind === 'river' ? 'Река' : 'Водоём');

      // отсекаем объекты, чей центр далеко от точки (у больших рек/водохранилищ
      // центроид может оказаться за десятки км — это и давало «не та местность»)
      const dist = haversine(lat, lon, +lt, +ln);
      if (dist > radius) continue;

      const key = `${(+lt).toFixed(4)}_${(+ln).toFixed(4)}`;
      if (seen.has(key)) continue;
      seen.add(key);

      spots.push({ lat: +lt, lon: +ln, name, kind, dist } as FishingSpot & { dist: number });
    }

    // ближе к точке и приоритет местам рыбалки — выше
    spots.sort((a, b) => {
      const fa = a.kind === 'fishing' ? 0 : 1;
      const fb = b.kind === 'fishing' ? 0 : 1;
      if (fa !== fb) return fa - fb;
      return (a as any).dist - (b as any).dist;
    });

    const result = spots.slice(0, 40);
    this.writeCache(cacheKey, result);
    return result;
  }

  private readCache(key: string): FishingSpot[] | null {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const { at, spots } = JSON.parse(raw) as { at: number; spots: FishingSpot[] };
      return Date.now() - at > this.cacheTtl ? null : spots;
    } catch {
      return null;
    }
  }

  private writeCache(key: string, spots: FishingSpot[]): void {
    try {
      localStorage.setItem(key, JSON.stringify({ at: Date.now(), spots }));
    } catch {
      /* квота переполнена — не критично */
    }
  }
}

/** Расстояние между точками в метрах (гаверсинус). */
function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}
