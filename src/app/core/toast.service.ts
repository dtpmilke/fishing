import { Injectable, signal } from '@angular/core';

export type ToastLevel = 'error' | 'warn' | 'info';

export interface Toast {
  id: number;
  message: string;
  level: ToastLevel;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly toasts = signal<Toast[]>([]);
  private next = 0;

  show(message: string, level: ToastLevel = 'info', durationMs = 4000): void {
    const id = ++this.next;
    this.toasts.update((t) => [...t, { id, message, level }]);
    setTimeout(() => this.dismiss(id), durationMs);
  }

  error(message: string): void {
    this.show(message, 'error', 6000);
  }

  warn(message: string): void {
    this.show(message, 'warn', 4500);
  }

  dismiss(id: number): void {
    this.toasts.update((t) => t.filter((x) => x.id !== id));
  }
}
