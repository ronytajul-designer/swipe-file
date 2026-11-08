// Local-first storage: items + screenshot blobs live in IndexedDB in this browser.
// Export/Import gives a portable JSON backup (images embedded as data URLs).
const DB_NAME = "swipe-file";
const VERSION = 1;
let dbp;

function openDb() {
  return (dbp ||= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("items")) db.createObjectStore("items", { keyPath: "id" });
      if (!db.objectStoreNames.contains("files")) db.createObjectStore("files");
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  }));
}

function run(store, mode, fn) {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(store, mode);
        const out = fn(tx.objectStore(store));
        tx.oncomplete = () => resolve(out && "result" in out ? out.result : undefined);
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      })
  );
}

export const uid = () =>
  (crypto.randomUUID?.() || Date.now().toString(36) + Math.random().toString(36).slice(2)).replace(/-/g, "");

export async function listItems() {
  const all = (await run("items", "readonly", (s) => s.getAll())) || [];
  return all.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
}
export const putItem = (item) => run("items", "readwrite", (s) => s.put(item));
export const deleteItem = (id) => run("items", "readwrite", (s) => s.delete(id));
export const putFile = (id, blob) => run("files", "readwrite", (s) => s.put(blob, id));
export const getFile = (id) => run("files", "readonly", (s) => s.get(id));
export const deleteFile = (id) => run("files", "readwrite", (s) => s.delete(id));

/* Object URL cache so every card/drawer reuses one URL per blob */
const urls = new Map();
export async function fileUrl(id) {
  if (!id) return null;
  if (urls.has(id)) return urls.get(id);
  const blob = await getFile(id);
  if (!blob) return null;
  const u = { src: URL.createObjectURL(blob), type: blob.type || "image/png" };
  urls.set(id, u);
  return u;
}
export function forgetUrl(id) {
  const u = urls.get(id);
  if (u) URL.revokeObjectURL(u.src);
  urls.delete(id);
}

const toDataUrl = (blob) =>
  new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = () => rej(r.error);
    r.readAsDataURL(blob);
  });

export async function exportAll() {
  const items = await listItems();
  const files = {};
  for (const it of items) {
    if (!it.imageId) continue;
    const b = await getFile(it.imageId);
    if (b) files[it.imageId] = await toDataUrl(b);
  }
  return { app: "swipe-file", version: 1, exportedAt: new Date().toISOString(), items, files };
}

export async function importAll(data) {
  if (!data || data.app !== "swipe-file" || !Array.isArray(data.items)) throw new Error("not_a_backup");
  let n = 0;
  for (const [id, url] of Object.entries(data.files || {})) {
    const blob = await (await fetch(url)).blob();
    await putFile(id, blob);
  }
  for (const it of data.items) {
    if (!it || !it.id) continue;
    await putItem(it);
    n++;
  }
  return n;
}

export async function requestPersist() {
  try {
    if (navigator.storage?.persist && !(await navigator.storage.persisted())) await navigator.storage.persist();
  } catch {}
}
export async function usage() {
  try {
    const e = await navigator.storage?.estimate?.();
    return e ? { used: e.usage || 0, quota: e.quota || 0 } : null;
  } catch {
    return null;
  }
}
