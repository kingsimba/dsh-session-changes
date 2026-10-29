/**
 * Painting token matches without touching the rendered text.
 *
 * The CSS Custom Highlight API is the right tool here: it colours ranges the way
 * `::selection` does, so the user's own selection and Ctrl+C keep working. Wrapping
 * the matches in `<mark>` would re-create the text nodes and collapse the selection
 * the moment the highlight appears — which is exactly the moment the user is about
 * to copy the identifier. The mark renderer is kept only as a fallback for a
 * browser without the API.
 */

import { matchRanges, tokenOf } from "./diff/tokens.js";

/** The registry name both the layout and the stylesheet use. */
export const HIGHLIGHT_NAME = "dsc-token-hit";

/** `NodeFilter.SHOW_TEXT`; the constant itself is not available in every host. */
const SHOW_TEXT = 4;

/** Browsers that expose the pieces the highlight needs, older ones fall back to marks. */
export function supportsTokenHighlight() {
  return (
    typeof CSS !== "undefined" &&
    CSS !== null &&
    typeof CSS.highlights === "object" &&
    CSS.highlights !== null &&
    typeof Highlight === "function" &&
    typeof document !== "undefined" &&
    typeof document.createRange === "function" &&
    typeof document.createTreeWalker === "function"
  );
}

/**
 * The token a finished selection names, when the selection is inside the pane and
 * covers a diff line.
 *
 * A collapsed selection (a plain click) reads as "no token", which is how the
 * highlight is dismissed. A selection that dragged across rows is not one token and
 * reads as null too, and so does a word picked out of a note or a line number.
 *
 * @param container - the comparison body the selection must start or end in.
 * @returns the token text, or null.
 */
export function selectedToken(container) {
  if (typeof window === "undefined" || typeof window.getSelection !== "function") return null;
  let selection;
  try {
    selection = window.getSelection();
  } catch (_error) {
    return null;
  }
  if (selection === null || selection === undefined) return null;
  if (selection.isCollapsed === true) return null;
  if (!inside(container, selection.anchorNode) && !inside(container, selection.focusNode))
    return null;
  if (!withinCode(selection.anchorNode) && !withinCode(selection.focusNode)) return null;
  return tokenOf(typeof selection.toString === "function" ? selection.toString() : "");
}

/**
 * Every match of a token in the lines on screen, as DOM ranges.
 *
 * Each `.dsc-code` run is matched as one line before the range is built, so a
 * qualified name that the tokenizer split into `sensor`, `::` and `LidarData` spans
 * is still one match.
 *
 * @param container - the comparison body.
 * @param token - the selected token.
 * @param doc - the document to build ranges with (tests pass a stub).
 * @returns the ranges, in reading order.
 */
export function collectRanges(container, token, doc) {
  const view = doc ?? (typeof document === "undefined" ? undefined : document);
  if (view === undefined || container === null || container === undefined) return [];
  const roots =
    typeof container.querySelectorAll === "function"
      ? Array.from(container.querySelectorAll(".dsc-code"))
      : [container];
  const ranges = [];
  for (const root of roots) {
    const parts = textParts(root, view);
    if (parts.length === 0) continue;
    const text = parts.map((part) => part.text).join("");
    for (const match of matchRanges(text, token)) {
      const from = atOffset(parts, match.start);
      const to = atOffset(parts, match.end);
      if (from === null || to === null) continue;
      const range = view.createRange();
      range.setStart(from.node, from.offset);
      range.setEnd(to.node, to.offset);
      ranges.push(range);
    }
  }
  return ranges;
}

/**
 * One element's text nodes, with their offsets in the element's text.
 * @param element - the `.dsc-code` element.
 * @param doc - the document to walk with.
 * @returns `{ node, text, start }` parts.
 */
function textParts(element, doc) {
  const parts = [];
  const walker = doc.createTreeWalker(element, SHOW_TEXT);
  let offset = 0;
  for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
    const text = node.nodeValue ?? "";
    if (text === "") continue;
    parts.push({ node, text, start: offset });
    offset += text.length;
  }
  return parts;
}

/**
 * The text node and offset that hold one character offset.
 * @param parts - the element's text parts.
 * @param offset - an offset in the joined text.
 * @returns `{ node, offset }`, or null when the element has no text.
 */
function atOffset(parts, offset) {
  for (const part of parts) {
    if (offset <= part.start + part.text.length)
      return { node: part.node, offset: offset - part.start };
  }
  const last = parts[parts.length - 1];
  return last === undefined ? null : { node: last.node, offset: last.text.length };
}

/**
 * Whether a node sits inside an element.
 * @param container - the element.
 * @param node - a selection anchor or focus node.
 * @returns true when it is a descendant.
 */
function inside(container, node) {
  if (container === null || container === undefined) return false;
  if (node === null || node === undefined) return false;
  return typeof container.contains === "function" && container.contains(node) === true;
}

/**
 * Whether a selection end sits in a diff line rather than in a note or a line number.
 * @param node - a selection anchor or focus node.
 * @returns true when the node is inside a `.dsc-code` run.
 */
function withinCode(node) {
  if (node === null || node === undefined) return false;
  const element = node.nodeType === 3 ? node.parentElement : node;
  if (element === null || element === undefined) return false;
  return typeof element.closest === "function" && element.closest(".dsc-code") !== null;
}
