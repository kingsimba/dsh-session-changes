# Changelog

- 2026-10-29 review: highlight every occurrence of a token selected in the diff view

- 2026-10-28 perf: keep the comparison's payload, its diff model, and the rendered pane stable while the
  sidebar expands, collapses, or resizes. Those gestures used to re-render the tab body with a fresh row
  object, which defeated the comparison memo: a long diff in **Full** scope was re-diffed, re-highlighted,
  and rebuilt row by row while the panel was sliding, so the animation stuttered. The selected row now
  survives a geometry-only render, the sidebar re-read of an unchanged file list keeps the previous array
  (so reopening no longer re-reads every file's counts and comparison), and the list width is capped in
  CSS instead of by a `ResizeObserver` that reset the remembered width and re-rendered the tab on every
  frame of a width change.
- 2026-10-27 review: remember the selected file, the last row counts and the comparison's scroll
  offsets per Session, so switching Session or workspace and coming back restores them. Rows never
  render `+undefined` while counts load (a quiet `…` instead), and files with no remaining change no
  longer flash in before the counts arrive.
- 2026-10-27 review: apply a block's accept/revert from the texts already on screen instead of
  re-reading the comparison, and keep the previous comparison mounted while a background refresh
  runs. The diff no longer unmounts, so accepting a block no longer jumps the pane back to the top.
- 2026-10-27 review: hover a file row for per-file **Accept** / **Revert**, and use the new
  **Accept All** / **Revert All** row at the top of the list (Revert All asks in place first). The new
  `apply-file` / `apply-all` routes copy bytes, so binary files are restored exactly. Each mounted tab
  now names itself on the watch stream and on its writes; the Host leaves that tab's own invalidation
  echoes (including the `fs.watch` echo of a revert) out of its stream, so a successful action
  refreshes once instead of twice.
- 2026-10-27 shortcuts: add an editable Mod+Alt+D command to open the Changes page
- 2026-10-27 review: accept or revert one change block from the comparison. Hovering a changed block
  shows **Accept** / **Revert**; Accept rewrites the stored pre-image so the block stops reading as a
  change, Revert writes the pre-image's lines back to the file on disk (reverting every line of a file
  the Session created removes it). Both are guarded by a SHA-256 digest of the side the browser last
  read, so an edit that landed after the diff was drawn is refused with `409` instead of overwritten.
- 2026-10-27 chore: switch the checkout to pnpm
- 2026-10-27 docs: add a Changes page screenshot to the README
- 2026-10-27 release: make the 0.13.1 package publishable — drop `private`, add `engines.dsh`,
  repository/homepage/keywords, an MIT LICENSE, an icon, exported locale meta, and npm/Git install
  instructions
- 2026-10-27 ui: restore the Full/hunks scope switch and the ⤴ open-in-default-application button; the
  Host grows a POST `api/session-changes.open` that only opens a path this Session captured
- 2026-10-27 store: the list now comes from the plugin's own pre-image store instead of the recorder's
  per-turn summaries — it survives a restart, gains a new file as soon as its pre-image is captured, and
  no longer depends on `workspaceChanges` / `session/event`
- 2026-10-27 simplify: drop the By-turn mode, its turn strip and the Full/hunks switch — the page always
  diffs the Session's first pre-image against the file as it stands now
- 2026-10-27 auto refresh: the Host streams a frame per listed-file change and per committed
  `workspace/changes`; the visible tab re-reads 1 s after the burst settles, including the whole-file
  and pre-image sides; Overall's row counts and header totals are now live, and a file edited back to its
  pre-image drops out of the list
- 2026-10-27 list: keep only the files this Session's file tools changed, so a build script's output no
  longer shows up as an undiffable row; paths outside the workspace are still listed, and their pre-image
  is now kept in the sibling `_external` store so Overall can compare them too
- 2026-10-26 overall: Stop rebuilding a missing pre-image from the turns
