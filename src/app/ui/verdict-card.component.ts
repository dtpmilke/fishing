import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { AppStore } from '../state/app.store';

@Component({
  selector: 'app-verdict-card',
  standalone: true,
  template: `
    @if (store.status() === 'error') {
      <div class="verdict glass">
        <p class="hint">Не удалось загрузить погоду. Проверьте сеть.</p>
        <button class="text-btn" (click)="store.refresh()">Повторить</button>
      </div>
    } @else if (!w()) {
      <div class="verdict glass"><p class="hint">Загрузка прогноза…</p></div>
    } @else {
      <div class="verdict glass" [attr.data-level]="v()?.level">
        <div class="place">
          <i class="ti ti-map-pin" aria-hidden="true"></i>
          <span class="place-name">{{ store.placeName() }}</span>
          <button class="fav" [class.active]="store.isFavorite()" (click)="store.toggleFavorite()"
                  aria-label="В избранное">
            <i class="ti ti-star" aria-hidden="true"></i>
          </button>
        </div>

        <div class="pressure">
          <span class="value">{{ w()!.current.pressureMmHg }}</span>
          <span class="unit">мм рт. ст.</span>
          <span class="trend">{{ arrow() }} {{ deltaText() }}</span>
        </div>

        <div class="bite">
          <div class="badge"><i class="ti ti-fish" aria-hidden="true"></i></div>
          <div>
            <div class="bite-label">{{ v()!.label }}</div>
            <div class="bite-score">оценка {{ v()!.score }} / 100</div>
          </div>
        </div>

        <p class="hint">{{ v()!.hint }}</p>

        <div class="foot">
          <span>обновлено {{ ago() }}</span>
          <button class="icon-btn" (click)="store.refresh()" aria-label="Обновить">
            <i class="ti ti-refresh" aria-hidden="true"></i>
          </button>
        </div>
      </div>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VerdictCardComponent {
  store = inject(AppStore);
  w = this.store.weather;
  v = this.store.verdict;

  arrow = computed(() => {
    const d = this.store.trends()?.delta24 ?? 0;
    return d > 0.5 ? '↗' : d < -0.5 ? '↘' : '→';
  });

  deltaText = computed(() => {
    const d = this.store.trends()?.delta24 ?? 0;
    return `${d > 0 ? '+' : ''}${d} / сут`;
  });

  ago(): string {
    const w = this.store.weather();
    if (!w) return '';
    const m = Math.round((Date.now() - w.fetchedAt) / 60000);
    return m < 1 ? 'только что' : `${m} мин назад`;
  }
}
