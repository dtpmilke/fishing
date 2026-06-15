import { Injectable, signal } from '@angular/core';

/**
 * Уведомления. Локальные работают без сервера (через service worker).
 * Для пуша при закрытом приложении нужен VAPID-ключ и push-сервер (см. комментарий в enable()).
 */
@Injectable({ providedIn: 'root' })
export class NotificationService {
  readonly supported =
    typeof Notification !== 'undefined' && 'serviceWorker' in navigator;

  readonly permission = signal<NotificationPermission>(
    typeof Notification !== 'undefined' ? Notification.permission : 'denied',
  );

  async enable(): Promise<void> {
    if (!this.supported) return;
    const p = await Notification.requestPermission();
    this.permission.set(p);
    if (p === 'granted') {
      await this.showLocal(
        'Уведомления включены 🎣',
        'Будем присылать утренний прогноз клёва на избранной точке.',
      );
      // Для пуша при закрытом приложении здесь подписываются на Web Push:
      // const reg = await navigator.serviceWorker.ready;
      // await reg.pushManager.subscribe({
      //   userVisibleOnly: true,
      //   applicationServerKey: <VAPID_PUBLIC_KEY>,   // нужен push-сервер / serverless
      // });
    }
  }

  /** Локальное уведомление — без сервера, пока зарегистрирован SW. */
  async showLocal(title: string, body: string): Promise<void> {
    if (this.permission() !== 'granted') return;
    try {
      const reg = await navigator.serviceWorker.ready;
      await reg.showNotification(title, {
        body,
        icon: 'icons/icon-192.png',
        badge: 'icons/icon-192.png',
      });
    } catch {
      new Notification(title, { body });
    }
  }
}
