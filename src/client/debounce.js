/**
 * One trailing debounce timer: any number of {@link schedule} calls inside `delay`
 * collapse into a single {@link run}, fired `delay` ms after the last call.
 *
 * A file save is rarely one event on disk (editors write a temp file, rename, then
 * touch again), so the tab coalesces the burst before it re-reads. The returned
 * handle is disposable: the tab's effect owns it and drops it on close.
 *
 * @param delay - quiet period in milliseconds.
 * @param run - the callback one burst ends with.
 * @returns `{ schedule, cancel, dispose, pending }`.
 */
export function createDebouncer(delay, run) {
  let timer = undefined;
  let disposed = false;

  const cancel = () => {
    if (timer !== undefined) {
      clearTimeout(timer);
      timer = undefined;
    }
  };

  return {
    /** Restart the quiet period. */
    schedule() {
      if (disposed) return;
      cancel();
      timer = setTimeout(() => {
        timer = undefined;
        run();
      }, delay);
    },
    cancel,
    /** Drop any waiting call; later schedules are ignored. */
    dispose() {
      disposed = true;
      cancel();
    },
    /** Whether one burst is still waiting. */
    get pending() {
      return timer !== undefined;
    },
  };
}
