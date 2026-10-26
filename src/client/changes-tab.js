import { DetailPane } from "./components/detail-pane.js";
import { ListPane } from "./components/list-pane.js";
import { buildListRows, buildRows } from "./components/list-rows.js";
import { LAYOUT_KEY, WHOLE_KEY, WRAP_KEY } from "./constants.js";
import { useAutoRefresh } from "./hooks/use-auto-refresh.js";
import { useBase } from "./hooks/use-base.js";
import { useComparison } from "./hooks/use-comparison.js";
import { useFileCounts } from "./hooks/use-file-counts.js";
import { useFileList } from "./hooks/use-file-list.js";
import { useResizable } from "./hooks/use-resizable.js";
import { useSelection } from "./hooks/use-selection.js";
import { useWholeFile } from "./hooks/use-whole-file.js";
import { fallback } from "./locale/fallback.js";
import { h, react } from "./react.js";
import { readLayout, readWhole, readWrap, writeStored } from "./storage.js";
import { requestOpen } from "./api.js";

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

  const [selectedPath, setSelectedPath] = react.useState(null);
  const [wrap, setWrap] = react.useState(readWrap);
  const [whole, setWhole] = react.useState(readWhole);
  const [layout, setLayout] = react.useState(readLayout);
  const [opening, setOpening] = react.useState(false);
  const [openFailed, setOpenFailed] = react.useState(false);

  const { rootRef, left, dragging, startDrag, nudge } = useResizable();
  const list = useFileList({ sessionId, visible });
  const counts = useFileCounts({ sessionId, files: list.state.files, nonce: list.nonce });

  /** Re-read the list and both sides of the comparison. */
  const refreshAll = () => list.refresh();

  // The Host streams each invalidation; a 1s quiet period folds a save burst into
  // one re-read of the list and the open comparison.
  useAutoRefresh({ sessionId, visible, refresh: refreshAll });

  const rows = buildRows(list.state.files, counts);
  useSelection({ rows, selectedPath, setSelectedPath });
  const selected =
    selectedPath === null ? null : (rows.find((row) => row.path === selectedPath) ?? null);
  const baseState = useBase({ sessionId, path: selectedPath, nonce: list.nonce });
  const wholeState = useWholeFile({ sessionId, path: selectedPath, nonce: list.nonce });
  const comparison = useComparison({ selected, wholeState, baseState });

  const totals = rows.reduce(
    (sum, row) => ({
      added: sum.added + (row.added ?? 0),
      deleted: sum.deleted + (row.deleted ?? 0),
    }),
    { added: 0, deleted: 0 },
  );

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

  const toggleWhole = () => {
    setWhole((value) => {
      writeStored(WHOLE_KEY, value === true ? "false" : "true");
      return value !== true;
    });
  };

  /** Ask the Host desktop to open the selected file in its default application. */
  const openInApp = () => {
    if (selectedPath === null || opening) return;
    setOpening(true);
    setOpenFailed(false);
    requestOpen(sessionId, selectedPath)
      .catch(() => setOpenFailed(true))
      .finally(() => setOpening(false));
  };

  const listRows = buildListRows({
    rows,
    selectedPath,
    t,
    onSelect: setSelectedPath,
  });

  return h("div", { className: "dsc-root", "data-session-changes": true, ref: rootRef }, [
    h(ListPane, {
      t,
      state: list.state,
      totals,
      rows: listRows,
      busy: list.state.phase === "loading",
      left,
      reverted: rows.length === 0 && list.state.files.length > 0,
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
      layout,
      whole,
      wrap,
      opening,
      openFailed,
      comparison,
      baseState,
      onToggleLayout: toggleLayout,
      onToggleWhole: toggleWhole,
      onOpenFile: openInApp,
      onToggleWrap: toggleWrap,
    }),
  ]);
}
