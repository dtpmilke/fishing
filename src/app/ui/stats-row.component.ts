import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { AppStore } from '../state/app.store';

@Component({
  selector: 'app-stats-row',
  standalone: true,
  template: `
    @if (w(); as wx) {
      <div class="stats">
        <div class="tile glass">
          <i class="ti ti-wind" aria-hidden="true"></i>
          <b>{{ wx.current.windMs }} м/с</b><span>ветер</span>
        </div>
        <div class="tile glass">
          <i class="ti ti-temperature" aria-hidden="true"></i>
          <b>{{ wx.current.tempC }}°</b><span>воздух</span>
        </div>
        <div class="tile glass">
          <i class="ti ti-gauge" aria-hidden="true"></i>
          <b>{{ wx.current.pressureMslMmHg }}</b><span>над морем</span>
        </div>
      </div>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatsRowComponent {
  w = inject(AppStore).weather;
}
