/**
 * Group a flat file list by folder.
 * @param files - `{ path, display }[]` as the Host lists them.
 * @returns the folder groups and the number of files.
 */
export function groupFiles(files) {
  const folders = [];
  const byFolder = new Map();
  for (const file of files) {
    const segments = String(file.display).split(/[\\/]/);
    const name = segments.pop() ?? String(file.display);
    const folder = segments.join("/");
    let bucket = byFolder.get(folder);
    if (bucket === undefined) {
      bucket = [];
      byFolder.set(folder, bucket);
      folders.push(folder);
    }
    bucket.push({ file, name });
  }
  return {
    folders: folders.map((folder) => ({ folder, files: byFolder.get(folder) })),
    count: files.length,
  };
}
