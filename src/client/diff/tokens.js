/**
 * Token-level matching for the comparison: which identifier a selection names, and
 * where that identifier repeats on the lines the pane draws.
 *
 * A token is one identifier, optionally qualified the way C++/Rust/JS spell a path:
 * `motorState`, `motor_state`, `sensor::LidarData`, `config.motorState`,
 * `ptr->value`. Matching is bounded by identifier characters, so `motorState` does
 * not light up inside `motorStateCache`, while selecting only `LidarData` still
 * matches the tail of `sensor::LidarData` (the `:` before it is a boundary).
 */

/** Longer selections are prose, not an identifier; refuse them before building a regex. */
const MAX_TOKEN_LENGTH = 200;

/** One identifier, with any number of `::`, `.` or `->` qualified segments after it. */
const TOKEN =
  /^(?:::)?[\p{ID_Start}_$][\p{ID_Continue}$]*(?:(?:::|->|\.)[\p{ID_Start}_$][\p{ID_Continue}$]*)*$/u;

/** Identifier characters on either side of a match, so a prefix is not a hit. */
const BEFORE = "(?<![\\p{ID_Continue}$])";
const AFTER = "(?![\\p{ID_Continue}$])";

/** The patterns already built, bounded so a long Session cannot grow this forever. */
const patterns = new Map();

/**
 * The token a piece of selected text names.
 *
 * The browser's selection may include the spaces around a double-clicked word, so
 * the text is trimmed first; a tab, newline, or any other whitespace inside means
 * the selection crossed more than one token.
 *
 * @param text - the selection's text.
 * @returns the token, or null when the selection is not a single token.
 */
export function tokenOf(text) {
  if (typeof text !== "string") return null;
  const trimmed = text.trim();
  if (trimmed === "" || trimmed.length > MAX_TOKEN_LENGTH) return null;
  if (/\s/u.test(trimmed)) return null;
  return TOKEN.test(trimmed) ? trimmed : null;
}

/**
 * The pattern that finds a token on a line.
 * @param token - a token from {@link tokenOf}.
 * @returns a global pattern; its `lastIndex` is reset before every use.
 */
export function patternFor(token) {
  let pattern = patterns.get(token);
  if (pattern === undefined) {
    if (patterns.size >= 32) patterns.clear();
    pattern = new RegExp(BEFORE + escapeRegExp(token) + AFTER, "gu");
    patterns.set(token, pattern);
  }
  pattern.lastIndex = 0;
  return pattern;
}

/**
 * Every match of a token in one line.
 * @param text - the line's text.
 * @param token - a token from {@link tokenOf}, or null.
 * @returns `{ start, end }` offsets into `text`.
 */
export function matchRanges(text, token) {
  if (typeof text !== "string" || text === "") return [];
  if (token === null || token === undefined || token === "") return [];
  const ranges = [];
  for (const match of text.matchAll(patternFor(token)))
    ranges.push({ start: match.index, end: match.index + match[0].length });
  return ranges;
}

/**
 * Cut a line into plain, styled spans, with the matched pieces marked.
 *
 * The line is matched as a whole before the cut, so a qualified name is found even
 * when the tokenizer split it across spans (`sensor`, `::`, `LidarData`).
 *
 * @param spans - `{ text, style }` pieces, in order.
 * @param matches - the line's matches, from {@link matchRanges}.
 * @returns the pieces, each with `hit` true for a match.
 */
export function sliceSpans(spans, matches) {
  const out = [];
  let offset = 0;
  for (const span of spans) {
    const start = offset;
    const end = offset + span.text.length;
    let at = start;
    for (const match of matches) {
      if (match.end <= start || match.start >= end) continue;
      const from = Math.max(match.start, start);
      const to = Math.min(match.end, end);
      if (from > at)
        out.push({
          text: span.text.slice(at - start, from - start),
          style: span.style,
          hit: false,
        });
      out.push({ text: span.text.slice(from - start, to - start), style: span.style, hit: true });
      at = to;
    }
    if (at < end) out.push({ text: span.text.slice(at - start), style: span.style, hit: false });
    offset = end;
  }
  return out;
}

/**
 * A line with no syntax spans, cut into plain and marked pieces.
 * @param text - the line's text.
 * @param token - a token from {@link tokenOf}, or null.
 * @returns the pieces, or null when the token does not occur on the line.
 */
export function linePieces(text, token) {
  const matches = matchRanges(text, token);
  if (matches.length === 0) return null;
  return sliceSpans([{ text }], matches);
}

/**
 * Escape the regex metacharacters a token may contain (`->`, `.`, `::` need care).
 * @param text - the literal text.
 * @returns the text, safe to embed in a pattern.
 */
function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
