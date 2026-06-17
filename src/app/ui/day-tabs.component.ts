import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { AppStore, DayOffset } from '../state/app.store';

@Component({
  selector: 'app-day-tabs',
  standalone: true,
  template: `
    <div class="day-tabs" role="tablist">
      @for (tab of tabs; track tab.day) {
        <button
          type="button"
          class="day-tab"
          [class.active]="store.selectedDay() === tab.day"
          role="tab"
          [attr.aria-selected]="store.selectedDay() === tab.day"
          (click)="store.setDay(tab.day)"
        >{{ tab.label }}</button>
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DayTabsComponent {
  store = inject(AppStore);
  tabs: { day: DayOffset; label: string }[] = [
    { day: 0, label: 'Сегодня' },
    { day: 1, label: 'Завтра' },
    { day: 2, label: 'Послезавтра' },
  ];
}
