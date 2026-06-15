import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ThemeService, ThemeMode } from '../core/theme.service';

@Component({
  selector: 'app-theme-toggle',
  standalone: true,
  template: `
    <div class="theme-fab" [class.open]="open()">
      <button
        class="fab-main glass"
        (click)="toggle()"
        [attr.aria-expanded]="open()"
        aria-label="Тема оформления"
        title="Тема"
      >
        @switch (t.mode()) {
          @case ('light') { <i class="ti ti-sun" aria-hidden="true"></i> }
          @case ('dark') { <i class="ti ti-moon" aria-hidden="true"></i> }
          @default { <i class="ti ti-device-mobile" aria-hidden="true"></i> }
        }
      </button>

      <div class="fab-menu">
        <button
          class="glass"
          [class.active]="t.mode() === 'light'"
          (click)="set('light')"
          title="Светлая"
          aria-label="Светлая тема"
        >
          <i class="ti ti-sun" aria-hidden="true"></i>
        </button>
        <button
          class="glass"
          [class.active]="t.mode() === 'auto'"
          (click)="set('auto')"
          title="Как на телефоне"
          aria-label="Системная тема"
        >
          <i class="ti ti-device-mobile" aria-hidden="true"></i>
        </button>
        <button
          class="glass"
          [class.active]="t.mode() === 'dark'"
          (click)="set('dark')"
          title="Тёмная"
          aria-label="Тёмная тема"
        >
          <i class="ti ti-moon" aria-hidden="true"></i>
        </button>
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ThemeToggleComponent {
  t = inject(ThemeService);
  open = signal(false);

  toggle(): void {
    this.open.update(v => !v);
  }

  set(mode: ThemeMode): void {
    this.t.set(mode);
    this.open.set(false);
  }
}
