import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
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
import { DayTabsComponent } from './ui/day-tabs.component';
import { VerdictCardComponent } from './ui/verdict-card.component';
import { PressureTabsComponent } from './ui/pressure-tabs.component';
import { StatsRowComponent } from './ui/stats-row.component';
import { ToastComponent } from './ui/toast.component';
import { ThemeService } from './core/theme.service';
import { AppStore } from './state/app.store';

type SheetState = 'peek' | 'half' | 'full';

/**
 * Высоты состояний (от НИЖНЕГО края экрана вверх, в px или процентах)
 * peek  — ~120px (давление + заголовок)
 * half  — 50% высоты экрана
 * full  — 92% высоты экрана (оставляем safe-area сверху)
 */
function getSnapHeight(state: SheetState, _screenH: number): number {
  switch (state) {
    case 'peek': return 48; // только ручка
    case 'half': return _screenH * 0.5;
    case 'full': return _screenH; // на весь экран, перекрывает всё
  }
}

function nearestState(visibleH: number, screenH: number): SheetState {
  const peekH = getSnapHeight('peek', screenH);
  const halfH = getSnapHeight('half', screenH);
  const fullH = getSnapHeight('full', screenH);

  const dPeek = Math.abs(visibleH - peekH);
  const dHalf = Math.abs(visibleH - halfH);
  const dFull = Math.abs(visibleH - fullH);

  if (dPeek <= dHalf && dPeek <= dFull) return 'peek';
  if (dFull <= dHalf) return 'full';
  return 'half';
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    MapComponent,
    SearchBoxComponent,
    ThemeToggleComponent,
    NotifyButtonComponent,
    DayTabsComponent,
    VerdictCardComponent,
    PressureTabsComponent,
    StatsRowComponent,
    ToastComponent,
  ],
  templateUrl: './app.html',
  styleUrl: './app.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App implements OnInit, AfterViewInit, OnDestroy {
  readonly store = inject(AppStore);
  private theme = inject(ThemeService);
  private el = inject(ElementRef<HTMLElement>);
  private zone = inject(NgZone);

  // ---- bottom sheet (мобайл) ----
  readonly sheetState = signal<SheetState>('peek');
  readonly dragOffset = signal(0);
  readonly dragging = signal(false);
  private startY = 0;
  private startH = 0;
  private isDesktop = false;

  // Когда данные загрузились впервые — переходим в half (один раз)
  private _opened = false;
  private readonly _autoOpen = effect(() => {
    const w = this.store.weather();
    if (w && !this._opened) {
      this._opened = true;
      this.sheetState.set('half');
    }
  });

  /**
   * Transform: на мобиле sheet позиционирован абсолютно к bottom:0 с height = почти весь экран.
   * translateY сдвигает вниз, чтобы показать только нужную часть.
   * translateY(0) = полностью виден, translateY(sheet.height - 160) = peek.
   */
  readonly sheetStyle = computed(() => {
    if (this.isDesktop) return '';
    const screenH = window.innerHeight;
    const snapH = getSnapHeight(this.sheetState(), screenH);
    // sheet height = 100dvh = screenH; translateY = total - visible + drag
    const ty = screenH - snapH + this.dragOffset();
    return `translateY(${Math.max(0, ty)}px)`;
  });

  ngOnInit(): void {
    void this.store.init();
    this.checkDesktop();
  }

  ngAfterViewInit(): void {
    this.zone.runOutsideAngular(() => {
      const move = (e: PointerEvent) => { if (this.dragging()) this.zone.run(() => this.onMove(e)); };
      const up = () => { if (this.dragging()) this.zone.run(() => this.onUp()); };
      document.addEventListener('pointermove', move);
      document.addEventListener('pointerup', up);
      document.addEventListener('pointercancel', up);
      this._removeGlobalListeners = () => {
        document.removeEventListener('pointermove', move);
        document.removeEventListener('pointerup', up);
        document.removeEventListener('pointercancel', up);
      };
    });
  }

  private _removeGlobalListeners?: () => void;

  ngOnDestroy(): void {
    this._removeGlobalListeners?.();
  }

  private checkDesktop(): void {
    this.isDesktop = window.innerWidth >= 900;
  }

  onDown(e: PointerEvent): void {
    if (this.isDesktop) return;
    this.dragging.set(true);
    this.startY = e.clientY;
    const screenH = window.innerHeight;
    this.startH = getSnapHeight(this.sheetState(), screenH);
    try { (e.target as HTMLElement).setPointerCapture(e.pointerId); } catch { /* */ }
  }

  onMove(e: PointerEvent): void {
    if (!this.dragging()) return;
    // deltaY вниз = положительный offset (шторка уходит вниз)
    this.dragOffset.set(e.clientY - this.startY);
  }

  onUp(): void {
    if (!this.dragging()) return;
    this.dragging.set(false);
    const d = this.dragOffset();
    this.dragOffset.set(0);

    const screenH = window.innerHeight;
    // Текущая видимая высота с учётом перетаскивания
    const currentVisibleH = this.startH - d;

    // Определяем velocity (скорость свайпа)
    // Если свайп быстрый (>70px), шагаем на одно состояние
    const state = this.sheetState();
    if (d > 80) {
      // свайп вниз — уменьшаем
      if (state === 'full') this.sheetState.set('half');
      else if (state === 'half') this.sheetState.set('peek');
    } else if (d < -80) {
      // свайп вверх — увеличиваем
      if (state === 'peek') this.sheetState.set(this.store.weather() ? 'half' : 'peek');
      else if (state === 'half') this.sheetState.set('full');
    } else {
      // медленный drag — snap к ближайшему состоянию
      this.sheetState.set(nearestState(currentVisibleH, screenH));
    }
  }
}
