/**
 * Session changes, Host half: one authenticated read route that lists every
 * `workspace/changes` announcement this Session recorded, newest turn first,
 * with the file rows the existing review tab already knows how to compare.
 *
 * The list itself is derived from the Session log (`sessionQuery.listEvents`)
 * plus the recorder's in-memory summaries (`workspaceChanges.summary`), so it
 * costs no extra recording and dies exactly when the recorder does.
 */

import { readFile, stat } from "node:fs/promises";
import { isAbsolute, resolve } from "node:path";

/** An event type the recorder announces one turn's changed-file summary with. */
const CHANGES_EVENT = "workspace/changes";

/** The routes this plugin serves. */
const LIST_PATH = "/api/session-changes.list";
const FILE_PATH = "/api/session-changes.file";

/** Largest file the whole-file view may request. */
const MAX_FILE_BYTES = 4 * 1024 * 1024;

export const name = "session-changes";

export const inject = ["connection", "sessionQuery", "workspaceChanges"];

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
    ...(file.oversized === true ? { oversized: true } : {})
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
      files: Array.isArray(summary.files) ? summary.files.map(fileRow) : []
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
  if (sessionId === null || sessionId === "" || path === null || path === "" || !Number.isSafeInteger(seq)) {
    return Response.json({ error: "bad-request" }, { status: 400 });
  }
  const summary = ctx.workspaceChanges.summary(sessionId, seq);
  if (summary === void 0) return Response.json({ error: "no-summary" }, { status: 404 });
  const absolute = isAbsolute(path) ? path : summary.cwd === void 0 ? void 0 : resolve(summary.cwd, path);
  if (absolute === void 0) return Response.json({ error: "no-cwd" }, { status: 404 });
  try {
    const info = await stat(absolute);
    if (!info.isFile()) return Response.json({ error: "not-file" }, { status: 404 });
    if (info.size > MAX_FILE_BYTES) return Response.json({ error: "too-large" }, { status: 413 });
    const text = await readFile(absolute, "utf8");
    return Response.json({ text }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return Response.json({ error: error instanceof Error && typeof error.code === "string" ? "read-" + error.code : "read-failed" }, { status: 404 });
  }
}

/**
 * Register the read routes inside Connection's authentication fence.
 * @param ctx - Host context.
 */
export function apply(ctx) {
  const lifetime = new AbortController();
  const pending = new Set();
  ctx.effect(() => () => {
    lifetime.abort();
    return Promise.allSettled([...pending]);
  });
  const routes = [
    [LIST_PATH, handleList],
    [FILE_PATH, handleFile],
  ];
  for (const [routePath, handler] of routes) ctx.connection.fetch.register({
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
