# Changelog

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
