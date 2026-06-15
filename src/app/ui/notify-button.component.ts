import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { NotificationService } from '../core/notification.service';

@Component({
  selector: 'app-notify-button',
  standalone: true,
  template: `
    @if (n.supported) {
      <button class="round-btn glass" (click)="n.enable()" [title]="label()" [attr.aria-label]="label()">
        <i class="ti" [class.ti-bell]="!granted()" [class.ti-bell-ringing]="granted()" aria-hidden="true"></i>
      </button>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotifyButtonComponent {
  n = inject(NotificationService);
  granted = computed(() => this.n.permission() === 'granted');
  label = computed(() =>
    this.granted() ? 'Уведомления включены' : 'Включить уведомления',
  );
}
