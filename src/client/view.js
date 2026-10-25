import { groupFiles, groupOverall } from "./grouping.js";

/**
 * The left list for the current mode, plus the Session totals the header shows.
 *
 * Turns arrive newest first from the Host; the strip reads them oldest first, like
 * a timeline, so this is the one place the order is flipped.
 *
 * @param turns - recorded turns, newest first.
 * @param mode - `turn` or `overall`.
 * @param turnFilter - the turn the By-turn list should show; 0 means the newest.
 * @returns `{ groups, turns, added, deleted, files }`.
 */
export function buildView(turns, mode, turnFilter) {
  const ordered = [...turns].reverse();
  if (ordered.length === 0) return { groups: [], turns: [], added: 0, deleted: 0, files: 0 };
  if (mode === "overall") {
    let added = 0;
    let deleted = 0;
    for (const turn of ordered) {
      added += turn.added;
      deleted += turn.deleted;
    }
    const folded = groupOverall(ordered);
    return {
      groups: [{ turn: undefined, total: folded.count, folders: folded.folders }],
      turns: ordered.map((turn) => ({ turn: turn.turn, total: turn.total })),
      added,
      deleted,
      files: folded.count,
    };
  }
  // By turn: the list follows the chosen turn, defaulting to the newest one.
  const active = ordered.find((turn) => turn.turn === turnFilter) ?? ordered[ordered.length - 1];
  return {
    groups: [
      {
        turn: active.turn,
        total: active.total,
        folders: groupFiles(Array.isArray(active.files) ? active.files : [], (index) => ({
          seq: active.seq,
          turn: active.turn,
          index,
        })),
      },
    ],
    turns: ordered.map((turn) => ({ turn: turn.turn, total: turn.total })),
    added: active.added,
    deleted: active.deleted,
    files: active.total,
  };
}
