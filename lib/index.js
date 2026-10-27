/**
 * Session changes, Host half.
 *
 * One store per Session records every path this Session's file tools touched: a
 * copy of the file as it stood just before the first write, or an `.absent` marker
 * for a path that did not exist yet. That store is the page's only source of truth:
 * the list is its index, the comparison is the stored copy against the file on
 * disk, and a path outside the workspace is stored by digest in a sibling
 * `_external` directory (with a `.path` sidecar so it can be listed again after a
 * restart).
 *
 * No per-turn summary is involved, so the list survives a Host restart and a new
 * file shows up as soon as its pre-image is captured, not when its turn closes.
 *
 * Routes sit inside Connection's authentication fence; the read routes serve the
 * list and the two comparison sides, the write routes let the reviewer accept one
 * change block into the pre-image or revert it on disk, and the watch route streams
 * one frame per invalidation so the open tab never polls.
 */

import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFile, mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";

/** Where the store lives, relative to each workspace root. */
const STORE_DIR = ".dsh/session-changes";

/** Sibling of the Session store holding the pre-images of paths outside the workspace. */
const EXTERNAL_DIR = "_external";

/** The routes this plugin serves. */
const LIST_PATH = "/api/session-changes.list";
const FILE_PATH = "/api/session-changes.file";
const BASE_PATH = "/api/session-changes.base";
const WATCH_PATH = "/api/session-changes.watch";
const OPEN_PATH = "/api/session-changes.open";
const ACCEPT_PATH = "/api/session-changes.accept";
const REVERT_PATH = "/api/session-changes.revert";

/** Suffix marking a path that did not exist before the Session touched it. */
const ABSENT_SUFFIX = ".absent";

/** Suffix of the sidecar naming an external pre-image's original path. */
const PATH_SUFFIX = ".path";

/** Largest file the comparison may request. */
const MAX_FILE_BYTES = 4 * 1024 * 1024;

/** Largest text one accept/revert write accepts. */
const MAX_WRITE_BYTES = 8 * 1024 * 1024;

/** Most files one list read reports. */
const LIST_CAP = 500;

/** Most listed files one watch stream observes. */
const WATCH_CAP = 200;

/** How often a quiet watch stream proves the browser is still there. */
const WATCH_PING_MS = 15000;

export const name = "session-changes";

export const inject = ["connection", "fs", "sessionQuery"];

/** Workspace root per Session, learned from the header and refreshed on every write. */
const cwdOf = new Map();

/** Open watch streams, so a capture can wake them without waiting for a turn. */
const watchers = new Map();

/**
 * One Session's workspace root, from the cache or from its durable header.
 * @param ctx - Host context.
 * @param sessionId - the viewed Session.
 * @returns the absolute workspace root, or undefined when the Session is unknown.
 */
async function sessionCwd(ctx, sessionId) {
  const known = cwdOf.get(sessionId);
  if (known !== undefined) return known;
  let snapshot;
  try {
    snapshot = await ctx.sessionQuery.readSession(sessionId);
  } catch {
    return undefined;
  }
  const cwd = snapshot === undefined ? undefined : snapshot.session?.cwd;
  if (typeof cwd !== "string" || cwd === "") return undefined;
  cwdOf.set(sessionId, cwd);
  return cwd;
}

/**
 * The store directories of one Session.
 * @param cwd - the workspace root.
 * @param sessionId - the viewed Session.
 * @returns the store root and the external store.
 */
function storePaths(cwd, sessionId) {
  const base = join(cwd, STORE_DIR);
  return {
    root: join(base, String(sessionId)),
    external: join(base, EXTERNAL_DIR, String(sessionId)),
  };
}

/**
 * Where one path sits inside the Session's store.
 * @returns the store-relative path, or undefined for a path outside the workspace.
 */
function storePath(cwd, absolute) {
  const rel = relative(cwd, absolute);
  if (rel === "" || rel.startsWith("..") || isAbsolute(rel)) return undefined;
  return rel;
}

/**
 * Store file name for a path outside the workspace. A digest, not the path itself:
 * mirroring an absolute path under the workspace store would push the Windows path
 * over its 260-character limit for any reasonably deep project. Case is folded on
 * Windows so a differently-cased read still finds the same file.
 * @param absolute - the resolved absolute path.
 * @returns the store file's name.
 */
function externalName(absolute) {
  const normalized = process.platform === "win32" ? absolute.toLowerCase() : absolute;
  return createHash("sha1").update(normalized, "utf8").digest("hex");
}

/**
 * The store file holding one path's pre-image.
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

/** Existence probe that never throws. */
async function exists(path) {
  try {
    const info = await stat(path);
    return info.isFile();
  } catch {
    return false;
  }
}

/**
 * Copy a file's current content into the Session's store, once per path, and tell
 * the open tabs. A missing file is recorded as an absent marker, so a later
 * comparison knows it was created.
 */
async function captureBefore(ctx, session, target) {
  const cwd = session === undefined || session === null ? undefined : session.header?.cwd;
  if (typeof cwd !== "string" || cwd === "") return;
  cwdOf.set(String(session.id), cwd);
  let absolute;
  try {
    absolute = ctx.fs.processPath(target);
  } catch {
    return;
  }
  if (typeof absolute !== "string" || absolute === "") return;
  const destination = preImagePath(cwd, session.id, absolute);
  if (!(await exists(destination)) && !(await exists(destination + ABSENT_SUFFIX))) {
    try {
      const info = await stat(absolute);
      if (!info.isFile()) return;
      await mkdir(dirname(destination), { recursive: true });
      await copyFile(absolute, destination);
    } catch (error) {
      if (error instanceof Error && error.code === "ENOENT") {
        await mkdir(dirname(destination), { recursive: true });
        await writeFile(destination + ABSENT_SUFFIX, "", "utf8");
      } else return;
    }
    // A path outside the workspace cannot be recovered from its digest alone.
    if (storePath(cwd, absolute) === undefined) {
      await writeFile(destination + PATH_SUFFIX, absolute, "utf8");
    }
  }
  notify(String(session.id), { t: "added" });
}

/**
 * Every file the Session touched.
 * @param cwd - the workspace root.
 * @param sessionId - the viewed Session.
 * @returns `{ path, display }[]`, capped and sorted by display.
 */
async function listFiles(cwd, sessionId) {
  const store = storePaths(cwd, sessionId);
  const files = [];
  const seen = new Set();
  const walk = async (directory, prefix) => {
    let entries;
    try {
      entries = await readdir(directory, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (files.length >= LIST_CAP) return;
      const name = entry.name;
      const rel = prefix === "" ? name : prefix + "/" + name;
      if (entry.isDirectory()) {
        await walk(join(directory, name), rel);
        continue;
      }
      if (!entry.isFile()) continue;
      const path = name.endsWith(ABSENT_SUFFIX) ? rel.slice(0, -ABSENT_SUFFIX.length) : rel;
      if (seen.has(path)) continue;
      seen.add(path);
      files.push({ path, display: path });
    }
  };
  await walk(store.root, "");
  let external = [];
  try {
    external = await readdir(store.external, { withFileTypes: true });
  } catch {}
  for (const entry of external) {
    if (files.length >= LIST_CAP) break;
    if (!entry.isFile() || !entry.name.endsWith(PATH_SUFFIX)) continue;
    let path;
    try {
      path = (await readFile(join(store.external, entry.name), "utf8")).trim();
    } catch {
      continue;
    }
    if (path === "" || seen.has(path)) continue;
    seen.add(path);
    files.push({ path, display: path });
  }
  files.sort((a, b) => (a.display < b.display ? -1 : a.display > b.display ? 1 : 0));
  return files;
}

/** Wake every open watch stream of one Session. */
function notify(sessionId, frame) {
  const streams = watchers.get(sessionId);
  if (streams === undefined) return;
  for (const send of streams) send(frame);
}

/**
 * Answer one list read.
 * @param ctx - Host context.
 * @param request - the authenticated browser request.
 * @returns the JSON response or the refusal.
 */
async function handleList(ctx, request) {
  const sessionId = new URL(request.url).searchParams.get("sessionId");
  if (sessionId === null || sessionId === "") {
    return Response.json({ error: "bad-request" }, { status: 400 });
  }
  const cwd = await sessionCwd(ctx, sessionId);
  if (cwd === undefined) {
    return Response.json({ files: [] }, { headers: { "cache-control": "no-store" } });
  }
  const files = await listFiles(cwd, sessionId);
  return Response.json({ files }, { headers: { "cache-control": "no-store" } });
}

/**
 * Answer one current-text read for the comparison's file side.
 * @param ctx - Host context.
 * @param request - the authenticated browser request.
 * @returns the file's text, or the refusal.
 */
async function handleFile(ctx, request) {
  const query = new URL(request.url).searchParams;
  const sessionId = query.get("sessionId");
  const path = query.get("path");
  if (sessionId === null || sessionId === "" || path === null || path === "") {
    return Response.json({ error: "bad-request" }, { status: 400 });
  }
  const cwd = await sessionCwd(ctx, sessionId);
  if (cwd === undefined) return Response.json({ error: "no-cwd" }, { status: 404 });
  const absolute = isAbsolute(path) ? path : resolve(cwd, path);
  try {
    const info = await stat(absolute);
    if (!info.isFile()) return Response.json({ error: "not-file" }, { status: 404 });
    if (info.size > MAX_FILE_BYTES) return Response.json({ error: "too-large" }, { status: 413 });
    const text = await readFile(absolute, "utf8");
    if (text.includes("\u0000")) return Response.json({ error: "binary" }, { status: 415 });
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

/**
 * Answer one pre-image read: the file's text before the Session first touched it,
 * or that it did not exist yet.
 * @param ctx - Host context.
 * @param request - the authenticated browser request.
 * @returns the JSON response or the refusal.
 */
async function handleBase(ctx, request) {
  const query = new URL(request.url).searchParams;
  const sessionId = query.get("sessionId");
  const path = query.get("path");
  if (sessionId === null || sessionId === "" || path === null || path === "") {
    return Response.json({ error: "bad-request" }, { status: 400 });
  }
  const cwd = await sessionCwd(ctx, sessionId);
  if (cwd === undefined) return Response.json({ error: "no-cwd" }, { status: 404 });
  const absolute = isAbsolute(path) ? path : resolve(cwd, path);
  const base = preImagePath(cwd, sessionId, absolute);
  try {
    const info = await stat(base);
    if (info.isFile()) {
      const text = await readFile(base, "utf8");
      if (text.includes("\u0000")) return Response.json({ error: "binary" }, { status: 415 });
      return Response.json({ text }, { headers: { "cache-control": "no-store" } });
    }
  } catch {}
  if (await exists(base + ABSENT_SUFFIX)) {
    return Response.json({ absent: true }, { headers: { "cache-control": "no-store" } });
  }
  return Response.json({ error: "not-captured" }, { status: 404 });
}

/**
 * Hand one file to the desktop's default application — the "edit this file" button.
 * @param absolute - the file to open.
 */
function openInDesktop(absolute) {
  const command =
    process.platform === "win32" ? "cmd.exe" : process.platform === "darwin" ? "open" : "xdg-open";
  const args = process.platform === "win32" ? ["/c", "start", "", absolute] : [absolute];
  const child = spawn(command, args, { detached: true, stdio: "ignore", windowsHide: true });
  child.on("error", () => {});
  child.unref();
}

/**
 * SHA-256 of one text side, as the browser computes it for its conflict check.
 * @param text - the text a write route is about to replace.
 * @returns the lowercase hex digest.
 */
function digestText(text) {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

/**
 * Answer one accept/revert write: replace one side of the comparison with the text
 * the browser computed for a single change block.
 *
 * `accept` folds the change into the pre-image, so the block stops reading as a
 * change; `revert` writes the pre-image's lines back into the live file, so the
 * change is undone on disk. Both sides are protected by `expect`, the digest of the
 * text the browser last read — a write that raced an agent edit is refused with
 * `409 changed` instead of clobbering it.
 *
 * Only a path this Session captured can be written, so neither route can touch an
 * arbitrary file, and the pre-image is only ever written inside the store.
 *
 * @param ctx - Host context.
 * @param request - the authenticated browser request: `{ sessionId, path, text, expect }`.
 * @param action - `accept` or `revert`.
 * @returns 200 when written, or the refusal.
 */
async function handleApply(ctx, request, action) {
  let payload;
  try {
    const raw = await request.text();
    if (raw.length > MAX_WRITE_BYTES) {
      return Response.json({ error: "too-large" }, { status: 413 });
    }
    payload = JSON.parse(raw);
  } catch {
    return Response.json({ error: "bad-request" }, { status: 400 });
  }
  if (payload === null || typeof payload !== "object") {
    return Response.json({ error: "bad-request" }, { status: 400 });
  }
  const sessionId = payload.sessionId;
  const path = payload.path;
  const text = payload.text;
  const expect = payload.expect;
  if (
    typeof sessionId !== "string" ||
    sessionId === "" ||
    typeof path !== "string" ||
    path === "" ||
    typeof text !== "string"
  ) {
    return Response.json({ error: "bad-request" }, { status: 400 });
  }
  if (text.length > MAX_WRITE_BYTES) {
    return Response.json({ error: "too-large" }, { status: 413 });
  }
  if (text.includes("\u0000")) {
    return Response.json({ error: "binary" }, { status: 415 });
  }

  const cwd = await sessionCwd(ctx, sessionId);
  if (cwd === undefined) return Response.json({ error: "no-cwd" }, { status: 404 });
  const absolute = isAbsolute(path) ? path : resolve(cwd, path);
  const stored = preImagePath(cwd, sessionId, absolute);
  const captured = await exists(stored);
  const absent = !captured && (await exists(stored + ABSENT_SUFFIX));
  if (!captured && !absent) {
    return Response.json({ error: "not-captured" }, { status: 404 });
  }

  // The side this action replaces, exactly as the browser read it before clicking.
  let previous = "";
  if (action === "accept") {
    if (captured) previous = await readFile(stored, "utf8");
  } else {
    try {
      const info = await stat(absolute);
      if (!info.isFile()) return Response.json({ error: "not-file" }, { status: 404 });
      if (info.size > MAX_FILE_BYTES) {
        return Response.json({ error: "too-large" }, { status: 413 });
      }
      previous = await readFile(absolute, "utf8");
    } catch (error) {
      // A vanished path is an empty new side, the same way the comparison reads it.
      if (!(error instanceof Error && error.code === "ENOENT")) {
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
  }
  if (typeof expect === "string" && expect !== "" && digestText(previous) !== expect) {
    return Response.json({ error: "changed" }, { status: 409 });
  }

  if (action === "accept") {
    await mkdir(dirname(stored), { recursive: true });
    await writeFile(stored, text, "utf8");
    // A created file that now has an accepted baseline is no longer "absent".
    if (absent) await rm(stored + ABSENT_SUFFIX, { force: true });
  } else if (text === "" && absent) {
    // Reverting every line of a file this Session created returns the path to the
    // state it had before the Session: it did not exist.
    await rm(absolute, { force: true });
    notify(String(sessionId), { t: "file" });
    return Response.json({ ok: true, deleted: true });
  } else {
    // A reverted file may sit in a directory the Session removed after creating it.
    await mkdir(dirname(absolute), { recursive: true });
    await writeFile(absolute, text, "utf8");
  }
  notify(String(sessionId), { t: "file" });
  return Response.json({ ok: true });
}

/**
 * Answer one native-open request. Only a path this Session captured can be opened,
 * so the route cannot be used to launch arbitrary files.
 * @param ctx - Host context.
 * @param request - the authenticated browser request.
 * @returns 204 when the desktop was asked to open it, or the refusal.
 */
async function handleOpen(ctx, request) {
  const query = new URL(request.url).searchParams;
  const sessionId = query.get("sessionId");
  const path = query.get("path");
  if (sessionId === null || sessionId === "" || path === null || path === "") {
    return Response.json({ error: "bad-request" }, { status: 400 });
  }
  const cwd = await sessionCwd(ctx, sessionId);
  if (cwd === undefined) return Response.json({ error: "no-cwd" }, { status: 404 });
  const absolute = isAbsolute(path) ? path : resolve(cwd, path);
  const stored = preImagePath(cwd, sessionId, absolute);
  if (!(await exists(stored)) && !(await exists(stored + ABSENT_SUFFIX))) {
    return Response.json({ error: "not-captured" }, { status: 404 });
  }
  try {
    const info = await stat(absolute);
    if (!info.isFile()) return Response.json({ error: "not-file" }, { status: 404 });
  } catch {
    return Response.json({ error: "not-file" }, { status: 404 });
  }
  openInDesktop(absolute);
  return new Response(null, { status: 204 });
}

/**
 * Stream the invalidations the open tab refreshes from: one frame per listed file
 * the filesystem reports as changed, and one per capture. A quiet stream pings, both
 * to keep the connection warm and to notice a browser that left without cancelling.
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
  const closers = [];
  let output = null;
  let ping = null;
  let stopped = false;
  let armed = Promise.resolve();
  const streams = watchers.get(sessionId) ?? new Set();
  watchers.set(sessionId, streams);

  /** Close every watcher and listener; safe to call more than once. */
  const stop = async () => {
    if (stopped) return;
    stopped = true;
    lifetime.abort();
    if (ping !== null) {
      clearInterval(ping);
      ping = null;
    }
    streams.delete(deliver);
    if (streams.size === 0) watchers.delete(sessionId);
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

  /** Replace the watched files with the ones the store holds now. */
  const arm = async () => {
    const closing = closers.splice(0);
    await Promise.allSettled(closing.map((close) => close()));
    if (stopped) return false;
    const cwd = await sessionCwd(ctx, sessionId);
    if (cwd === undefined) return false;
    let watching = false;
    for (const file of (await listFiles(cwd, sessionId)).slice(0, WATCH_CAP)) {
      if (stopped) return watching;
      const absolute = isAbsolute(file.path) ? file.path : resolve(cwd, file.path);
      let target;
      try {
        target = await ctx.fs.resolve(absolute, { signal: lifetime.signal });
      } catch {
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
        // A provider that cannot watch this path still gets the capture frames.
      }
    }
    return watching;
  };

  /** Rebuild the file watches one caller at a time. */
  const rearm = () => {
    armed = armed.then(() => arm()).catch(() => false);
    return armed;
  };

  /** Deliver one frame; a capture also re-arms, so the new file is watched. */
  const deliver = (frame) => {
    send(frame);
    if (frame !== null && typeof frame === "object" && frame.t === "added") void rearm();
  };

  const body = new ReadableStream({
    start(controller) {
      output = controller;
    },
    cancel() {
      void stop();
    },
  });

  streams.add(deliver);
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
    if (session === undefined || session === null) return;
    // The store is the page's only history: keep it so a reopened Session still
    // lists its files. Only the cached workspace root goes.
    cwdOf.delete(String(session.id));
  });

  const routes = [
    [LIST_PATH, handleList, ["GET"]],
    [FILE_PATH, handleFile, ["GET"]],
    [BASE_PATH, handleBase, ["GET"]],
    [WATCH_PATH, handleWatch, ["GET"]],
    [OPEN_PATH, handleOpen, ["POST"]],
    [ACCEPT_PATH, (host, request) => handleApply(host, request, "accept"), ["POST"]],
    [REVERT_PATH, (host, request) => handleApply(host, request, "revert"), ["POST"]],
  ];
  for (const [routePath, handler, methods] of routes)
    ctx.connection.fetch.register({
      path: routePath,
      methods,
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
