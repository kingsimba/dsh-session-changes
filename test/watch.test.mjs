/**
 * The browser half's refresh trigger: the 1s debounce that folds a save burst into
 * one re-read, and the frame parser that turns the Host's stream into callbacks.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { watchChanges } from "../src/client/api.js";
import { createDebouncer } from "../src/client/debounce.js";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

test("a burst of invalidations runs the refresh once, after the quiet period", async () => {
  const runs = [];
  const debouncer = createDebouncer(30, () => runs.push(1));
  debouncer.schedule();
  await sleep(10);
  debouncer.schedule();
  debouncer.schedule();
  assert.equal(runs.length, 0);
  await sleep(60);
  assert.equal(runs.length, 1);
  debouncer.dispose();
});

test("dispose drops a waiting run and ignores later schedules", async () => {
  let runs = 0;
  const debouncer = createDebouncer(20, () => {
    runs += 1;
  });
  debouncer.schedule();
  debouncer.dispose();
  debouncer.schedule();
  await sleep(50);
  assert.equal(runs, 0);
});

test("watchChanges delivers every newline-delimited frame", async () => {
  const restore = globalThis.fetch;
  const encoder = new TextEncoder();
  let opened = false;
  const frames = [];
  globalThis.fetch = async () =>
    new Response(
      new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode('{"t":"ready","files":true}\n{"t":"file"}\n'));
          controller.enqueue(encoder.encode('{"t":"ping"}\n'));
          controller.close();
        },
      }),
      { status: 200, headers: { "content-type": "application/x-ndjson" } },
    );
  try {
    await watchChanges("session-1", {
      signal: new AbortController().signal,
      onOpen: () => {
        opened = true;
      },
      onFrame: (frame) => frames.push(frame.t),
    });
    assert.equal(opened, true);
    assert.deepEqual(frames, ["ready", "file", "ping"]);
  } finally {
    globalThis.fetch = restore;
  }
});

test("watchChanges rejects when the Host refuses the route", async () => {
  const restore = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: false, status: 404 });
  try {
    await assert.rejects(watchChanges("session-1", { signal: new AbortController().signal }));
  } finally {
    globalThis.fetch = restore;
  }
});
