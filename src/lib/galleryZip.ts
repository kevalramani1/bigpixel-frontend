import { ZipWriter } from "@zip.js/zip.js/lib/zip-core-native.js";

type Photo = { id: number; url: string };

export async function createGalleryZip(
  name: string,
  photoIds: number[],
  refreshPhotos: () => Promise<Photo[]>,
  onProgress: (completed: number) => void,
  signal: AbortSignal,
) {
  if (!navigator.storage?.getDirectory) {
    throw new Error("ZIP downloads need an updated browser with local storage enabled.");
  }
  const root = await (await navigator.storage.getDirectory()).getDirectoryHandle("bigpixel-downloads", { create: true });
  // Remove abandoned exports left by tabs closed before cleanup could run.
  for await (const [entry] of root as FileSystemDirectoryHandle & AsyncIterable<[string, FileSystemHandle]>) {
    const created = Number(entry.split("-")[0]);
    if (created > 0 && created < Date.now() - 86_400_000) await root.removeEntry(entry, { recursive: true });
  }
  const directoryName = `${Date.now()}-${crypto.randomUUID()}`;
  const directory = await root.getDirectoryHandle(directoryName, { create: true });
  const cleanup = () => root.removeEntry(directoryName, { recursive: true });
  let output: FileSystemWritableFileStream | undefined;
  try {
    const archive = await directory.getFileHandle("gallery.zip", { create: true });
    const source = await directory.getFileHandle("photo", { create: true });
    // shortcut: disk-backed ZIPs require modern OPFS support; use a server export job if older browsers must be supported.
    if (typeof archive.createWritable !== "function") throw new Error("ZIP downloads need an updated browser with local storage enabled.");
    output = await archive.createWritable();
    const zip = new ZipWriter(output, { level: 0, zip64: true, bufferedWrite: false, useWebWorkers: false });
    const folder = name.replace(/[^a-z0-9]/gi, "_").toLowerCase() || "gallery";
    let photos = new Map((await refreshPhotos()).map((photo) => [photo.id, photo]));
    let refreshedAt = Date.now();
    for (const [index, id] of photoIds.entries()) {
      let file: File | undefined;
      // Stage one original on disk so a broken response can be retried before adding it to the ZIP.
      for (let attempt = 0; attempt < 3; attempt++) {
        signal.throwIfAborted();
        try {
          if (attempt > 0 || Date.now() - refreshedAt > 300_000) {
            photos = new Map((await refreshPhotos()).map((photo) => [photo.id, photo]));
            refreshedAt = Date.now();
          }
          const photo = photos.get(id);
          if (!photo?.url) throw new Error(`Photo ${index + 1} is unavailable. Refresh the gallery and try again.`);
          const requestSignal = AbortSignal.any([signal, AbortSignal.timeout(300_000)]);
          const response = await fetch(photo.url, { signal: requestSignal });
          if (!response.ok || !response.body || /^(text\/|application\/(json|xml))/.test(response.headers.get("Content-Type") || "")) {
            await response.body?.cancel();
            throw new Error(`Photo ${index + 1} could not download (HTTP ${response.status}). Please try again.`);
          }
          await response.body.pipeTo(await source.createWritable(), { signal: requestSignal });
          file = await source.getFile();
          if (!file.size) throw new Error(`Photo ${index + 1} is empty. Please try again.`);
          break;
        } catch (error) {
          signal.throwIfAborted();
          if (attempt === 2 || (error instanceof DOMException && error.name === "QuotaExceededError")) throw error;
          await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
        }
      }
      if (!file) throw new Error(`Photo ${index + 1} could not download.`);
      await zip.add(`${folder}/photo_${index + 1}.jpg`, file.stream(), { signal });
      onProgress(index + 1);
    }
    signal.throwIfAborted();
    await zip.close();
    await directory.removeEntry("photo");
    return { file: await archive.getFile(), cleanup };
  } catch (error) {
    await output?.abort().catch(() => {});
    await cleanup().catch(() => {});
    if (error instanceof DOMException && error.name === "QuotaExceededError") {
      throw new Error("Not enough free storage to prepare the ZIP. Free some space and try again.");
    }
    throw error;
  }
}
