import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { GeoService } from '../core/geo.service';
import { GeoPoint } from '../core/types';
import { AppStore } from '../state/app.store';

@Component({
  selector: 'app-search-box',
  standalone: true,
  template: `
    <div class="search glass">
      <i class="ti ti-search" aria-hidden="true"></i>
      <input
        [value]="query()"
        (input)="onInput($event)"
        (focus)="onInput($event)"
        type="text"
        placeholder="Поиск водоёма или города"
        aria-label="Поиск места"
      />
      <button class="icon-btn gps" (click)="store.useGPS()" title="Моё местоположение" aria-label="Моё местоположение">
        <i class="ti ti-current-location" aria-hidden="true"></i>
      </button>
    </div>

    @if (results().length) {
      <ul class="results glass">
        @for (r of results(); track r.lat + '_' + r.lon) {
          <li><button (click)="pick(r)">{{ r.name }}</button></li>
        }
      </ul>
    }

    @if (store.favorites().length) {
      <div class="favs">
        @for (f of store.favorites(); track f.lat + '_' + f.lon) {
          <button class="chip glass" (click)="pick(f)">
            <i class="ti ti-star" aria-hidden="true"></i>{{ f.name }}
          </button>
        }
      </div>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SearchBoxComponent {
  store = inject(AppStore);
  private geo = inject(GeoService);

  query = signal('');
  results = signal<GeoPoint[]>([]);
  private timer: ReturnType<typeof setTimeout> | undefined;

  onInput(e: Event): void {
    const v = (e.target as HTMLInputElement).value;
    this.query.set(v);
    clearTimeout(this.timer);
    if (!v.trim()) {
      this.results.set([]);
      return;
    }
    this.timer = setTimeout(async () => {
      try {
        this.results.set(await this.geo.search(v));
      } catch {
        this.results.set([]);
      }
    }, 300);
  }

  pick(r: GeoPoint): void {
    this.results.set([]);
    this.query.set(r.name ?? '');
    this.store.select(r);
  }
}
