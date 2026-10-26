import { readBase, readWholeFile } from "../api.js";
import { countChangedLines } from "../diff/counts.js";
import { react } from "../react.js";

/** Most files one roll-up reads; the rest keep their recorded totals. */
export const OVERALL_COUNT_CAP = 40;

/** Largest text worth diffing just to number a row. */
const MAX_COUNT_CHARS = 1000000;

/**
 * Live `+added/−deleted` counts for the rows.
 *
 * The pane diffs the stored pre-image against the file as it stands now, so the list
 * has to number the same thing: summing the recorded turns would leave a freshly
 * edited file showing yesterday's counts beside a diff that already grew. One read
 * per listed file (the pre-image is cached for the Session, it never changes),
 * capped so a large Session cannot turn a refresh into a scan.
 *
 * Files the roll-up cannot price — no pre-image, binary, oversized, unreadable —
 * keep the recorded counts, and `null` means "no live counts at all".
 *
 * @param input - `{ sessionId, turns, nonce }`; `nonce` re-runs the read.
 * @returns `{ [path]: { added, deleted } }`, or null before the first read.
 */
export function useOverallCounts({ sessionId, turns, nonce }) {
  const [counts, setCounts] = react.useState(null);
  const bases = react.useRef(new Map());

  react.useEffect(() => {
    if (typeof sessionId !== "string" || sessionId === "") {
      setCounts(null);
      return undefined;
    }
    let live = true;
    const controller = new AbortController();
    const targets = [];
    const seen = new Set();
    for (const turn of turns) {
      for (const file of Array.isArray(turn.files) ? turn.files : []) {
        const path = String(file.path);
        if (seen.has(path)) continue;
        seen.add(path);
        if (file.binary === true || file.oversized === true) continue;
        targets.push({ path, seq: turn.seq });
        if (targets.length >= OVERALL_COUNT_CAP) break;
      }
      if (targets.length >= OVERALL_COUNT_CAP) break;
    }

    void (async () => {
      const next = {};
      await Promise.all(
        targets.map(async ({ path, seq }) => {
          try {
            const key = String(sessionId) + ":" + path;
            let before = bases.current.get(key);
            if (before === undefined) {
              const base = await readBase(sessionId, seq, path, controller.signal);
              before = base.absent === true ? "" : base.text;
              bases.current.set(key, before);
            }
            if (before.length > MAX_COUNT_CHARS) return;
            const after = await readWholeFile(sessionId, seq, path, controller.signal).catch(
              (error) => {
                // A vanished path reads as "everything deleted", like the pane.
                if (error !== null && error !== undefined && error.missing === true) return "";
                throw error;
              },
            );
            if (after.length > MAX_COUNT_CHARS) return;
            next[path] = countChangedLines(before, after);
          } catch (_error) {
            // No captured pre-image or an unreadable path: keep the recorded count.
          }
        }),
      );
      if (live && !controller.signal.aborted) setCounts(next);
    })();

    return () => {
      live = false;
      controller.abort();
    };
  }, [sessionId, turns, nonce]);

  return counts;
}
