import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ThemeService } from '../core/theme.service';

@Component({
  selector: 'app-theme-toggle',
  standalone: true,
  template: `
    <div class="toggle glass" role="group" aria-label="Тема оформления">
      <button [class.on]="t.mode() === 'light'" (click)="t.set('light')" title="Светлая" aria-label="Светлая тема">
        <i class="ti ti-sun" aria-hidden="true"></i>
      </button>
      <button [class.on]="t.mode() === 'auto'" (click)="t.set('auto')" title="Как на телефоне" aria-label="Системная тема">
        <i class="ti ti-device-mobile" aria-hidden="true"></i>
      </button>
      <button [class.on]="t.mode() === 'dark'" (click)="t.set('dark')" title="Тёмная" aria-label="Тёмная тема">
        <i class="ti ti-moon" aria-hidden="true"></i>
      </button>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ThemeToggleComponent {
  t = inject(ThemeService);
}
