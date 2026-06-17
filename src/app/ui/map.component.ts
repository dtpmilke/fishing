import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import * as L from 'leaflet';
import { AppStore } from '../state/app.store';
import { FishingSpot } from '../core/types';

@Component({
  selector: 'app-map',
  standalone: true,
  template: `
    <div #map class="map"></div>
    @if (tilesLoading()) {
      <div class="map-loader">
        <span class="map-spinner" aria-hidden="true"></span>
        <span>Загрузка карты…</span>
      </div>
    }
  `,
  styles: [
    `
      .map {
        position: absolute;
        inset: 0;
        z-index: 0;
      }
      /* iOS fix: force hardware acceleration */
      @supports (-webkit-touch-callout: none) {
        .map { -webkit-transform: translateZ(0); transform: translateZ(0); }
      }
      .map-loader {
        position: absolute; z-index: 400; left: 50%; top: 50%;
        transform: translate(-50%, -50%);
        display: flex; align-items: center; gap: 10px;
        padding: 11px 18px; border-radius: 999px; font-size: 14px;
        color: var(--on-glass); background: var(--glass-bg);
        -webkit-backdrop-filter: var(--blur); backdrop-filter: var(--blur);
        border: 1px solid var(--glass-border); box-shadow: var(--shadow);
      }
      .map-spinner {
        width: 18px; height: 18px; border-radius: 50%;
        border: 2px solid var(--on-glass-dim); border-top-color: var(--on-glass);
        animation: map-spin 0.8s linear infinite;
      }
      @keyframes map-spin { to { transform: rotate(360deg); } }
      @media (prefers-reduced-motion: reduce) { .map-spinner { animation: none; } }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MapComponent implements AfterViewInit {
  private store = inject(AppStore);
  private mapEl = viewChild.required<ElementRef<HTMLDivElement>>('map');

  readonly tilesLoading = signal(true);

  private map!: L.Map;
  private marker?: L.Marker;
  private spotsLayer?: L.LayerGroup;

  constructor() {
    effect(() => {
      const p = this.store.point();
      if (this.map) this.setMarker(p.lat, p.lon, true);
    });
    effect(() => {
      const spots = this.store.spots();
      if (this.map) this.renderSpots(spots);
    });
  }

  ngAfterViewInit(): void {
    const p = this.store.point();
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

    this.map = L.map(this.mapEl().nativeElement, {
      preferCanvas: !isIOS, // на iOS лучше DOM рендеринг
      zoomControl: false, // прячем дефолтные контролы
    }).setView([p.lat, p.lon], 11);

    // OSM standard — подписи на местном языке (в России — по-русски).
    // Тёмная тема делается CSS-фильтром поверх этих же тайлов (см. styles.css).
    const base = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap',
      crossOrigin: true,
      updateWhenIdle: false, // плавнее на мобильных
      updateWhenZooming: false,
    });
    base.on('loading', () => this.tilesLoading.set(true));
    base.on('load', () => this.tilesLoading.set(false));
    base.on('tileerror', () => {
      // при ошибке тайла всё равно скрываем лоадер через таймаут
      setTimeout(() => this.tilesLoading.set(false), 2000);
    });
    base.addTo(this.map);

    // убираем дефолтный префикс Leaflet (с флагом), оставляем чистый кредит
    this.map.attributionControl.setPrefix(
      '<a href="https://leafletjs.com" target="_blank" rel="noopener">Leaflet</a>',
    );

    this.setMarker(p.lat, p.lon, false);

    // После первого рендера браузер пересчитывает layout (особенно на iOS),
    // поэтому принудительно обновляем размер карты в следующем кадре.
    requestAnimationFrame(() => this.map.invalidateSize());

    this.map.on('click', (e: L.LeafletMouseEvent) => {
      this.store.select({
        lat: +e.latlng.lat.toFixed(4),
        lon: +e.latlng.lng.toFixed(4),
      });
    });
  }

  private setMarker(lat: number, lon: number, fly: boolean): void {
    if (!this.marker) {
      const icon = L.divIcon({
        className: 'fish-pin',
        html: '<span class="fish-pin__dot"></span>',
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      });
      this.marker = L.marker([lat, lon], { draggable: true, icon }).addTo(this.map);
      this.marker.on('dragend', () => {
        const ll = this.marker!.getLatLng();
        this.store.select({ lat: +ll.lat.toFixed(4), lon: +ll.lng.toFixed(4) });
      });
    } else {
      this.marker.setLatLng([lat, lon]);
    }
    if (fly) this.map.panTo([lat, lon], { animate: true, duration: 0.6 });
  }

  private renderSpots(spots: FishingSpot[]): void {
    this.spotsLayer?.remove();
    this.spotsLayer = undefined;
    if (!spots.length) return;

    const icon = L.divIcon({
      className: 'spot-pin',
      html: '<span class="spot-pin__dot"></span>',
      iconSize: [16, 16],
      iconAnchor: [8, 8],
    });
    const markers = spots.map((s) =>
      L.marker([s.lat, s.lon], { icon })
        .bindTooltip(s.name, { direction: 'top' })
        .on('click', () => this.store.select({ lat: s.lat, lon: s.lon, name: s.name })),
    );
    this.spotsLayer = L.layerGroup(markers).addTo(this.map);
  }
}

