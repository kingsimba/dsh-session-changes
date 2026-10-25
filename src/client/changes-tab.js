import { DetailPane } from "./components/detail-pane.js";
import { ListPane } from "./components/list-pane.js";
import { buildListRows } from "./components/list-rows.js";
import { LAYOUT_KEY, MODE_KEY, REVIEW_PREFIX, WHOLE_KEY, WRAP_KEY } from "./constants.js";
import { useBase } from "./hooks/use-base.js";
import { useChangesFeed } from "./hooks/use-changes-feed.js";
import { useComparison } from "./hooks/use-comparison.js";
import { useExists } from "./hooks/use-exists.js";
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
  const view = useView({ turns: feed.state.turns, mode, turnFilter });
  useSelection({ view, mode, selected, setSelected, setEntryIndex });
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
    view,
    gonePaths,
    selected,
    mode,
    t,
    onSelect: (selection, index) => {
      setSelected(selection);
      setEntryIndex(index);
    },
  });

  return h("div", { className: "dsc-root", "data-session-changes": true, ref: rootRef }, [
    h(ListPane, {
      t,
      state: feed.state,
      view,
      rows,
      mode,
      busy: feed.state.phase === "loading",
      left,
      onMode: setModeAndStore,
      onRefresh: feed.refresh,
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
