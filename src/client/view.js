import { groupOverall } from "./grouping.js";

/**
 * The left list: every recorded turn folded into one row per file, plus the Session
 * totals the header shows. Turns arrive newest first from the Host; the rows are
 * built oldest first so each file keeps the turn order of the session.
 *
 * @param turns - recorded turns, newest first.
 * @returns `{ groups, files, added, deleted }`.
 */
export function buildView(turns) {
  const ordered = [...turns].reverse();
  if (ordered.length === 0) return { groups: [], files: 0, added: 0, deleted: 0 };
  let added = 0;
  let deleted = 0;
  for (const turn of ordered) {
    added += turn.added;
    deleted += turn.deleted;
  }
  const folded = groupOverall(ordered);
  return {
    groups: [{ folders: folded.folders }],
    files: folded.count,
    added,
    deleted,
  };
}
