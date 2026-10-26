/**
 * Session changes, Host half: authenticated read routes that list every
 * `workspace/changes` announcement this Session recorded, newest turn first,
 * with the file rows the existing review tab already knows how to compare.
 *
 * The list itself is derived from the Session log (`sessionQuery.listEvents`)
 * plus the recorder's in-memory summaries (`workspaceChanges.summary`), so it
 * costs no extra recording and dies exactly when the recorder does.
 *
 * The watch route is the tab's refresh trigger: it observes the listed files
 * through `fs.watch` and the next `workspace/changes` append through
 * `session/event`, and streams one frame per invalidation, so the browser never
 * has to poll and never has to wait for a turn to close before a diff updates.
 */

import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";

/** An event type the recorder announces one turn's changed-file summary with. */
const CHANGES_EVENT = "workspace/changes";

/** The routes this plugin serves. */
const LIST_PATH = "/api/session-changes.list";
const FILE_PATH = "/api/session-changes.file";
const BASE_PATH = "/api/session-changes.base";
const EXISTS_PATH = "/api/session-changes.exists";
const WATCH_PATH = "/api/session-changes.watch";

/** Most listed files one watch stream observes; turn events cover the rest. */
const WATCH_CAP = 200;

/** How often a quiet watch stream proves the browser is still there. */
const WATCH_PING_MS = 15000;

/** Where the first-touch pre-images live, relative to each workspace root. */
const STORE_DIR = ".dsh/session-changes";

/** Sibling of the Session store holding the pre-images of paths outside the workspace. */
const EXTERNAL_DIR = "_external";

/** Suffix marking a path that did not exist before the Session touched it. */
const ABSENT_SUFFIX = ".absent";

/** Largest file the whole-file view may request. */
const MAX_FILE_BYTES = 4 * 1024 * 1024;

/** Most paths one existence probe answers for, so a huge Session cannot stall the Host. */
const MAX_PROBED_PATHS = 2000;

export const name = "session-changes";

export const inject = ["connection", "sessionQuery", "workspaceChanges", "fs"];

/**
 * Copy one changed-file record into the narrow shape the browser reads.
 * @param file - a summary file record.
 * @returns the browser-facing record.
 */
function fileRow(file) {
  return {
    path: file.path,
    display: file.display,
    added: file.added,
    deleted: file.deleted,
    ...(file.binary === true ? { binary: true } : {}),
    ...(file.oversized === true ? { oversized: true } : {}),
  };
}

/**
 * Read one Session's recorded change summaries, newest turn first.
 * @param ctx - Host context carrying the Session log and the change recorder.
 * @param sessionId - the viewed Session.
 * @returns `{ turn, seq, summary }[]`, one row per turn that still has a summary.
 */
async function turnSummaries(ctx, sessionId) {
  const records = await ctx.sessionQuery.listEvents(sessionId);
  const latestSeq = new Map();
  for (const record of records) {
    if (record.type !== CHANGES_EVENT) continue;
    const summary = ctx.workspaceChanges.summary(sessionId, record.seq);
    if (summary === undefined) continue;
    const turn = summary.turn;
    if (!Number.isSafeInteger(turn) || turn < 1) continue;
    // A turn may announce more than once; the highest seq wins.
    const seen = latestSeq.get(turn);
    if (seen === undefined || record.seq > seen) latestSeq.set(turn, record.seq);
  }
  const turns = [];
  for (const [turn, seq] of [...latestSeq.entries()].sort((a, b) => b[0] - a[0])) {
    const summary = ctx.workspaceChanges.summary(sessionId, seq);
    if (summary === undefined) continue;
    turns.push({ turn, seq, summary });
  }
  return turns;
}

/**
 * Whether this Session captured the path's pre-image before touching it. That store
 * is the plugin's own record of "the agent's file tools changed this": the recorder
 * also lists files a build script or a formatter rewrote (it reads the git work
 * tree), and those have no capture here.
 *
 * @param cwd - the turn summary's working directory.
 * @param sessionId - the viewed Session.
 * @param path - the summary's file path, relative or absolute.
 * @returns true when a pre-image or an absent marker is on disk.
 */
async function capturedBefore(cwd, sessionId, path) {
  if (typeof cwd !== "string" || cwd === "") return false;
  const absolute = isAbsolute(path) ? path : resolve(cwd, path);
  const rel = storePath(cwd, absolute);
  // Outside the working directory this plugin keeps no pre-image store (the store
  // lives under the workspace root), so it cannot judge those paths; the recorder
  // only lists them when a file tool named them.
  if (rel === undefined) return true;
  const base = join(cwd, STORE_DIR, String(sessionId), rel);
  for (const candidate of [base, base + ABSENT_SUFFIX]) {
    try {
      const info = await stat(candidate);
      if (info.isFile()) return true;
    } catch {}
  }
  return false;
}

/**
 * The turns whose files this Session actually captured, newest first.
 *
 * A file the agent never touched — a bundle a build regenerated, a lockfile an
 * installer rewrote — is recorded by the recorder but has no pre-image, so it is
 * not something this page can compare or own; it drops out here rather than
 * appearing as an undiffable row. A Session with no store at all (recorded before
 * this Host build captured pre-images, or after its store was cleaned) is left
 * unfiltered instead of emptied.
 *
 * @param ctx - Host context.
 * @param sessionId - the viewed Session.
 * @returns `{ turn, seq, summary }[]` with `summary.files` filtered and totals kept.
 */
async function visibleTurns(ctx, sessionId) {
  const turns = await turnSummaries(ctx, sessionId);
  const tracking = new Map();
  const visible = [];
  for (const { turn, seq, summary } of turns) {
    const cwd = typeof summary.cwd === "string" ? summary.cwd : void 0;
    const all = Array.isArray(summary.files) ? summary.files : [];
    if (cwd === void 0) continue;
    let watching = tracking.get(cwd);
    if (watching === undefined) {
      try {
        const info = await stat(join(cwd, STORE_DIR, String(sessionId)));
        watching = info.isDirectory();
      } catch {
        watching = false;
      }
      tracking.set(cwd, watching);
    }
    let kept = all;
    if (watching) {
      const captured = await Promise.all(
        all.map((file) => capturedBefore(cwd, sessionId, file.path)),
      );
      kept = all.filter((_file, index) => captured[index] === true);
    }
    if (kept.length === 0) continue;
    visible.push({ turn, seq, summary: { ...summary, files: kept } });
  }
  return visible;
}

/**
 * Read one Session's recorded change summaries as the browser rows.
 * @param ctx - Host context carrying the Session log and the change recorder.
 * @param sessionId - the viewed Session.
 * @returns the browser payload.
 */
async function listTurns(ctx, sessionId) {
  const turns = await visibleTurns(ctx, sessionId);
  return {
    turns: turns.map(({ turn, seq, summary }) => {
      const files = Array.isArray(summary.files) ? summary.files.map(fileRow) : [];
      let added = 0;
      let deleted = 0;
      for (const file of files) {
        added += file.added;
        deleted += file.deleted;
      }
      return { turn, seq, total: files.length, added, deleted, files };
    }),
  };
}

/**
 * Answer one index read.
 * @param ctx - Host context.
 * @param request - the authenticated browser request.
 * @returns the JSON response or the refusal.
 */
async function handleList(ctx, request) {
  const sessionId = new URL(request.url).searchParams.get("sessionId");
  if (sessionId === null || sessionId === "") {
    return Response.json({ error: "bad-request" }, { status: 400 });
  }
  try {
    const payload = await listTurns(ctx, sessionId);
    return Response.json(payload, { headers: { "cache-control": "no-store" } });
  } catch {
    return Response.json({ error: "list-unavailable" }, { status: 404 });
  }
}

/**
 * Answer one whole-file read for the comparison's file view.
 * @param ctx - Host context.
 * @param request - the authenticated browser request.
 * @returns the file's text, or the refusal.
 */
async function handleFile(ctx, request) {
  const query = new URL(request.url).searchParams;
  const sessionId = query.get("sessionId");
  const seq = Number(query.get("seq"));
  const path = query.get("path");
  if (
    sessionId === null ||
    sessionId === "" ||
    path === null ||
    path === "" ||
    !Number.isSafeInteger(seq)
  ) {
    return Response.json({ error: "bad-request" }, { status: 400 });
  }
  const summary = ctx.workspaceChanges.summary(sessionId, seq);
  if (summary === void 0) return Response.json({ error: "no-summary" }, { status: 404 });
  const absolute = isAbsolute(path)
    ? path
    : summary.cwd === void 0
      ? void 0
      : resolve(summary.cwd, path);
  if (absolute === void 0) return Response.json({ error: "no-cwd" }, { status: 404 });
  try {
    const info = await stat(absolute);
    if (!info.isFile()) return Response.json({ error: "not-file" }, { status: 404 });
    if (info.size > MAX_FILE_BYTES) return Response.json({ error: "too-large" }, { status: 413 });
    const text = await readFile(absolute, "utf8");
    return Response.json({ text }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error && typeof error.code === "string"
            ? "read-" + error.code
            : "read-failed",
      },
      { status: 404 },
    );
  }
}

/** The pre-image store of one Session, or undefined when its workspace is unknown. */
function storeOf(ctx, session) {
  const cwd = session === void 0 || session === null ? void 0 : session.header?.cwd;
  if (typeof cwd !== "string" || cwd === "") return void 0;
  const base = join(cwd, STORE_DIR);
  return {
    cwd,
    root: join(base, String(session.id)),
    external: join(base, EXTERNAL_DIR, String(session.id)),
  };
}

/**
 * Where one captured path sits inside the Session's store.
 * @returns the store-relative path, or undefined for a path outside the workspace.
 */
function storePath(cwd, absolute) {
  const rel = relative(cwd, absolute);
  if (rel === "" || rel.startsWith("..") || isAbsolute(rel)) return void 0;
  return rel;
}

/**
 * Store file name for a path outside the workspace. A digest, not the path itself:
 * mirroring an absolute path under the workspace store would push the Windows path
 * over its 260-character limit for any reasonably deep project, and these paths can
 * be arbitrarily long. Case is folded on Windows so a differently-cased read still
 * finds the same file.
 * @param absolute - the resolved absolute path.
 * @returns the store file's name.
 */
function externalName(absolute) {
  const normalized = process.platform === "win32" ? absolute.toLowerCase() : absolute;
  return createHash("sha1").update(normalized, "utf8").digest("hex");
}

/**
 * The store file holding one path's pre-image: under the Session store when the
 * path is inside the workspace, under the external store beside it when it is not,
 * so a file the agent edited outside the workspace still gets a baseline.
 * @param cwd - the workspace root.
 * @param sessionId - the viewed Session.
 * @param absolute - the resolved absolute path.
 * @returns the store file's path.
 */
function preImagePath(cwd, sessionId, absolute) {
  const rel = storePath(cwd, absolute);
  return rel === undefined
    ? join(cwd, STORE_DIR, EXTERNAL_DIR, String(sessionId), externalName(absolute))
    : join(cwd, STORE_DIR, String(sessionId), rel);
}

/**
 * Copy a file's current content into the Session's pre-image store, once per path.
 * A missing file is recorded as absent, so a later comparison knows it was created.
 */
async function captureBefore(ctx, session, target) {
  const store = storeOf(ctx, session);
  if (store === void 0) return;
  let absolute;
  try {
    absolute = ctx.fs.processPath(target);
  } catch {
    return;
  }
  if (typeof absolute !== "string" || absolute === "") return;
  const destination = preImagePath(store.cwd, String(session.id), absolute);
  if (capturedPaths.has(destination)) return;
  capturedPaths.add(destination);
  try {
    const info = await stat(absolute);
    if (!info.isFile()) {
      capturedPaths.delete(destination);
      return;
    }
    await mkdir(dirname(destination), { recursive: true });
    await copyFile(absolute, destination);
  } catch (error) {
    if (error instanceof Error && error.code === "ENOENT") {
      await mkdir(dirname(destination), { recursive: true });
      await writeFile(destination + ABSENT_SUFFIX, "", "utf8");
      return;
    }
    capturedPaths.delete(destination);
  }
}

/** Store files already holding a pre-image, so each path is captured once per Session. */
const capturedPaths = new Set();

/** Answer one first-touch pre-image read: its text, or that it did not exist. */
async function handleBase(ctx, request) {
  const query = new URL(request.url).searchParams;
  const sessionId = query.get("sessionId");
  const seq = Number(query.get("seq"));
  const path = query.get("path");
  if (
    sessionId === null ||
    sessionId === "" ||
    path === null ||
    path === "" ||
    !Number.isSafeInteger(seq)
  ) {
    return Response.json({ error: "bad-request" }, { status: 400 });
  }
  const summary = ctx.workspaceChanges.summary(sessionId, seq);
  const cwd = summary === void 0 ? void 0 : summary.cwd;
  if (cwd === void 0) return Response.json({ error: "no-cwd" }, { status: 404 });
  const absolute = isAbsolute(path) ? path : resolve(cwd, path);
  const base = preImagePath(cwd, String(sessionId), absolute);
  try {
    const info = await stat(base);
    if (info.isFile())
      return Response.json(
        { text: await readFile(base, "utf8") },
        { headers: { "cache-control": "no-store" } },
      );
  } catch {}
  try {
    const marker = await stat(base + ABSENT_SUFFIX);
    if (marker.isFile())
      return Response.json({ absent: true }, { headers: { "cache-control": "no-store" } });
  } catch {}
  return Response.json({ error: "not-captured" }, { status: 404 });
}

/**
 * Answer one existence probe: for every file the list shows, whether the path still
 * exists on disk. The recorded turns never learn about a file removed outside the
 * Session's file tools, so the list has to ask the filesystem.
 * @param ctx - Host context.
 * @param request - the authenticated browser request.
 * @returns `{ paths: { [path]: "file" | "other" | "missing" | "unknown" } }`.
 */
async function handleExists(ctx, request) {
  const sessionId = new URL(request.url).searchParams.get("sessionId");
  if (sessionId === null || sessionId === "") {
    return Response.json({ error: "bad-request" }, { status: 400 });
  }
  let listed;
  try {
    listed = await listTurns(ctx, sessionId);
  } catch {
    return Response.json({ error: "list-unavailable" }, { status: 404 });
  }
  const verdicts = {};
  const seen = new Set();
  for (const turn of listed.turns) {
    const summary = ctx.workspaceChanges.summary(sessionId, turn.seq);
    const cwd = summary === void 0 ? void 0 : summary.cwd;
    for (const file of turn.files) {
      const path = String(file.path);
      if (seen.has(path)) continue;
      seen.add(path);
      if (seen.size > MAX_PROBED_PATHS) continue;
      const absolute = isAbsolute(path) ? path : cwd === void 0 ? void 0 : resolve(cwd, path);
      if (absolute === void 0) {
        verdicts[path] = "unknown";
        continue;
      }
      try {
        const info = await stat(absolute);
        verdicts[path] = info.isFile() ? "file" : "other";
      } catch {
        verdicts[path] = "missing";
      }
    }
  }
  return Response.json({ paths: verdicts }, { headers: { "cache-control": "no-store" } });
}

/**
 * The absolute paths the list currently shows, deduplicated and capped.
 * @param turns - the rows {@link turnSummaries} returned.
 * @returns absolute paths, in list order.
 */
function listedPaths(turns) {
  const paths = [];
  const seen = new Set();
  for (const { summary } of turns) {
    const cwd = typeof summary.cwd === "string" ? summary.cwd : void 0;
    for (const file of Array.isArray(summary.files) ? summary.files : []) {
      const path = String(file.path);
      if (seen.has(path)) continue;
      const absolute = isAbsolute(path) ? path : cwd === void 0 ? void 0 : resolve(cwd, path);
      if (absolute === void 0) continue;
      seen.add(path);
      paths.push(absolute);
      if (paths.length >= WATCH_CAP) return paths;
    }
  }
  return paths;
}

/**
 * Stream the invalidations the open tab refreshes from: one frame per listed file
 * the filesystem reports as changed, and one per `workspace/changes` append, which
 * is when a closing turn's files become listable. A quiet stream pings, both to
 * keep the connection warm and to notice a browser that left without cancelling.
 *
 * @param ctx - Host context.
 * @param request - the authenticated browser request (`?sessionId=`).
 * @returns the newline-delimited JSON stream.
 */
async function handleWatch(ctx, request) {
  const sessionId = new URL(request.url).searchParams.get("sessionId");
  if (sessionId === null || sessionId === "") {
    return Response.json({ error: "bad-request" }, { status: 400 });
  }

  const encoder = new TextEncoder();
  const lifetime = new AbortController();
  const setters = [];
  const closers = [];
  let output = null;
  let ping = null;
  let stopped = false;
  let arming = Promise.resolve();

  /** Close every watcher and listener; safe to call more than once. */
  const stop = async () => {
    if (stopped) return;
    stopped = true;
    lifetime.abort();
    if (ping !== null) {
      clearInterval(ping);
      ping = null;
    }
    for (const dispose of setters.splice(0)) {
      try {
        dispose();
      } catch {}
    }
    const closing = closers.splice(0);
    await Promise.allSettled(closing.map((close) => close()));
  };

  /** Write one frame; a failed write means the browser left. */
  const send = (frame) => {
    if (stopped || output === null) return;
    try {
      output.enqueue(encoder.encode(JSON.stringify(frame) + "\n"));
    } catch {
      void stop();
    }
  };

  /** Replace the watched files with the ones the list shows now. */
  const arm = async () => {
    const closing = closers.splice(0);
    await Promise.allSettled(closing.map((close) => close()));
    if (stopped) return false;
    let turns;
    try {
      turns = await visibleTurns(ctx, sessionId);
    } catch {
      return false;
    }
    let watching = false;
    for (const absolute of listedPaths(turns)) {
      if (stopped) return watching;
      let target;
      try {
        target = await ctx.fs.resolve(absolute, { signal: lifetime.signal });
      } catch {
        // A path the provider cannot resolve (deleted, unreadable) is skipped.
        continue;
      }
      try {
        const close = await ctx.fs.watch(target, () => send({ t: "file" }), lifetime.signal);
        if (stopped) {
          await Promise.allSettled([close()]);
          return watching;
        }
        closers.push(close);
        watching = true;
      } catch {
        // A provider that cannot watch this path still gets the turn frames.
      }
    }
    return watching;
  };

  /** Rebuild the file watches one caller at a time, so two turns cannot interleave. */
  const rearm = () => {
    arming = arming.then(() => arm()).catch(() => false);
    return arming;
  };

  const body = new ReadableStream({
    start(controller) {
      output = controller;
    },
    cancel() {
      void stop();
    },
  });

  setters.push(
    ctx.on("session/event", (session, event) => {
      if (session === undefined || session === null || session.id !== sessionId) return;
      if (event === undefined || event === null || event.type !== CHANGES_EVENT) return;
      // The turn is durable now, so a new file row may need watching too.
      send({ t: "turn" });
      void rearm();
    }),
  );
  request.signal?.addEventListener?.("abort", () => void stop(), { once: true });
  ping = setInterval(() => send({ t: "ping" }), WATCH_PING_MS);
  void rearm().then((watching) => send({ t: "ready", files: watching === true }));

  return new Response(body, {
    headers: {
      "content-type": "application/x-ndjson; charset=utf-8",
      // `no-transform` keeps a composing gzip middleware from buffering the frames.
      "cache-control": "no-store, no-transform",
      "x-accel-buffering": "no",
    },
  });
}

/**
 * Register the read routes inside Connection's authentication fence, and capture
 * each file's first pre-image before the Session's file tools change it.
 * @param ctx - Host context.
 */
export function apply(ctx) {
  const lifetime = new AbortController();
  const pending = new Set();
  ctx.effect(() => () => {
    lifetime.abort();
    return Promise.allSettled([...pending]);
  });

  const execSessions = new WeakMap();
  ctx.on(
    "tools/pre-execute",
    async (exec, next) => {
      const session = exec?.agent?.session;
      if (session !== void 0) execSessions.set(exec, session);
      return next();
    },
    { prepend: true },
  );
  for (const event of ["fs/write-intent", "fs/edit-intent"]) {
    ctx.on(
      event,
      async (target, actor, next) => {
        const intent = await next();
        const session = actor === void 0 ? void 0 : execSessions.get(actor);
        if (session !== void 0) {
          const task = captureBefore(ctx, session, target);
          pending.add(task);
          task.then(
            () => pending.delete(task),
            () => pending.delete(task),
          );
          await task;
        }
        return intent;
      },
      { prepend: true },
    );
  }
  ctx.on("session/disposed", (session) => {
    const store = storeOf(ctx, session);
    if (store === void 0) return;
    const prefixes = [store.root + sep, store.external + sep];
    for (const destination of capturedPaths) {
      if (prefixes.some((prefix) => destination.startsWith(prefix)))
        capturedPaths.delete(destination);
    }
    void rm(store.root, { recursive: true, force: true });
    void rm(store.external, { recursive: true, force: true });
  });

  const routes = [
    [LIST_PATH, handleList],
    [FILE_PATH, handleFile],
    [BASE_PATH, handleBase],
    [EXISTS_PATH, handleExists],
    [WATCH_PATH, handleWatch],
  ];
  for (const [routePath, handler] of routes)
    ctx.connection.fetch.register({
      path: routePath,
      methods: ["GET"],
      requestBody: "buffered",
      fetch: (request) => {
        const task = handler(
          ctx,
          new Request(request, { signal: AbortSignal.any([request.signal, lifetime.signal]) }),
        );
        pending.add(task);
        task.then(
          () => pending.delete(task),
          () => pending.delete(task),
        );
        return task;
      },
    });
}
