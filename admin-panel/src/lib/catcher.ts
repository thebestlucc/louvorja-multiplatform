export type CatcherResult<T> = [T, null] | [null, Error];

/**
 * Wraps a promise into a [data, error] tuple — avoids repetitive try/catch.
 *
 * @example
 * const [data, err] = await catcher(fetch("/api/packs/upload", { ... }));
 * if (err) { console.error(err.message); return; }
 */
export async function catcher<T>(
  promise: Promise<T> | (() => Promise<T>),
): Promise<CatcherResult<T>> {
  try {
    const data = await (typeof promise === "function" ? promise() : promise);
    return [data, null];
  } catch (error) {
    return [null, error instanceof Error ? error : new Error(String(error))];
  }
}
