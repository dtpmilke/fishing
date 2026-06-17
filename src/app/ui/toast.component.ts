import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Toast, ToastService } from '../core/toast.service';

@Component({
  selector: 'app-toast',
  standalone: true,
  template: `
    <div class="toast-stack" aria-live="polite" aria-atomic="false">
      @for (t of svc.toasts(); track t.id) {
        <div class="toast" [attr.data-level]="t.level" role="alert">
          <i class="ti" [class.ti-alert-circle]="t.level === 'error'"
             [class.ti-alert-triangle]="t.level === 'warn'"
             [class.ti-info-circle]="t.level === 'info'" aria-hidden="true"></i>
          <span class="toast-msg">{{ t.message }}</span>
          <button class="toast-close" (click)="svc.dismiss(t.id)" aria-label="Закрыть">
            <i class="ti ti-x" aria-hidden="true"></i>
          </button>
        </div>
      }
    </div>
  `,
  styles: [`
    .toast-stack {
      position: fixed;
      top: max(72px, calc(env(safe-area-inset-top) + 58px));
      left: 50%;
      transform: translateX(-50%);
      z-index: 9999;
      display: flex;
      flex-direction: column;
      gap: 8px;
      width: min(360px, calc(100vw - 32px));
      pointer-events: none;
    }
    .toast {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 12px 14px;
      border-radius: 14px;
      font-size: 14px;
      line-height: 1.4;
      pointer-events: auto;
      animation: toast-in 0.22s ease;
      /* стеклянный эффект */
      background: var(--glass-bg);
      -webkit-backdrop-filter: var(--blur);
      backdrop-filter: var(--blur);
      border: 1px solid var(--glass-border);
      box-shadow: var(--shadow);
      color: var(--on-glass);
    }
    .toast[data-level='error'] { border-color: rgba(226, 87, 76, 0.6); }
    .toast[data-level='warn']  { border-color: rgba(233, 185, 73, 0.5); }

    .toast > i { font-size: 18px; flex: none; }
    .toast[data-level='error'] > i { color: var(--bad); }
    .toast[data-level='warn']  > i { color: var(--mid); }
    .toast[data-level='info']  > i { color: var(--good); }

    .toast-msg { flex: 1; }
    .toast-close {
      flex: none; border: none; background: transparent;
      color: var(--on-glass-dim); font-size: 16px; line-height: 1;
      padding: 2px; cursor: pointer;
    }
    @keyframes toast-in {
      from { opacity: 0; transform: translateY(-10px) scale(0.96); }
      to   { opacity: 1; transform: none; }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ToastComponent {
  svc = inject(ToastService);
}
