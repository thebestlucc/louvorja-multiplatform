import { notify, isAppErrorResponse } from "./notifications";
import type { AppErrorResponse } from "./bindings";

export type CatcherResult<T> = [T, null] | [null, AppErrorResponse];

export interface CatcherOptions {
  /** If true, will automatically call `notify.tauriError` if an error occurs. Defaults to false. */
  notify?: boolean;
  /** Custom fallback message for the notification. */
  fallbackMessage?: string;
}

/**
 * Standardizes error handling by wrapping a promise and returning a [data, error] tuple.
 * Helps avoid repetitive try-catch blocks and ensures consistent error responses.
 *
 * @example
 * const [hymns, error] = await catcher(searchHymns(query), { notify: true });
 * if (error) return; // error was already notified if notify: true
 * // use hymns safely here
 */
export async function catcher<T>(
  promise: Promise<T> | (() => Promise<T>),
  options: CatcherOptions = { notify: false }
): Promise<CatcherResult<T>> {
  try {
    const data = await (typeof promise === "function" ? promise() : promise);
    return [data, null];
  } catch (error: any) {
    const appError: AppErrorResponse = isAppErrorResponse(error)
      ? (error as AppErrorResponse)
      : {
          code: "UnexpectedError",
          message: error instanceof Error ? error.message : String(error),
          details: error?.stack || null,
        };

    if (options.notify) {
      notify.tauriError(appError, options.fallbackMessage);
    }

    return [null, appError];
  }
}

/**
 * Standardizes error handling for synchronous operations.
 */
export function catcherSync<T>(
  fn: () => T,
  options: CatcherOptions = { notify: false }
): CatcherResult<T> {
  try {
    const data = fn();
    return [data, null];
  } catch (error: any) {
    const appError: AppErrorResponse = isAppErrorResponse(error)
      ? (error as AppErrorResponse)
      : {
          code: "UnexpectedError",
          message: error instanceof Error ? error.message : String(error),
          details: error?.stack || null,
        };

    if (options.notify) {
      notify.tauriError(appError, options.fallbackMessage);
    }

    return [null, appError];
  }
}

/**
 * Standardized way to create an AppErrorResponse object.
 */
export function makeError(
  code: string,
  message: string,
  details: string | null = null
): AppErrorResponse {
  return { code, message, details };
}

/**
 * Standardized way to throw an AppErrorResponse from the frontend if needed.
 */
export function thrower(error: AppErrorResponse): never {
  throw error;
}
