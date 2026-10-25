import { ROW_CAP } from "../constants.js";
import { highlightedSide } from "./highlight.js";
import { hunkRows, splitRows } from "./rows.js";

/**
 * Number, pair and highlight a comparison's hunks, stopping at {@link ROW_CAP}
 * drawn lines so one huge file cannot lock the render.
 *
 * @param text - the served text payload (`{ hunks }`).
 * @param highlighter - the theme-bound highlighter, or undefined for plain text.
 * @param shape - `split` pairs both sides of every row; `inline` keeps one row.
 * @returns `{ blocks, truncated }`, one block per hunk.
 */
export function buildDiffModel(text, highlighter, shape) {
  const hunks = Array.isArray(text.hunks) ? text.hunks : [];
  let budget = ROW_CAP;
  const blocks = [];
  let truncated = false;
  for (const hunk of hunks) {
    if (budget <= 0) {
      truncated = true;
      break;
    }
    const kept =
      hunk.lines.length <= budget ? hunk : { ...hunk, lines: hunk.lines.slice(0, budget) };
    budget -= kept.lines.length;
    if (kept !== hunk) truncated = true;
    const numbered = hunkRows(kept);
    let marks;
    if (highlighter !== undefined)
      marks = {
        old: highlightedSide(numbered, "old", highlighter),
        new: highlightedSide(numbered, "new", highlighter),
      };
    blocks.push({
      hunk: kept,
      rows: shape === "split" ? splitRows(numbered) : numbered,
      marks,
    });
  }
  return { blocks, truncated };
}
