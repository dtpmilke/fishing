import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { AppStore } from '../state/app.store';

interface HourRow { hour: string; mmHg: number; }

const KEY_HOURS = new Set([0, 3, 6, 9, 12, 15, 18, 21]);

@Component({
  selector: 'app-pressure-tabs',
  standalone: true,
  template: `
    @if (data(); as d) {
      <div class="ptabs">
        <div class="ptab-range">
          <span class="ptab-mm">{{ d.min }}–{{ d.max }}</span>
          <span class="ptab-unit">мм рт. ст.</span>
          <span class="ptab-trend" [class.rising]="d.trend > 1" [class.falling]="d.trend < -1">
            {{ d.trend > 1 ? '\u2197' : d.trend < -1 ? '\u2198' : '\u2192' }}
            {{ d.trend > 0 ? '+' : '' }}{{ d.trend }}
          </span>
        </div>
        @if (d.rows.length) {
          <div class="ptab-rows">
            @for (r of d.rows; track r.hour) {
              <div class="ptab-row">
                <span class="ptab-hour">{{ r.hour }}</span>
                <span class="ptab-val">{{ r.mmHg }}</span>
              </div>
            }
          </div>
        }
      </div>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PressureTabsComponent {
  private store = inject(AppStore);

  data = computed(() => {
    const w = this.store.weather();
    if (!w) return null;
    const date = this.store.selectedDate();

    // Фильтруем часы выбранного дня
    const points: { hour: number; mmHg: number }[] = [];
    for (let i = 0; i < w.series.time.length; i++) {
      if (w.series.time[i].startsWith(date)) {
        points.push({ hour: new Date(w.series.time[i]).getHours(), mmHg: w.series.mmHg[i] });
      }
    }
    if (!points.length) return null;

    const vals = points.map(p => p.mmHg);
    const min = Math.round(Math.min(...vals));
    const max = Math.round(Math.max(...vals));
    const trend = Math.round((vals[vals.length - 1] - vals[0]) * 10) / 10;

    const rows: HourRow[] = points
      .filter(p => KEY_HOURS.has(p.hour))
      .map(p => ({
        hour: `${p.hour.toString().padStart(2, '0')}:00`,
        mmHg: Math.round(p.mmHg),
      }));

    return { min, max, trend, rows };
  });
}
