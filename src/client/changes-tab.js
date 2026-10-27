import { DetailPane } from "./components/detail-pane.js";
import { ListPane } from "./components/list-pane.js";
import { buildListRows, buildRows } from "./components/list-rows.js";
import { LAYOUT_KEY, WHOLE_KEY, WRAP_KEY } from "./constants.js";
import { newClientId } from "./client-id.js";
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
import { hashText, spliceLines } from "./text-patch.js";
import { requestApply, requestApplyAll, requestApplyFile, requestOpen } from "./api.js";

/**
 * Master list on the left, the selected file's comparison on the right, one
 * draggable divider. Every row answers the same question — what changed since this
 * task started — so the pane always diffs the Session's first pre-image against the
 * file as it stands now.
 *
 * Each change block in the comparison can be accepted (folded into the stored
 * pre-image) or reverted (the pre-image's lines written back to the live file). The
 * block's new full text is computed here from the two texts the pane already read,
 * and the Host writes it only when its digest still matches, so an action cannot
 * clobber an edit that landed after the diff was drawn.
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
  const [busyKey, setBusyKey] = react.useState(null);
  const [actionError, setActionError] = react.useState(null);
  const [baseVersion, setBaseVersion] = react.useState(0);
  const [confirmRevertAll, setConfirmRevertAll] = react.useState(false);

  // One id per mounted tab: the Host leaves this tab's own write echoes out of its
  // watch stream, so an action refreshes once instead of twice.
  const clientIdRef = react.useRef(null);
  if (clientIdRef.current === null) clientIdRef.current = newClientId();
  const clientId = clientIdRef.current;

  const { rootRef, left, dragging, startDrag, nudge } = useResizable();
  const list = useFileList({ sessionId, visible });
  const counts = useFileCounts({
    sessionId,
    files: list.state.files,
    nonce: list.nonce,
    baseVersion,
  });

  /** Re-read the list and both sides of the comparison. */
  const refreshAll = () => list.refresh();

  // The Host streams each invalidation; a 1s quiet period folds a save burst into
  // one re-read of the list and the open comparison.
  useAutoRefresh({ sessionId, visible, refresh: refreshAll, clientId });

  const rows = buildRows(list.state.files, counts);
  const hasRows = rows.length > 0;
  useSelection({ rows, selectedPath, setSelectedPath });
  const selected =
    selectedPath === null ? null : (rows.find((row) => row.path === selectedPath) ?? null);
  const baseState = useBase({ sessionId, path: selectedPath, nonce: list.nonce });
  const wholeState = useWholeFile({ sessionId, path: selectedPath, nonce: list.nonce });
  const comparison = useComparison({ selected, wholeState, baseState });

  // A different file has different blocks; a stale failure message would not apply.
  react.useEffect(() => {
    setActionError(null);
  }, [selectedPath]);

  // Nothing left to revert: the whole-list confirmation has no subject any more.
  react.useEffect(() => {
    if (hasRows !== true) setConfirmRevertAll(false);
  }, [hasRows]);

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

  /**
   * Explain a refused action, then re-read so the pane matches what the Host holds.
   * A stale-view refusal says so; anything else is a plain failure.
   * @param error - the refusal from the Host.
   */
  const reportActionError = (error) => {
    const conflict = error !== null && error !== undefined && error.conflict === true;
    setActionError(conflict === true ? t("applyConflict") : t("applyFailed"));
    refreshAll();
  };

  /**
   * Accept or revert one change block. Accept replaces the block's old range in the
   * stored pre-image with its added lines; revert replaces the block's new range in
   * the live file with its deleted lines.
   *
   * @param action - `accept` or `revert`.
   * @param block - the change block the buttons belong to.
   */
  const applyBlock = (action, block) => {
    if (busyKey !== null || selectedPath === null) return;
    const side = action === "accept" ? baseState : wholeState;
    if (side === undefined || side === null) return;
    const source =
      side.phase === "ready"
        ? side.absent === true
          ? ""
          : side.text
        : side.phase === "missing"
          ? ""
          : null;
    if (source === null) return;
    const start = action === "accept" ? block.oldStart : block.newStart;
    const count = action === "accept" ? block.oldLines : block.newLines;
    const lines = action === "accept" ? block.added : block.deleted;
    const text = spliceLines(source, start - 1, count, lines);
    setBusyKey(block.key);
    setActionError(null);
    hashText(source)
      .then((expect) =>
        requestApply({ sessionId, path: selectedPath, action, text, expect, source: clientId }),
      )
      .then(() => {
        // The pre-image changed: the row counts' cached copy of it is stale too.
        if (action === "accept") setBaseVersion((value) => value + 1);
        refreshAll();
      })
      .catch(reportActionError)
      .finally(() => setBusyKey(null));
  };

  /**
   * Accept or revert every change in one listed file at once. The Host decides the
   * whole content from the files it holds, so this is safe for binary files too.
   *
   * @param action - `accept` or `revert`.
   * @param path - the listed file's path.
   */
  const applyFile = (action, path) => {
    if (busyKey !== null) return;
    setBusyKey("file:" + path);
    setActionError(null);
    requestApplyFile({ sessionId, path, action, source: clientId })
      .then(() => {
        if (action === "accept") setBaseVersion((value) => value + 1);
        refreshAll();
      })
      .catch(reportActionError)
      .finally(() => setBusyKey(null));
  };

  /**
   * Accept or revert the whole list in one request.
   * @param action - `accept` or `revert`.
   */
  const applyAll = (action) => {
    if (busyKey !== null) return;
    setBusyKey("all");
    setActionError(null);
    setConfirmRevertAll(false);
    requestApplyAll({ sessionId, action, source: clientId })
      .then((result) => {
        if (action === "accept") setBaseVersion((value) => value + 1);
        if (result !== null && typeof result === "object" && (result.failed ?? 0) > 0) {
          setActionError(t("applyPartial", { count: String(result.failed) }));
        }
        refreshAll();
      })
      .catch(reportActionError)
      .finally(() => setBusyKey(null));
  };

  const listRows = buildListRows({
    rows,
    selectedPath,
    t,
    onSelect: setSelectedPath,
    onAction: applyFile,
    busy: busyKey !== null,
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
      actionBusy: busyKey !== null,
      confirmRevertAll,
      onAcceptAll: () => applyAll("accept"),
      onAskRevertAll: () => setConfirmRevertAll(true),
      onCancelRevertAll: () => setConfirmRevertAll(false),
      onRevertAll: () => applyAll("revert"),
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
      busy: busyKey !== null,
      actionError,
      onAction: applyBlock,
      onToggleLayout: toggleLayout,
      onToggleWhole: toggleWhole,
      onOpenFile: openInApp,
      onToggleWrap: toggleWrap,
    }),
  ]);
}
