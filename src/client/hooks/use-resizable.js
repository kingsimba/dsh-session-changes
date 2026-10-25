import { MIN_LEFT, MIN_RIGHT, WIDTH_KEY } from "../constants.js";
import { react } from "../react.js";
import { readLeft, writeStored } from "../storage.js";

/**
 * The draggable divider between the list and the comparison: width state, pointer
 * drag, keyboard nudge, and the resize observer that keeps both panes usable.
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

  react.useEffect(() => {
    const box = rootRef.current;
    if (box === null || typeof ResizeObserver === "undefined") return undefined;
    const observer = new ResizeObserver(() => {
      const width = box.getBoundingClientRect().width;
      setLeft((value) => Math.min(value, Math.max(MIN_LEFT, width - MIN_RIGHT)));
    });
    observer.observe(box);
    return () => observer.disconnect();
  }, []);

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
