import { computed, effect, Injectable, signal } from '@angular/core';

export type ThemeMode = 'light' | 'dark' | 'auto';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private media = window.matchMedia('(prefers-color-scheme: dark)');
  private systemDark = signal(this.media.matches);

  /** Выбор пользователя: светлая / тёмная / системная. */
  readonly mode = signal<ThemeMode>(
    (localStorage.getItem('theme') as ThemeMode) || 'auto',
  );

  /** Реально применяемая тема. */
  readonly effective = computed<'light' | 'dark'>(() =>
    this.mode() === 'auto'
      ? this.systemDark()
        ? 'dark'
        : 'light'
      : (this.mode() as 'light' | 'dark'),
  );

  constructor() {
    // системная тема может меняться на лету (день/ночь по расписанию телефона)
    this.media.addEventListener('change', (e) => this.systemDark.set(e.matches));

    effect(() => {
      document.documentElement.setAttribute('data-theme', this.effective());
      localStorage.setItem('theme', this.mode());
    });
  }

  set(mode: ThemeMode): void {
    this.mode.set(mode);
  }
}
