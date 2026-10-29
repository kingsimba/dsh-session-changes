import { HIGHLIGHT_NAME, collectRanges, supportsTokenHighlight } from "../token-highlight.js";
import { react } from "../react.js";

/**
 * Register the selected token's matches with the CSS Custom Highlight API, so every
 * occurrence in the mounted comparison is painted.
 *
 * Nothing in the rendered text changes, which is what keeps the native selection
 * alive for a copy after the double-click that started it. The effect re-collects
 * the ranges whenever the diff is rebuilt (new model) or the body is redrawn (wrap),
 * because those replace the text nodes the ranges point at.
 *
 * @param containerRef - the comparison body.
 * @param token - the selected token, or null.
 * @param model - the built diff model; a new one re-collects the ranges.
 * @param wrap - the wrap mode; toggling it redraws the body.
 */
export function useTokenHighlight(containerRef, token, model, wrap) {
  react.useEffect(() => {
    if (token === null || token === undefined) return undefined;
    const container = containerRef.current;
    if (container === null || container === undefined) return undefined;
    if (supportsTokenHighlight() !== true) return undefined;
    let ranges;
    try {
      ranges = collectRanges(container, token);
    } catch (_error) {
      return undefined;
    }
    if (ranges.length === 0) {
      CSS.highlights.delete(HIGHLIGHT_NAME);
      return undefined;
    }
    // Add one by one: a long file can produce more matches than a spread argument
    // list is allowed to carry.
    const highlight = new Highlight();
    for (const range of ranges) highlight.add(range);
    CSS.highlights.set(HIGHLIGHT_NAME, highlight);
    return () => {
      CSS.highlights.delete(HIGHLIGHT_NAME);
    };
  }, [containerRef, token, model, wrap]);
}
