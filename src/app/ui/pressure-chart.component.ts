import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { AppStore } from '../state/app.store';

@Component({
  selector: 'app-pressure-chart',
  standalone: true,
  template: `
    @if (chart(); as c) {
      <div class="chart glass">
        <svg viewBox="0 0 320 90" preserveAspectRatio="none" class="spark" aria-hidden="true">
          <polyline [attr.points]="c.line" class="spark-line" />
          <line [attr.x1]="c.nowX" y1="6" [attr.x2]="c.nowX" y2="84" class="spark-now" />
          <circle [attr.cx]="c.nowX" [attr.cy]="c.nowY" r="3.5" class="spark-dot" />
        </svg>
        <div class="axis"><span>−24 ч</span><span>сейчас</span><span>+12 ч</span></div>
      </div>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PressureChartComponent {
  private store = inject(AppStore);

  chart = computed(() => {
    const t = this.store.trends();
    if (!t || t.past.length < 2) return null;

    const all = [...t.past, ...t.fwd.slice(1)];
    const n = all.length;
    const min = Math.min(...all);
    const max = Math.max(...all);
    const range = max - min || 1;
    const W = 320;
    const H = 90;
    const pad = 10;

    const x = (i: number) => (i / (n - 1)) * W;
    const y = (v: number) => pad + (1 - (v - min) / range) * (H - 2 * pad);

    const line = all.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
    const nowI = t.past.length - 1;
    return {
      line,
      nowX: x(nowI).toFixed(1),
      nowY: y(all[nowI]).toFixed(1),
    };
  });
}
