# dsh-session-changes

An always-available **Changes** page for the DeepSeek Harness right sidebar: a master–detail split with
every file the current Session changed on the left, grouped by turn, and the selected file's
**side-by-side comparison** on the right. The divider between them is draggable.

## Why

The built-in changed-files card lives in the transcript and scrolls away, and the Review tab it opens
is a right-sidebar tab. Closing that tab used to leave no way back except scrolling to the turn. This
page is a docked tab type, so it stays reachable: `+` (add tab) → **Changes**, any time.

## Layout

```
┌────────────────────┬─┬──────────────────────────────────┐
│ Session changes    │ │ src/app.ts        +12 −3 ↵ ⤴ ↗   │
│ Turn 3      2 files│ │ ┌────────────┬─────────────────┐ │
│ src/               │ │ │ 41  const… │ 41  const…      │ │
│   app.ts    +12 −3 │ │ │ 42 -old    │ 42 +new         │ │
│ ./                 │ │ │ 43 -gone   │ 43 +added       │ │
│   README.md  +4 −1 │ │ └────────────┴─────────────────┘ │
└────────────────────┴─┴──────────────────────────────────┘
                  ↑ drag to resize
```

* **Files are grouped by folder** inside each turn: one muted monospace line per folder (`src/components/`,
  or `./` for the workspace root), then the file names alone beneath it — so the list stays narrow and
  the mouse target stays on the name. Folder lines are labels, not collapsible headers.
* **Syntax colours come from the same tokenizer the built-in Review tab uses** — `useCodeHighlighter` and
  `languageForPath` from `@deepseek-ai/dsh-client-ui-primitives` (Shiki). Like the Review tab, each hunk
  side is tokenized independently, because the omitted source lines make whole-file tokenization
  impossible. If the primitives module is not exposed to this plugin, the pane degrades to plain text;
  the grid carries `data-spans="false"` when that happens.
* **Two modes** — `By turn` keeps a **turn strip above the comparison** (every turn, oldest first, newest
  selected by default) and the left list shows **that turn's files**, so the strip drives both panes.
  `Overall` merges every turn into one row per file with counts summed, and the comparison becomes the
  baseline→current diff. The mode choice is remembered.
* **Drag the divider** (or focus it and press ←/→, Shift for a bigger step) to resize the list. The
  width is remembered per browser.
* **↵** toggles line wrapping. Unwrapped keeps a **fixed 50/50 split**: each lane is its own scroll
  surface and the two are kept in step (vertical and horizontal offsets), so a long line scrolls inside
  its own half instead of widening the pane or moving the divider. Wrapped turns the pane into one 50/50
  grid that wraps inside the cells.
* **Full / hunks** and **Split / Inline** are two independent axes:
  * **Full** changes the *scope* — hunks only, or the whole file. It rebuilds the file's text on both
    sides of the comparison (`reverseHunks` back through the newer turns), so the full view is a real
    whole-file diff, not just the current text.
  * **Split / Inline** changes the *layout* — two 50/50 lanes, or one column with both line numbers, a
    sign, and the line. Either layout renders either scope.
* **⤴** opens the selected file in its default application — VSCode, if that is what the extension is
  associated with. It opens the **live file on disk**, not the turn's snapshot, so you can edit it there.
* **↗** opens the same file in the built-in **Review** tab, if you want the full-width view.
* Selections survive a refresh of the list; **↻** re-reads both the list and the comparison.

## Overall mode

`Overall` answers *"what changed since this task started"*: selecting a file rebuilds the text it had
**before the Session's first recorded turn**, and diffs that against the file as it stands now.

* the list is one row per file, deduplicated by path, with `+added/−deleted` summed over every turn;
* the comparison is a **single** diff (baseline → current), not a set of per-turn diffs;
* the baseline is rebuilt by walking the file backwards through every turn that touched it
  (`reverseHunks`), checking each hunk against the text as it stood at that point;
* if a hunk no longer lines up — the file was edited outside the recorded turns — the view says so
  rather than showing a plausible-looking wrong diff;
* a file created during the Session has an empty baseline, so it reads as entirely added.

Limits: it needs every turn's comparison for that file still served by the Host (same process lifetime
rule as the rest), and files whose middle changes are larger than the diff budget fall back to a note.

A merged diff (Session start → now, per file) is not derivable from the public API: the Host serves only
per-turn hunks (`api/changes.diff?seq&index`), never a file's text at the start of the Session, and the
recorder's captured copies are private to `dsh-workspace-changes`. Producing one needs a host change — a
route that diffs the earliest capture against the current file.

## Editing

DSH's file surfaces are previews: the sidebar document viewer is documented as *preview, not editing*,
and the Agent owns writes. To edit by hand use one of:

* **⤴** here, or the sidebar preview's default-application control — one file.
* The Session header's **Open In…** split button — the whole workspace directory in the remembered app
  (pick VSCode once and it stays).

There is no in-app code editor. Adding one (Monaco/CodeMirror) would put a second writer on every file
the Agent may also be editing, with no LSP and a multi-megabyte bundle; the hand-off above is the
supported path.

## Install

The Desktop profile is managed by the Electron app, so install it the way the app expects:

1. Sidebar → **Plugins** → **Add plugin**
2. Paste the absolute directory:

   ```
   C:\Users\kingsimba\Documents\deepseek-harness\default-workspace\plugins\dsh-session-changes
   ```

3. Confirm **Install** and let it compose.
4. Refresh the app window (Ctrl+R) so the browser loads the new client bundle.
5. In the right sidebar, click **+** (add tab) → **Changes**.

To remove it: **Plugins** → the bundle's page → remove. Nothing else in the profile is touched.

## What it reads

* Host half: one authenticated GET route, `api/session-changes.list?sessionId=…`, which walks the
  Session log for `workspace/changes` announcements and joins each sequence with the recorder's live
  summary (`workspaceChanges.summary`). Newest turn first.
* Browser half: a `builtin`-band page tab type plus one `sidebar.right.pane.tab` body. Selecting a file
  reads that comparison from the existing `api/changes.diff` route (the same one the built-in Review tab
  uses) and caches it per tab; **↻** clears the cache and re-reads.

## Updating a local install

The installer links the profile to this directory (`link:…` in the profile's `package.json`), so edits
here are live: change `lib/client.js`, then **Ctrl+R**. Only a change to the Host half (`lib/index.js`,
`cordis.patch.yml`, `package.json`) needs the plugin re-composed — disable and re-enable it on its
Plugins page.

## Known limits

These are inherited from the recorder, not this plugin:

* Summaries live only as long as the Session in the running Host process. After an app restart, older
  turns have no comparison and therefore drop out of this list.
* Outside a git work tree the recorder lists **file-tool edits only** — files written by shell commands
  in a non-repository workspace are not listed.
* The list is per Session; it is not a git working-tree view and does not show uncommitted changes
  made outside the agent.
