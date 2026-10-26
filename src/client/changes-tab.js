import { DetailPane } from "./components/detail-pane.js";
import { ListPane } from "./components/list-pane.js";
import { buildListRows } from "./components/list-rows.js";
import { LAYOUT_KEY, REVIEW_PREFIX, WRAP_KEY } from "./constants.js";
import { useAutoRefresh } from "./hooks/use-auto-refresh.js";
import { useBase } from "./hooks/use-base.js";
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
import { readLayout, readWrap, writeStored } from "./storage.js";

/**
 * Recompute the view's session totals from the rows as they are shown, using the
 * live counts where they exist and the recorded ones everywhere else.
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
 * Drop the rows that no longer have anything to show: a file edited back to its
 * pre-image nets zero, so it is not "changed since this task started" and must not
 * linger as `+0 −0`. Rows the roll-up could not price keep their recorded counts
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
 * draggable divider. Every row answers the same question — what changed since this
 * task started — so the pane always diffs the Session's first pre-image against the
 * file as it stands now.
 *
 * @param props - `{ t, sessionId, tab }` from the sidebar tab system.
 */
export function ChangesTab(props) {
  const t = typeof props.t === "function" ? props.t : fallback;
  const sessionId = props.sessionId;
  const visible = props.tab === undefined ? true : props.tab.visible !== false;

  const [selected, setSelected] = react.useState(null);
  const [wrap, setWrap] = react.useState(readWrap);
  const [layout, setLayout] = react.useState(readLayout);
  const [opening, setOpening] = react.useState(false);
  const [openFailed, setOpenFailed] = react.useState(false);

  const { rootRef, left, dragging, startDrag, nudge } = useResizable();
  const feed = useChangesFeed({ sessionId, visible });

  /** Re-read the list and both sides of the comparison. */
  const refreshAll = () => feed.refresh();

  // The Host streams each invalidation; a 1s quiet period folds a save burst into
  // one re-read of the list and the open comparison.
  useAutoRefresh({ sessionId, visible, refresh: refreshAll });

  const view = useView({ turns: feed.state.turns });
  // The rows must number the same pre-image → current text the pane diffs.
  const liveCounts = useOverallCounts({
    sessionId,
    turns: feed.state.turns,
    nonce: feed.nonce,
  });
  const listView = liveCounts === null ? view : withoutUnchanged(view, liveCounts);
  useSelection({ view: listView, selected, setSelected });

  const activeEntry =
    selected === null || selected.entries.length === 0
      ? undefined
      : selected.entries[selected.entries.length - 1];
  const baseEntry =
    selected === null || selected.entries.length === 0 ? undefined : selected.entries[0];
  const wholeState = useWholeFile({
    sessionId,
    selected,
    entry: activeEntry,
    nonce: feed.nonce,
  });
  const baseState = useBase({ sessionId, selected, entry: baseEntry, nonce: feed.nonce });
  const newestSeq = feed.state.turns.length === 0 ? 0 : feed.state.turns[0].seq;
  const gonePaths = useExists({ sessionId, newestSeq, nonce: feed.nonce });
  const comparison = useComparison({ selected, wholeState, baseState });

  const toggleWrap = () => {
    setWrap((value) => {
      writeStored(WRAP_KEY, value === true ? "false" : "true");
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

  const rows = buildListRows({
    view: listView,
    gonePaths,
    selected,
    t,
    counts: liveCounts,
    onSelect: (selection) => setSelected(selection),
  });

  // The header totals follow the rows, so the list cannot report a stale sum.
  const paneView = liveCounts === null ? listView : totalsWith(listView, liveCounts);

  return h("div", { className: "dsc-root", "data-session-changes": true, ref: rootRef }, [
    h(ListPane, {
      t,
      state: feed.state,
      view: paneView,
      rows,
      busy: feed.state.phase === "loading",
      left,
      reverted: liveCounts !== null && feed.state.turns.length > 0,
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
      selected,
      activeEntry,
      layout,
      wrap,
      opening,
      openFailed,
      comparison,
      baseState,
      wholeState,
      onRetry: refreshAll,
      onToggleLayout: toggleLayout,
      onOpenFile: openInApp,
      onToggleWrap: toggleWrap,
      onOpenReview: openReview,
    }),
  ]);
}
