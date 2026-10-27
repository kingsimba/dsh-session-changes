import { readBase, readWholeFile } from "../api.js";
import { countChangedLines } from "../diff/counts.js";
import { react } from "../react.js";
import { readCounts, writeCounts } from "../session-memory.js";

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
 * Accepting a block rewrites that pre-image, so `baseVersion` drops the cache and
 * reads the bases again; `apply` updates one row straight from the texts a block
 * action already has, without a re-read.
 *
 * @param input - `{ sessionId, files, nonce, baseVersion }`; `nonce` re-runs the
 *   read, and a new `baseVersion` also forgets the cached pre-images.
 * @returns `{ counts, apply, forget }`: the per-path counts, a local updater, and a
 *   way to drop rows a whole-file or whole-list action settled.
 */
export function useFileCounts({ sessionId, files, nonce, baseVersion }) {
  // Seed from the Session's remembered counts, so a tab remounted by a Session
  // switch shows numbers immediately and a fully accepted file stays hidden.
  const [counts, setCounts] = react.useState(() => readCounts(sessionId));
  const latest = react.useRef(counts);
  latest.current = counts;
  const bases = react.useRef(new Map());
  const version = react.useRef(baseVersion);
  // Bumped by `apply`, so a read that started earlier cannot overwrite fresher data.
  const generation = react.useRef(0);

  react.useEffect(() => {
    if (version.current !== baseVersion) {
      bases.current.clear();
      version.current = baseVersion;
    }
    if (typeof sessionId !== "string" || sessionId === "") {
      setCounts({});
      return undefined;
    }
    const targets = files.slice(0, COUNT_CAP);
    // Before the list arrives there is nothing to read; keep the remembered counts
    // instead of replacing them with an empty object.
    if (targets.length === 0) return undefined;
    let live = true;
    const controller = new AbortController();
    const at = generation.current;
    const loaded = new Map();

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
              loaded.set(key, before);
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
              const before = bases.current.get(key) ?? loaded.get(key);
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
      if (!live || controller.signal.aborted || generation.current !== at) return;
      for (const [key, value] of loaded) bases.current.set(key, value);
      writeCounts(sessionId, next);
      setCounts(next);
    })();

    return () => {
      live = false;
      controller.abort();
    };
  }, [sessionId, files, nonce, baseVersion]);

  /**
   * Replace one row's numbers and cached pre-image with the texts a block action
   * already produced. Ignored for texts too large to have had live numbers.
   *
   * @param path - the file's path as the list spells it.
   * @param before - the new pre-image text.
   * @param after - the current text the row should be numbered against.
   * @param extra - flags the row needs (`{ missing: true }`).
   */
  const apply = (path, before, after, extra) => {
    const key = String(sessionId) + ":" + path;
    generation.current += 1;
    bases.current.set(key, before);
    if (before.length > MAX_COUNT_CHARS || after.length > MAX_COUNT_CHARS) return;
    const numbered = countChangedLines(before, after);
    // A row with nothing left to show is dropped even when the path is missing:
    // accepting every deletion of a removed file leaves no change to report.
    const shown =
      extra !== undefined && numbered.added === 0 && numbered.deleted === 0 ? undefined : extra;
    const next = {
      ...latest.current,
      [path]: shown === undefined ? numbered : { ...numbered, ...shown },
    };
    writeCounts(sessionId, next);
    setCounts(next);
  };

  /**
   * Drop rows that a whole-file or whole-list action just settled, without waiting
   * for the re-read. Their pre-images are updated separately; the remaining counts
   * are confirmed by the refresh that follows.
   *
   * @param paths - one path, or a list of paths.
   */
  const forget = (paths) => {
    const list = Array.isArray(paths) ? paths : [paths];
    if (list.length === 0) return;
    generation.current += 1;
    const next = { ...latest.current };
    for (const path of list) next[path] = { added: 0, deleted: 0 };
    writeCounts(sessionId, next);
    setCounts(next);
  };

  return { counts, apply, forget };
}
