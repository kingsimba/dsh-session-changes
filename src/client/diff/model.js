import { ROW_CAP } from "../constants.js";
import { hunkBlocks } from "./blocks.js";
import { highlightedSide } from "./highlight.js";
import { hunkRows, splitRows } from "./rows.js";

/**
 * Number, pair and highlight a comparison's hunks, stopping at {@link ROW_CAP}
 * drawn lines so one huge file cannot lock the render.
 *
 * Each hunk also yields its change blocks, and every changed numbered row keeps a
 * reference to its block, so either layout can draw the block's accept/revert
 * buttons without recomputing the ranges. A hunk cut by the row budget marks its
 * blocks `editable: false`: their ranges would be incomplete.
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
  for (let hunkAt = 0; hunkAt < hunks.length; hunkAt += 1) {
    const hunk = hunks[hunkAt];
    if (budget <= 0) {
      truncated = true;
      break;
    }
    const kept =
      hunk.lines.length <= budget ? hunk : { ...hunk, lines: hunk.lines.slice(0, budget) };
    budget -= kept.lines.length;
    const cut = kept !== hunk;
    if (cut) truncated = true;
    const numbered = hunkRows(kept);
    const changes = hunkBlocks(kept).map((block, at) => ({
      ...block,
      key: String(hunkAt) + ":" + String(at),
      editable: cut !== true,
    }));
    for (const block of changes)
      for (let at = block.from; at <= block.to; at += 1) numbered[at].block = block;
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
      changes,
    });
  }
  return { blocks, truncated };
}
