/** Dictionary namespace. */
export const NS = "session-changes";

/** This implementation's identity in the tab system, and the key its body registers under. */
export const TYPE_ID = "dsh-session-changes";

/** The page kind the guide entry opens. */
export const KIND = "session-changes";

/** The authenticated routes served by this package's Host half. */
export const LIST_ROUTE = "api/session-changes.list";
export const FILE_ROUTE = "api/session-changes.file";
export const BASE_ROUTE = "api/session-changes.base";
export const WATCH_ROUTE = "api/session-changes.watch";

/** Native open of a captured file, served by this package's Host half. */
export const OPEN_ROUTE = "api/session-changes.open";

/** Persisted preferences: left pane width, wrap, whole-file scope, layout. */
export const WIDTH_KEY = "dsh-session-changes.left";
export const WRAP_KEY = "dsh-session-changes.wrap";
export const WHOLE_KEY = "dsh-session-changes.whole";
export const LAYOUT_KEY = "dsh-session-changes.layout";

/** Pane geometry bounds, in pixels. */
export const MIN_LEFT = 180;
export const MIN_RIGHT = 260;

/** Left pane width before the user has dragged it. */
export const DEFAULT_LEFT = 220;

/** Rows drawn before the comparison says it stopped. */
export const ROW_CAP = 5000;

/** Context lines kept around each change when the diff is cut into hunks. */
export const DIFF_CONTEXT = 3;

/** Identifies this package's stylesheet tag, so a reload never stacks a second copy. */
export const CSS_TAG_ID = "dsh-session-changes/list.css";
