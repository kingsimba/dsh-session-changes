/** Dictionary namespace. */
export const NS = "session-changes";

/** This implementation's identity in the tab system, and the key its body registers under. */
export const TYPE_ID = "dsh-session-changes";

/** The page kind the guide entry opens. */
export const KIND = "session-changes";

/** Resource-address prefix of one turn's existing review tab. */
export const REVIEW_PREFIX = "dsh-resource://changes-review/session/";

/** The authenticated read routes served by this package's Host half and by ui-deliverables. */
export const LIST_ROUTE = "api/session-changes.list";
export const DIFF_ROUTE = "api/changes.diff";

/** Native open of a changed file, served by ui-deliverables' Host half. */
export const OPEN_ROUTE = "api/changes.open";

/** The Host route that serves one changed file's current text. */
export const FILE_ROUTE = "api/session-changes.file";

/** The Host route that serves the file's first pre-image in this Session. */
export const BASE_ROUTE = "api/session-changes.base";

/** The Host route that reports which of the listed paths still exist on disk. */
export const EXISTS_ROUTE = "api/session-changes.exists";

/** The Host route that streams one frame per file invalidation and turn commit. */
export const WATCH_ROUTE = "api/session-changes.watch";

/** Persisted preferences: left pane width, wrap, list mode, whole-file scope, layout. */
export const WIDTH_KEY = "dsh-session-changes.left";
export const WRAP_KEY = "dsh-session-changes.wrap";
export const MODE_KEY = "dsh-session-changes.mode";
export const WHOLE_KEY = "dsh-session-changes.whole";
export const LAYOUT_KEY = "dsh-session-changes.layout";

/** Pane geometry bounds, in pixels. */
export const MIN_LEFT = 180;
export const MIN_RIGHT = 260;

/** Left pane width before the user has dragged it. */
export const DEFAULT_LEFT = 220;

/** Rows drawn before the comparison says it stopped. */
export const ROW_CAP = 5000;

/** Context lines kept around each change when a whole-file diff is cut into hunks. */
export const DIFF_CONTEXT = 3;

/** Identifies this package's stylesheet tag, so a reload never stacks a second copy. */
export const CSS_TAG_ID = "dsh-session-changes/list.css";

/** Placeholder comment added to exercise the Session changes page; safe to delete. */
export const SANITY_CHECK_NOTE = "session-changes smoke test";
