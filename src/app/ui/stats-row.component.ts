import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { AppStore } from '../state/app.store';

@Component({
  selector: 'app-stats-row',
  standalone: true,
  template: `
    @if (stats(); as s) {
      <div class="stats">
        <div class="tile glass">
          <i class="ti ti-wind" aria-hidden="true"></i>
          <b>{{ s.windMs }} м/с</b><span>ветер</span>
        </div>
        <div class="tile glass">
          <i class="ti ti-temperature" aria-hidden="true"></i>
          <b>{{ s.tempC }}°</b><span>воздух</span>
        </div>
        <div class="tile glass">
          <i class="ti ti-gauge" aria-hidden="true"></i>
          <b>{{ s.pressureMmHg }}</b><span>давление</span>
        </div>
      </div>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatsRowComponent {
  private store = inject(AppStore);

  stats = computed(() => {
    const w = this.store.weather();
    if (!w) return null;
    const day = this.store.selectedDay();
    if (day === 0) {
      return {
        windMs: w.current.windMs,
        tempC: w.current.tempC,
        pressureMmHg: w.current.pressureMmHg,
      };
    }
    const dw = this.store.dayWeather();
    return dw ? {
      windMs: dw.windMs,
      tempC: dw.tempC,
      pressureMmHg: dw.pressureMmHg,
    } : null;
  });
}
