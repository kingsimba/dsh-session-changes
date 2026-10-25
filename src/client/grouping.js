/**
 * Group one turn's files by their folder.
 * @param files - the summary's file rows.
 * @param entryOf - builds one file's review coordinates.
 * @returns folder groups in first-seen order.
 */
export function groupFiles(files, entryOf) {
  const folders = [];
  const byFolder = new Map();
  for (let index = 0; index < files.length; index += 1) {
    const file = files[index];
    const segments = String(file.display).split(/[\\/]/);
    const name = segments.pop() ?? String(file.display);
    const folder = segments.join("/");
    let bucket = byFolder.get(folder);
    if (bucket === undefined) {
      bucket = [];
      byFolder.set(folder, bucket);
      folders.push(folder);
    }
    bucket.push({ file, name, entries: [entryOf(index)] });
  }
  return folders.map((folder) => ({ folder, files: byFolder.get(folder) }));
}

/**
 * Fold every turn into one file list: one row per path, counts summed, and every
 * turn that touched the file kept for the stacked comparison.
 *
 * @param turns - the Session's recorded turns, newest first.
 * @returns the folder groups and the number of distinct files.
 */
export function groupOverall(turns) {
  const byPath = new Map();
  for (const turn of turns) {
    const files = Array.isArray(turn.files) ? turn.files : [];
    for (let index = 0; index < files.length; index += 1) {
      const file = files[index];
      let record = byPath.get(file.path);
      if (record === undefined) {
        const segments = String(file.display).split(/[\\/]/);
        const name = segments.pop() ?? String(file.display);
        record = {
          file,
          name,
          folder: segments.join("/"),
          added: 0,
          deleted: 0,
          entries: [],
        };
        byPath.set(file.path, record);
      }
      record.added += file.added;
      record.deleted += file.deleted;
      record.entries.push({ seq: turn.seq, turn: turn.turn, index });
    }
  }
  const folders = [];
  const byFolder = new Map();
  for (const record of byPath.values()) {
    let bucket = byFolder.get(record.folder);
    if (bucket === undefined) {
      bucket = [];
      byFolder.set(record.folder, bucket);
      folders.push(record.folder);
    }
    bucket.push({
      file: {
        path: record.file.path,
        display: record.file.display,
        added: record.added,
        deleted: record.deleted,
        binary: record.file.binary,
        oversized: record.file.oversized,
      },
      name: record.name,
      entries: record.entries,
    });
  }
  return {
    folders: folders.map((folder) => ({ folder, files: byFolder.get(folder) })),
    count: byPath.size,
  };
}
