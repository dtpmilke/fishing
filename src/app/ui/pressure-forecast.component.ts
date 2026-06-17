import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { AppStore } from '../state/app.store';

const W = 320;
const H = 100;
const PAD_X = 4;
const PAD_TOP = 12;
const PAD_BOTTOM = 22; // полоса под подписи суток

/** Подпись суток относительно сегодняшнего дня. */
function dayLabel(d: Date): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const that = new Date(d);
  that.setHours(0, 0, 0, 0);
  const diff = Math.round((that.getTime() - today.getTime()) / 86_400_000);
  if (diff <= 0) return 'Сегодня';
  if (diff === 1) return 'Завтра';
  if (diff === 2) return 'Послезавтра';
  return that.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}

@Component({
  selector: 'app-pressure-forecast',
  standalone: true,
  template: `
    @if (chart(); as c) {
      <div class="chart glass fc">
        <div class="fc-head">
          <span class="fc-title">Давление · 2 дня</span>
          <span class="fc-range">{{ c.min }}–{{ c.max }} мм рт. ст.</span>
        </div>
        <div class="fc-plot">
          <svg viewBox="0 0 320 100" preserveAspectRatio="none" class="fc-svg" aria-hidden="true">
            @for (s of c.seps; track s.x) {
              <line [attr.x1]="s.x" y1="12" [attr.x2]="s.x" y2="78" class="fc-sep" />
            }
            <polyline [attr.points]="c.line" class="fc-line" />
            <circle [attr.cx]="c.startX" [attr.cy]="c.startY" r="3.5" class="fc-dot" />
          </svg>
          @for (d of c.days; track d.pct) {
            <span class="fc-day" [style.left.%]="d.pct">{{ d.label }}</span>
          }
        </div>
      </div>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PressureForecastComponent {
  private store = inject(AppStore);

  chart = computed(() => {
    const pts = this.store.forecast();
    if (!pts || pts.length < 2) return null;

    const vals = pts.map((p) => p.mmHg);
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const range = max - min || 1;
    const n = pts.length;

    const x = (i: number) => PAD_X + (i / (n - 1)) * (W - 2 * PAD_X);
    const y = (v: number) => PAD_TOP + (1 - (v - min) / range) * (H - PAD_TOP - PAD_BOTTOM);

    const line = pts.map((p, i) => `${x(i).toFixed(1)},${y(p.mmHg).toFixed(1)}`).join(' ');

    // Разделители суток (полночь) и центрированные подписи дней
    const seps: { x: string }[] = [];
    const days: { label: string; pct: number }[] = [];
    let segStart = 0;
    for (let i = 1; i <= n; i++) {
      const boundary = i === n || new Date(pts[i].time).getDate() !== new Date(pts[segStart].time).getDate();
      if (!boundary) continue;
      const mid = (segStart + i - 1) / 2;
      const pct = Math.min(94, Math.max(6, (x(mid) / W) * 100));
      days.push({ label: dayLabel(new Date(pts[segStart].time)), pct });
      if (i < n) {
        seps.push({ x: x(i).toFixed(1) });
        segStart = i;
      }
    }

    return {
      line,
      seps,
      days,
      min: Math.round(min),
      max: Math.round(max),
      startX: x(0).toFixed(1),
      startY: y(pts[0].mmHg).toFixed(1),
    };
  });
}
