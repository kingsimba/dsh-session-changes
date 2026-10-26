import { readBase, readWholeFile } from "../api.js";
import { countChangedLines } from "../diff/counts.js";
import { react } from "../react.js";

/** Most files one roll-up reads; the rest keep no live numbers. */
export const COUNT_CAP = 60;

/** Largest text worth diffing just to number a row. */
const MAX_COUNT_CHARS = 1000000;

/** Lines in one text, counting a trailing newline as this diff engine does. */
function lineCount(text) {
  return text === "" ? 0 : text.split("\n").length;
}

/**
 * Live `+added/−deleted` counts for the rows, plus what the row cannot show: a path
 * that vanished, a binary file, or one too large to read.
 *
 * The pane diffs the stored pre-image against the file as it stands now, so the list
 * numbers the same pair. One read per file (the pre-image is cached for the Session,
 * it never changes), capped so a large Session cannot turn a refresh into a scan.
 *
 * @param input - `{ sessionId, files, nonce }`; `nonce` re-runs the read.
 * @returns `{ [path]: { added, deleted, missing, binary, oversized } }`.
 */
export function useFileCounts({ sessionId, files, nonce }) {
  const [counts, setCounts] = react.useState({});
  const bases = react.useRef(new Map());

  react.useEffect(() => {
    if (typeof sessionId !== "string" || sessionId === "") {
      setCounts({});
      return undefined;
    }
    let live = true;
    const controller = new AbortController();
    const targets = files.slice(0, COUNT_CAP);

    void (async () => {
      const next = {};
      await Promise.all(
        targets.map(async (file) => {
          const key = String(sessionId) + ":" + file.path;
          try {
            let before = bases.current.get(key);
            if (before === undefined) {
              const base = await readBase(sessionId, file.path, controller.signal);
              before = base.absent === true ? "" : base.text;
              bases.current.set(key, before);
            }
            if (before.length > MAX_COUNT_CHARS) return;
            const after = await readWholeFile(sessionId, file.path, controller.signal);
            if (after.length > MAX_COUNT_CHARS) return;
            next[file.path] = countChangedLines(before, after);
          } catch (error) {
            if (controller.signal.aborted) return;
            const known = error !== null && error !== undefined;
            if (known && error.missing === true) {
              // A vanished path reads as "everything deleted", like the pane.
              const before = bases.current.get(key);
              next[file.path] =
                typeof before === "string"
                  ? { added: 0, deleted: lineCount(before), missing: true }
                  : { missing: true };
            } else if (known && error.binary === true) {
              next[file.path] = { binary: true };
            } else if (known && error.oversized === true) {
              next[file.path] = { oversized: true };
            }
            // No pre-image or an unreadable path: leave the row without numbers.
          }
        }),
      );
      if (live && !controller.signal.aborted) setCounts(next);
    })();

    return () => {
      live = false;
      controller.abort();
    };
  }, [sessionId, files, nonce]);

  return counts;
}
