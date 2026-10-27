import { MIN_LEFT, MIN_RIGHT, WIDTH_KEY } from "../constants.js";
import { react } from "../react.js";
import { readLeft, writeStored } from "../storage.js";

/**
 * The draggable divider between the list and the comparison: width state, pointer
 * drag, and keyboard nudge.
 *
 * The width the user chose is left alone when the sidebar changes size: the pane
 * carries a CSS `max-width` that keeps the comparison usable, so expanding or
 * collapsing the sidebar never rewrites (and shrinks) the remembered width. An
 * observer here would also re-render the whole tab — long comparison included — on
 * every frame of a width transition, which is exactly when it must stay quiet.
 *
 * @returns `{ rootRef, left, dragging, startDrag, nudge }`: attach the ref to the
 *   tab root, spread the handlers onto the divider.
 */
export function useResizable() {
  const rootRef = react.useRef(null);
  const [left, setLeft] = react.useState(readLeft);
  const [dragging, setDragging] = react.useState(false);

  /** Keep the list wide enough to read and the comparison wide enough to use. */
  const clamp = (value) => {
    const box = rootRef.current;
    const width = box === null ? Number.POSITIVE_INFINITY : box.getBoundingClientRect().width;
    return Math.max(MIN_LEFT, Math.min(value, Math.max(MIN_LEFT, width - MIN_RIGHT)));
  };

  const startDrag = (event) => {
    if (event.button !== undefined && event.button !== 0) return;
    const startX = event.clientX;
    const startWidth = left;
    setDragging(true);
    event.preventDefault();
    const move = (next) => setLeft(clamp(startWidth + (next.clientX - startX)));
    const stop = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);
      setDragging(false);
      setLeft((value) => {
        writeStored(WIDTH_KEY, String(value));
        return value;
      });
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", stop);
  };

  const nudge = (event) => {
    const step = event.shiftKey ? 48 : 16;
    if (event.key === "ArrowLeft")
      setLeft((value) => {
        const next = clamp(value - step);
        writeStored(WIDTH_KEY, String(next));
        return next;
      });
    else if (event.key === "ArrowRight")
      setLeft((value) => {
        const next = clamp(value + step);
        writeStored(WIDTH_KEY, String(next));
        return next;
      });
    else return;
    event.preventDefault();
  };

  return { rootRef, left, dragging, startDrag, nudge };
}
