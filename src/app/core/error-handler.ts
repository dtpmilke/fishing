import { ErrorHandler, inject, Injectable } from '@angular/core';
import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';
import { ToastService } from './toast.service';

/** Человекочитаемое сообщение для HTTP-ошибки */
function httpMessage(err: HttpErrorResponse): string {
  if (err.status === 0) {
    // status 0 = сетевая ошибка или CORS
    const msg = (err.error as any)?.message ?? '';
    if (msg.toLowerCase().includes('cors') || msg.toLowerCase().includes('cross-origin')) {
      return 'CORS: сервер не разрешил запрос';
    }
    return 'Нет соединения с сервером (сеть или CORS)';
  }
  if (err.status >= 500) return `Сервер вернул ошибку ${err.status}`;
  if (err.status === 404) return `Не найдено (404): ${new URL(err.url ?? '').hostname}`;
  if (err.status === 429) return 'Слишком много запросов — подождите немного';
  return `Ошибка ${err.status}: ${err.statusText || err.message}`;
}

/** HTTP interceptor: перехватывает все ошибки запросов и показывает тост */
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const toast = inject(ToastService);
  return next(req).pipe(
    catchError((err: unknown) => {
      if (err instanceof HttpErrorResponse) {
        toast.error(httpMessage(err));
      }
      return throwError(() => err);
    }),
  );
};

/** Глобальный обработчик JS-ошибок: показывает тост и логирует в консоль */
@Injectable()
export class AppErrorHandler implements ErrorHandler {
  private toast = inject(ToastService);

  handleError(err: unknown): void {
    // HttpErrorResponse уже обработан в interceptor — не дублируем
    if (err instanceof HttpErrorResponse) {
      console.error('[HTTP]', err.status, err.url, err.message);
      return;
    }

    const message =
      err instanceof Error ? err.message : String(err);

    // Игнорируем шум: ошибки отмены запроса и chunk-failed (SW обновит страницу сам)
    if (
      message.includes('ChunkLoadError') ||
      message.includes('Loading chunk') ||
      message.includes('cancelled')
    ) {
      console.warn('[ignored]', message);
      return;
    }

    console.error('[AppError]', err);
    this.toast.error(`Ошибка приложения: ${message.slice(0, 120)}`);
  }
}
