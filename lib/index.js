/**
 * Session changes, Host half: one authenticated read route that lists every
 * `workspace/changes` announcement this Session recorded, newest turn first,
 * with the file rows the existing review tab already knows how to compare.
 *
 * The list itself is derived from the Session log (`sessionQuery.listEvents`)
 * plus the recorder's in-memory summaries (`workspaceChanges.summary`), so it
 * costs no extra recording and dies exactly when the recorder does.
 */

import { copyFile, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";

/** An event type the recorder announces one turn's changed-file summary with. */
const CHANGES_EVENT = "workspace/changes";

/** The routes this plugin serves. */
const LIST_PATH = "/api/session-changes.list";
const FILE_PATH = "/api/session-changes.file";
const BASE_PATH = "/api/session-changes.base";
const EXISTS_PATH = "/api/session-changes.exists";

/** Where the first-touch pre-images live, relative to each workspace root. */
const STORE_DIR = ".dsh/session-changes";

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
 * @returns the browser payload.
 */
async function listTurns(ctx, sessionId) {
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
    turns.push({
      turn,
      seq,
      total: summary.total,
      added: summary.added,
      deleted: summary.deleted,
      files: Array.isArray(summary.files) ? summary.files.map(fileRow) : [],
    });
  }
  return { turns };
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
  return { cwd, root: join(cwd, STORE_DIR, String(session.id)) };
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
  const rel = storePath(store.cwd, absolute);
  if (rel === void 0) return;
  const captured = capturedPaths.get(store.root) ?? new Set();
  if (captured.has(rel)) return;
  captured.add(rel);
  capturedPaths.set(store.root, captured);
  const destination = join(store.root, rel);
  try {
    const info = await stat(absolute);
    if (!info.isFile()) return;
    await mkdir(dirname(destination), { recursive: true });
    await copyFile(absolute, destination);
  } catch (error) {
    if (error instanceof Error && error.code === "ENOENT") {
      await mkdir(dirname(destination), { recursive: true });
      await writeFile(destination + ABSENT_SUFFIX, "", "utf8");
      return;
    }
    captured.delete(rel);
  }
}

/** Store roots already holding a path, so each file is captured once per Session. */
const capturedPaths = new Map();

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
  const rel = storePath(cwd, absolute);
  if (rel === void 0) return Response.json({ error: "outside-workspace" }, { status: 404 });
  const base = join(cwd, STORE_DIR, String(sessionId), rel);
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
    capturedPaths.delete(store.root);
    void rm(store.root, { recursive: true, force: true });
  });

  const routes = [
    [LIST_PATH, handleList],
    [FILE_PATH, handleFile],
    [BASE_PATH, handleBase],
    [EXISTS_PATH, handleExists],
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
