import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { MapComponent } from './ui/map.component';
import { SearchBoxComponent } from './ui/search-box.component';
import { ThemeToggleComponent } from './ui/theme-toggle.component';
import { NotifyButtonComponent } from './ui/notify-button.component';
import { VerdictCardComponent } from './ui/verdict-card.component';
import { PressureChartComponent } from './ui/pressure-chart.component';
import { StatsRowComponent } from './ui/stats-row.component';
import { ThemeService } from './core/theme.service';
import { AppStore } from './state/app.store';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    MapComponent,
    SearchBoxComponent,
    ThemeToggleComponent,
    NotifyButtonComponent,
    VerdictCardComponent,
    PressureChartComponent,
    StatsRowComponent,
  ],
  templateUrl: './app.html',
  styleUrl: './app.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App implements OnInit {
  readonly store = inject(AppStore);
  private theme = inject(ThemeService); // инициализирует тему в конструкторе сервиса

  // ---- bottom sheet (мобайл) ----
  readonly sheetOpen = signal(true);
  readonly dragOffset = signal(0);
  readonly dragging = signal(false);
  private startY = 0;

  readonly sheetStyle = computed(() => {
    const d = this.dragOffset();
    return this.sheetOpen()
      ? `translateY(${Math.max(0, d)}px)`
      : `translateY(calc(100% - var(--peek) + ${Math.min(0, d)}px))`;
  });

  ngOnInit(): void {
    void this.store.init();
  }

  onDown(e: PointerEvent): void {
    this.dragging.set(true);
    this.startY = e.clientY;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }

  onMove(e: PointerEvent): void {
    if (!this.dragging()) return;
    this.dragOffset.set(e.clientY - this.startY);
  }

  onUp(): void {
    if (!this.dragging()) return;
    this.dragging.set(false);
    const d = this.dragOffset();
    this.dragOffset.set(0);
    if (Math.abs(d) < 6) {
      this.sheetOpen.update((v) => !v); // тап по ручке = переключить
    } else if (this.sheetOpen() && d > 70) {
      this.sheetOpen.set(false);
    } else if (!this.sheetOpen() && d < -50) {
      this.sheetOpen.set(true);
    }
  }
}
