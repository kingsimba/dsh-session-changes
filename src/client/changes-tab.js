import { DetailPane } from "./components/detail-pane.js";
import { ListPane } from "./components/list-pane.js";
import { buildListRows } from "./components/list-rows.js";
import { LAYOUT_KEY, MODE_KEY, REVIEW_PREFIX, WHOLE_KEY, WRAP_KEY } from "./constants.js";
import { useBase } from "./hooks/use-base.js";
import { useAutoRefresh } from "./hooks/use-auto-refresh.js";
import { useChangesFeed } from "./hooks/use-changes-feed.js";
import { useComparison } from "./hooks/use-comparison.js";
import { useExists } from "./hooks/use-exists.js";
import { useOverallCounts } from "./hooks/use-overall-counts.js";
import { useResizable } from "./hooks/use-resizable.js";
import { useSelection } from "./hooks/use-selection.js";
import { useView } from "./hooks/use-view.js";
import { useWholeFile } from "./hooks/use-whole-file.js";
import { fallback } from "./locale/fallback.js";
import { openResource } from "./open-resource.js";
import { h, react } from "./react.js";
import { requestOpen } from "./api.js";
import { activeEntryOf, entryKey } from "./selection.js";
import { readLayout, readMode, readWhole, readWrap, writeStored } from "./storage.js";

/**
 * Recompute the view's session totals from the rows as they are shown, using the
 * live Overall counts where they exist and the recorded ones everywhere else.
 *
 * @param view - the current view.
 * @param counts - `{ [path]: { added, deleted } }`.
 * @returns a view with the same groups and new totals.
 */
function totalsWith(view, counts) {
  let added = 0;
  let deleted = 0;
  for (const group of view.groups) {
    for (const folder of group.folders) {
      for (const row of folder.files) {
        const live = counts[row.file.path];
        added += live === undefined ? row.file.added : live.added;
        deleted += live === undefined ? row.file.deleted : live.deleted;
      }
    }
  }
  return { ...view, added, deleted };
}

/**
 * Drop the rows Overall no longer has anything to show for: a file edited back to
 * its pre-image nets zero, so it is not "changed since this task started" and must
 * not linger as `+0 −0`. Rows the roll-up could not price keep their recorded counts
 * and stay. A folder left with no rows goes with them.
 *
 * @param view - the current view.
 * @param counts - `{ [path]: { added, deleted } }`.
 * @returns a view with the unchanged rows filtered out.
 */
function withoutUnchanged(view, counts) {
  const groups = [];
  let files = 0;
  for (const group of view.groups) {
    const folders = [];
    for (const folder of group.folders) {
      const kept = folder.files.filter((row) => {
        const live = counts[row.file.path];
        return live === undefined || live.added > 0 || live.deleted > 0;
      });
      if (kept.length === 0) continue;
      files += kept.length;
      folders.push({ ...folder, files: kept });
    }
    groups.push({ ...group, folders });
  }
  return { ...view, groups, files, total: files };
}

/**
 * Master list on the left, the selected file's comparison on the right, one
 * draggable divider. All state lives here; the panes are presentational, and every
 * read has its own hook.
 *
 * @param props - `{ t, sessionId, tab }` from the sidebar tab system.
 */
export function ChangesTab(props) {
  const t = typeof props.t === "function" ? props.t : fallback;
  const sessionId = props.sessionId;
  const visible = props.tab === undefined ? true : props.tab.visible !== false;

  const [mode, setMode] = react.useState(readMode);
  const [selected, setSelected] = react.useState(null);
  const [entryIndex, setEntryIndex] = react.useState(0);
  const [turnFilter, setTurnFilter] = react.useState(0);
  const [wrap, setWrap] = react.useState(readWrap);
  const [whole, setWhole] = react.useState(readWhole);
  const [layout, setLayout] = react.useState(readLayout);
  const [wholeNonce, setWholeNonce] = react.useState(0);
  const [opening, setOpening] = react.useState(false);
  const [openFailed, setOpenFailed] = react.useState(false);

  const { rootRef, left, dragging, startDrag, nudge } = useResizable();
  const feed = useChangesFeed({ sessionId, visible, selected });

  /**
   * Re-read everything the pane shows: the turn list and the per-turn hunks
   * (`feed.nonce`), plus the whole-file and pre-image sides of the comparison
   * (`wholeNonce`). The whole-file side is a separate read because `Full` and
   * `Overall` compare against text read from the disk, not against a hunk.
   */
  const refreshAll = () => {
    feed.refresh();
    setWholeNonce((value) => value + 1);
  };

  // The Host streams each invalidation; a 1s quiet period folds a save burst into
  // one re-read of the list and the open comparison.
  useAutoRefresh({ sessionId, visible, refresh: refreshAll });
  const view = useView({ turns: feed.state.turns, mode, turnFilter });
  // Overall's rows must number the same pre-image → current text the pane diffs.
  const liveCounts = useOverallCounts({
    sessionId,
    mode,
    turns: feed.state.turns,
    nonce: feed.nonce,
  });
  // A file edited back to its pre-image nets zero: Overall is not showing it any
  // more, so its row and its folder leave the list instead of reading `+0 −0`.
  const listView = liveCounts === null ? view : withoutUnchanged(view, liveCounts);
  useSelection({ view: listView, mode, selected, setSelected, setEntryIndex });
  const wholeState = useWholeFile({
    sessionId,
    whole,
    mode,
    selected,
    entryIndex,
    nonce: wholeNonce,
  });
  const baseState = useBase({ sessionId, mode, selected, nonce: wholeNonce });
  const newestSeq = feed.state.turns.length === 0 ? 0 : feed.state.turns[0].seq;
  const gonePaths = useExists({ sessionId, newestSeq, nonce: feed.nonce, wholeNonce });
  const comparison = useComparison({
    mode,
    selected,
    diffs: feed.diffs,
    wholeState,
    baseState,
    view,
  });

  const activeEntry = activeEntryOf(selected, entryIndex);
  /** The turn the list is showing; the chip highlight follows it. */
  const displayedTurn = view.groups.length === 0 ? undefined : view.groups[0].turn;

  const setModeAndStore = (next) => {
    writeStored(MODE_KEY, next);
    setMode(next);
  };

  const toggleWrap = () => {
    setWrap((value) => {
      writeStored(WRAP_KEY, value === true ? "false" : "true");
      return value !== true;
    });
  };

  const toggleWhole = () => {
    setWhole((value) => {
      writeStored(WHOLE_KEY, value === true ? "false" : "true");
      return value !== true;
    });
  };

  const toggleLayout = () => {
    setLayout((value) => {
      const next = value === "inline" ? "split" : "inline";
      writeStored(LAYOUT_KEY, next);
      return next;
    });
  };

  /** Open the same comparison in the existing review tab. */
  const openReview = () => {
    if (activeEntry === undefined) return;
    const address =
      REVIEW_PREFIX +
      encodeURIComponent(String(sessionId)) +
      "/" +
      String(activeEntry.seq) +
      "/" +
      String(activeEntry.turn);
    const actions = props.tab === undefined ? undefined : props.tab.actions;
    const options = { params: { index: activeEntry.index } };
    if (actions !== undefined && typeof actions.openResource === "function")
      actions.openResource(address, options);
    else openResource(address, options);
  };

  /** Ask the Host desktop to open the current file in its default application. */
  const openInApp = () => {
    if (activeEntry === undefined || opening) return;
    setOpening(true);
    setOpenFailed(false);
    requestOpen(sessionId, activeEntry)
      .catch(() => setOpenFailed(true))
      .finally(() => setOpening(false));
  };

  /** Forget the failed comparison and read it again. */
  const retryPayload = () => {
    if (activeEntry === undefined) return;
    feed.retryEntry(entryKey(activeEntry));
    setWholeNonce((value) => value + 1);
  };

  const rows = buildListRows({
    view: listView,
    gonePaths,
    selected,
    mode,
    t,
    counts: liveCounts,
    onSelect: (selection, index) => {
      setSelected(selection);
      setEntryIndex(index);
    },
  });

  // The header totals follow the rows, so Overall cannot report a stale sum.
  const paneView = liveCounts === null ? listView : totalsWith(listView, liveCounts);

  return h("div", { className: "dsc-root", "data-session-changes": true, ref: rootRef }, [
    h(ListPane, {
      t,
      state: feed.state,
      view: paneView,
      rows,
      mode,
      busy: feed.state.phase === "loading",
      left,
      reverted: mode === "overall" && liveCounts !== null && feed.state.turns.length > 0,
      onMode: setModeAndStore,
      onRefresh: refreshAll,
    }),
    h("div", {
      className: "dsc-divider",
      key: "d",
      role: "separator",
      tabIndex: 0,
      "aria-orientation": "vertical",
      "aria-label": t("resize"),
      "data-dragging": dragging === true ? "true" : "false",
      onPointerDown: startDrag,
      onKeyDown: nudge,
    }),
    h(DetailPane, {
      t,
      mode,
      turns: view.turns,
      activeTurn: displayedTurn,
      onPickTurn: setTurnFilter,
      selected,
      activeEntry,
      layout,
      whole,
      wrap,
      opening,
      openFailed,
      comparison,
      diffs: feed.diffs,
      baseState,
      wholeState,
      onRetry: retryPayload,
      onToggleLayout: toggleLayout,
      onToggleWhole: toggleWhole,
      onOpenFile: openInApp,
      onToggleWrap: toggleWrap,
      onOpenReview: openReview,
    }),
  ]);
}
