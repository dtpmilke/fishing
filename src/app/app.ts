import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  NgZone,
  OnDestroy,
  OnInit,
  signal,
} from '@angular/core';
import { MapComponent } from './ui/map.component';
import { SearchBoxComponent } from './ui/search-box.component';
import { ThemeToggleComponent } from './ui/theme-toggle.component';
import { NotifyButtonComponent } from './ui/notify-button.component';
import { VerdictCardComponent } from './ui/verdict-card.component';
import { PressureChartComponent } from './ui/pressure-chart.component';
import { PressureForecastComponent } from './ui/pressure-forecast.component';
import { StatsRowComponent } from './ui/stats-row.component';
import { ToastComponent } from './ui/toast.component';
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
    PressureForecastComponent,
    StatsRowComponent,
    ToastComponent,
  ],
  templateUrl: './app.html',
  styleUrl: './app.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App implements OnInit, AfterViewInit, OnDestroy {
  readonly store = inject(AppStore);
  private theme = inject(ThemeService); // инициализирует тему в конструкторе сервиса
  private el = inject(ElementRef<HTMLElement>);
  private zone = inject(NgZone);

  // ---- bottom sheet (мобайл) ----
  readonly sheetOpen = signal(true);
  readonly dragOffset = signal(0);
  readonly dragging = signal(false);
  private startY = 0;
  private peekObserver?: ResizeObserver;

  readonly sheetStyle = computed(() => {
    const d = this.dragOffset();
    return this.sheetOpen()
      ? `translateY(${Math.max(0, d)}px)`
      : `translateY(calc(100% - var(--peek) + ${Math.min(0, d)}px))`;
  });

  ngOnInit(): void {
    void this.store.init();
  }

  ngAfterViewInit(): void {
    this.zone.runOutsideAngular(() => {
      // Обновляем --peek когда контент изменяется (загрузка данных меняет высоту)
      this.peekObserver = new ResizeObserver(() => this.updatePeek());
      const scroll = this.el.nativeElement.querySelector('.sheet-scroll');
      if (scroll) this.peekObserver.observe(scroll);
      this.updatePeek();
    });
  }

  ngOnDestroy(): void {
    this.peekObserver?.disconnect();
  }

  /**
   * Вычисляет --peek как расстояние от верха шторки до нижнего края .foot + запас для fade.
   * Работает независимо от размера экрана и длины текста.
   */
  private updatePeek(): void {
    const sheet = this.el.nativeElement.querySelector('.sheet') as HTMLElement | null;
    const foot = this.el.nativeElement.querySelector('.foot') as HTMLElement | null;
    if (!sheet || !foot) return;

    // Используем offsetTop/offsetHeight — они не зависят от transform/translateY
    // и дают позицию внутри шторки в её собственной системе координат
    let offsetTop = 0;
    let el: HTMLElement | null = foot;
    while (el && el !== sheet) {
      offsetTop += el.offsetTop;
      el = el.offsetParent as HTMLElement | null;
    }
    const footBottomInSheet = offsetTop + foot.offsetHeight;

    // peek = расстояние от верха шторки до низа .foot + запас для fade
    const peek = footBottomInSheet + 24;

    sheet.style.setProperty('--peek', `${Math.round(peek)}px`);
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
