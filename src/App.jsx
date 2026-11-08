import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import * as store from "./store.js";
import { gsap, ScrollTrigger, lockScroll, reduced, scrollTop, startLenis } from "./motion.js";

export const TYPES = ["Website", "Landing page", "UI component", "Animation", "Graphic", "Image", "Typography", "Color", "Copy", "Other"];
const MAX = 20 * 1024 * 1024;
const spring = { type: "spring", stiffness: 420, damping: 36, mass: 0.8 };

/* ---------- helpers ---------- */
export const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return ""; } };
export const safeUrl = (u) => { try { const x = new URL(u); return /^https?:$/.test(x.protocol) ? x.href : ""; } catch { return ""; } };
const niceName = (u) => { const h = host(u); if (!h) return ""; const b = h.split(".").slice(-2, -1)[0] || h; return b[0].toUpperCase() + b.slice(1); };
const fmtDate = (t) => (t ? new Date(t).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" }) : "");
const isTyping = () => /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName);
const fmtBytes = (n) => (n > 1e9 ? (n / 1e9).toFixed(1) + " GB" : n > 1e6 ? (n / 1e6).toFixed(1) + " MB" : Math.round(n / 1e3) + " KB");

function useMedia(id) {
  const [m, setM] = useState(null);
  useEffect(() => { let live = true; setM(null); store.fileUrl(id).then((u) => live && setM(u)); return () => { live = false; }; }, [id]);
  return m;
}
function useColumns(ref, min = 260, gap = 24, max = 4) {
  const [n, setN] = useState(3);
  useLayoutEffect(() => {
    const el = ref.current; if (!el) return;
    const ro = new ResizeObserver(([e]) => setN(Math.max(1, Math.min(max, Math.floor((e.contentRect.width + gap) / (min + gap))))));
    ro.observe(el); return () => ro.disconnect();
  }, [ref, min, gap, max]);
  return n;
}

/* ---------- media ---------- */
function Media({ it, className = "thumb", eager }) {
  const m = useMedia(it.imageId);
  if (it.imageId && m) {
    return (
      <div className={className}>
        {m.type.startsWith("video/")
          ? <video src={m.src} muted loop playsInline autoPlay preload="metadata" />
          : <img src={m.src} alt="" loading={eager ? "eager" : "lazy"} />}
      </div>
    );
  }
  if (it.imageId && !m) return <div className={className + " skeleton"} />;
  const n = niceName(it.url) || it.title || "Ref";
  return <div className="fallback"><b>{n}</b></div>;
}

/* ---------- card (Motion: layout + enter/exit; GSAP: scroll reveal) ---------- */
function Card({ it, onOpen, onFav }) {
  const inner = useRef(null);
  useEffect(() => {
    if (reduced()) return;
    const tw = gsap.fromTo(inner.current, { y: 36, opacity: 0 }, {
      y: 0, opacity: 1, duration: 0.8, ease: "power3.out",
      scrollTrigger: { trigger: inner.current, start: "top 95%", once: true },
    });
    return () => { tw.scrollTrigger?.kill(); tw.kill(); };
  }, []);
  const url = safeUrl(it.url);
  return (
    <motion.article
      layout="position"
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.94, transition: { duration: 0.18 } }}
      transition={spring}
      className="card"
      tabIndex={0}
      aria-label={it.title}
      onClick={() => onOpen(it.id)}
      onKeyDown={(e) => e.key === "Enter" && e.target === e.currentTarget && onOpen(it.id)}
    >
      <div ref={inner}>
        <div className="media-wrap">
          <Media it={it} />
          {url && (
            <a className="visit" href={url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} aria-label={`Open ${host(url)}`}>↗</a>
          )}
        </div>
        <div className="cbody">
          <div className="ctop">
            <span className="type">{it.type}</span>
            <motion.button whileTap={{ scale: 0.75 }} className={"fav" + (it.fav ? " on" : "")} type="button"
              aria-label={it.fav ? "Remove from favorites" : "Add to favorites"} aria-pressed={!!it.fav}
              onClick={(e) => { e.stopPropagation(); onFav(it); }}>{it.fav ? "★" : "☆"}</motion.button>
          </div>
          <h3 className="ctitle">{it.title}</h3>
          <div className="domain">{host(it.url) || "no link"}</div>
          {!!it.tags?.length && <div className="ctags">{it.tags.slice(0, 4).map((t) => <span key={t} className="tag">#{t}</span>)}</div>}
        </div>
      </div>
    </motion.article>
  );
}

function Grid({ list, onOpen, onFav }) {
  const ref = useRef(null);
  const n = useColumns(ref);
  const cols = useMemo(() => { const c = Array.from({ length: n }, () => []); list.forEach((it, i) => c[i % n].push(it)); return c; }, [list, n]);
  useEffect(() => { const t = setTimeout(() => ScrollTrigger.refresh(), 450); return () => clearTimeout(t); }, [list, n]);
  return (
    <div className="grid" ref={ref} style={{ gridTemplateColumns: `repeat(${n}, minmax(0,1fr))` }}>
      {cols.map((col, ci) => (
        <div className="col" key={ci}>
          <AnimatePresence mode="popLayout" initial={false}>
            {col.map((it) => <Card key={it.id} it={it} onOpen={onOpen} onFav={onFav} />)}
          </AnimatePresence>
        </div>
      ))}
    </div>
  );
}

/* ---------- drawer ---------- */
function Drawer({ open, onClose, children, label }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    lockScroll(true);
    const prev = document.activeElement;
    const t = setTimeout(() => ref.current?.querySelector("input,textarea,select,button,a[href]")?.focus(), 60);
    const trap = (e) => {
      if (e.key !== "Tab" || !ref.current) return;
      const f = [...ref.current.querySelectorAll("a[href],button:not([disabled]),input,select,textarea,[tabindex='0']")].filter((x) => x.offsetParent);
      if (!f.length) return;
      const [a, z] = [f[0], f[f.length - 1]];
      if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); }
      else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
    };
    document.addEventListener("keydown", trap);
    return () => { clearTimeout(t); document.removeEventListener("keydown", trap); lockScroll(false); prev?.focus?.(); };
  }, [open]);
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div key="scrim" className="scrim" onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} />
          <motion.aside key="drawer" ref={ref} className="drawer" role="dialog" aria-modal="true" aria-label={label} data-lenis-prevent
            initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%", transition: { duration: 0.22, ease: [0.4, 0, 1, 1] } }}
            transition={{ type: "spring", stiffness: 340, damping: 38 }}>
            <motion.div className="dinner" initial="hide" animate="show"
              variants={{ show: { transition: { staggerChildren: 0.04, delayChildren: 0.08 } } }}>
              {children}
            </motion.div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
const Rise = ({ children, className, as = "div" }) => {
  const C = motion[as];
  return <C className={className} variants={{ hide: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0, transition: spring } }}>{children}</C>;
};

function Detail({ it, onClose, onEdit, onDelete, onTag, toast }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => { if (!armed) return; const t = setTimeout(() => setArmed(false), 3000); return () => clearTimeout(t); }, [armed]);
  const url = safeUrl(it.url);
  return (
    <>
      <Rise className="dhead"><span className="type">{it.type}</span><button className="x" type="button" onClick={onClose} aria-label="Close">×</button></Rise>
      <Rise className="dimg"><Media it={it} className="dmedia" eager /></Rise>
      <Rise as="h2">{it.title}</Rise>
      {url && <Rise className="durl">{url}</Rise>}
      <Rise className="actions">
        {url && <a className="btn primary" href={url} target="_blank" rel="noopener noreferrer">Open site ↗</a>}
        {url && <button className="btn" type="button" onClick={() => navigator.clipboard?.writeText(url).then(() => toast("Link copied"), () => toast("Select the link above and copy it"))}>Copy link</button>}
        <button className="btn" type="button" onClick={() => onEdit(it)}>Edit</button>
        <button className={"btn danger" + (armed ? " armed" : "")} type="button" onClick={() => (armed ? onDelete(it) : setArmed(true))}>{armed ? "Click again to delete" : "Delete"}</button>
      </Rise>
      {it.note && <Rise as="p" className="note">{it.note}</Rise>}
      {!!it.tags?.length && <Rise className="ctags">{it.tags.map((t) => <button key={t} type="button" className="tag" onClick={() => onTag(t)}>#{t}</button>)}</Rise>}
      <Rise as="dl" className="meta">
        <dt>Saved</dt><dd>{fmtDate(it.createdAt)}</dd>
        {it.updatedAt && it.updatedAt !== it.createdAt && <><dt>Edited</dt><dd>{fmtDate(it.updatedAt)}</dd></>}
      </Rise>
    </>
  );
}

function Form({ it = {}, prefillUrl = "", allTags, onClose, onSave, pasteRef, initialFile, toast }) {
  const [url, setUrl] = useState(it.url || prefillUrl);
  const [title, setTitle] = useState(it.title || niceName(prefillUrl));
  const autoTitle = useRef(!it.title); // title follows the link until the user types their own
  const [type, setType] = useState(it.type || "Website");
  const [tags, setTags] = useState((it.tags || []).join(", "));
  const [note, setNote] = useState(it.note || "");
  const [fav, setFav] = useState(!!it.fav);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [clear, setClear] = useState(false);
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const existing = useMedia(clear ? null : it.imageId);
  const input = useRef(null);

  const take = useCallback((f) => {
    if (!f) return;
    if (!/^(image|video)\//.test(f.type)) return toast("That file is not an image or video");
    if (f.size > MAX) return toast("File is over 20 MB. Compress it and try again");
    setFile(f); setClear(false);
    setPreview((p) => { if (p) URL.revokeObjectURL(p.src); return { src: URL.createObjectURL(f), type: f.type }; });
  }, [toast]);
  useEffect(() => { pasteRef.current = take; return () => { pasteRef.current = null; }; }, [take, pasteRef]);
  useEffect(() => { if (initialFile) take(initialFile); }, [initialFile, take]);
  useEffect(() => () => preview && URL.revokeObjectURL(preview.src), [preview]);

  const shown = preview || existing;
  const usedTags = tags.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean);
  const suggestions = allTags.filter((t) => !usedTags.includes(t)).slice(0, 12);

  async function submit(e) {
    e.preventDefault();
    const t = title.trim(), u = url.trim();
    if (!t && !u) return toast("Add a link or a title");
    if (u && !safeUrl(u)) return toast("Link needs to start with https://");
    setBusy(true);
    try {
      await onSave({ it, file, clear, body: {
        title: t || niceName(u), url: u, type, note: note.trim(), fav,
        tags: [...new Set(tags.split(",").map((x) => x.trim().toLowerCase().replace(/^#/, "")).filter(Boolean))],
      } });
    } catch (err) {
      setBusy(false);
      toast(err?.name === "QuotaExceededError" ? "Browser storage is full. Export a backup and delete old items" : "Could not save. Try again");
    }
  }

  return (
    <>
      <Rise className="dhead"><h2 style={{ fontSize: 18 }}>{it.id ? "Edit reference" : "Add reference"}</h2><button className="x" type="button" onClick={onClose} aria-label="Close">×</button></Rise>
      <form onSubmit={submit} noValidate>
        <Rise as="label" className="f">Link<input type="url" inputMode="url" placeholder="https://" value={url}
          onChange={(e) => { setUrl(e.target.value); if (autoTitle.current) setTitle(niceName(e.target.value)); }} /></Rise>
        <Rise as="label" className="f">Title<input type="text" placeholder="What is it? e.g. Stripe pricing hero" value={title} onChange={(e) => { autoTitle.current = !e.target.value; setTitle(e.target.value); }} onFocus={(e) => autoTitle.current && e.target.select()} /></Rise>
        <Rise className="row2">
          <label className="f">Type<select value={type} onChange={(e) => setType(e.target.value)}>{TYPES.map((t) => <option key={t}>{t}</option>)}</select></label>
          <label className="f">Tags<input type="text" placeholder="pricing, dark, motion" value={tags} onChange={(e) => setTags(e.target.value)} /></label>
        </Rise>
        {!!suggestions.length && (
          <Rise className="suggest">
            {suggestions.map((t) => <button key={t} type="button" className="tag" onClick={() => setTags((v) => (v.trim() ? v.replace(/,?\s*$/, ", ") : "") + t)}>+ {t}</button>)}
          </Rise>
        )}
        <Rise as="label" className="f">Why I saved it<textarea placeholder="What to steal: the sticky comparison table, the trust badges under the CTA..." value={note} onChange={(e) => setNote(e.target.value)} /></Rise>
        <Rise className="f">
          <span className="flabel">Screenshot</span>
          <div className={"drop" + (over ? " over" : "")} tabIndex={0} role="button" aria-label="Add screenshot"
            onClick={() => input.current.click()}
            onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), input.current.click())}
            onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
            onDrop={(e) => { e.preventDefault(); setOver(false); take(e.dataTransfer.files[0]); }}>
            {shown && (shown.type.startsWith("video/") ? <video src={shown.src} muted loop autoPlay playsInline /> : <img src={shown.src} alt="" />)}
            <span>{file ? `${file.name || "Pasted image"} ready. Click to replace` : shown ? "Click, drop or paste to replace" : clear ? "Screenshot will be removed when you save" : "Paste a screenshot (Ctrl/Cmd + V), drop an image or GIF, or click to choose"}</span>
            <input ref={input} type="file" hidden accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml,video/mp4,video/webm" onChange={(e) => take(e.target.files[0])} />
          </div>
          {(shown || it.imageId) && !clear && <button className="btn sm" type="button" onClick={() => { setClear(true); setFile(null); setPreview(null); }}>Remove screenshot</button>}
          <span className="hint">PNG, JPG, GIF, WebP, MP4 up to 20 MB. Without one, the card shows the site name.</span>
        </Rise>
        <Rise as="label" className="check"><input type="checkbox" checked={fav} onChange={(e) => setFav(e.target.checked)} /> Mark as favorite</Rise>
        <Rise className="actions">
          <button className="btn primary" type="submit" disabled={busy}>{busy ? "Saving…" : it.id ? "Save changes" : "Save reference"}</button>
          <button className="btn" type="button" onClick={onClose}>Cancel</button>
        </Rise>
      </form>
    </>
  );
}

function Backup({ onClose, count, reload, toast }) {
  const [u, setU] = useState(null);
  const [busy, setBusy] = useState(false);
  const file = useRef(null);
  useEffect(() => { store.usage().then(setU); }, [count]);
  async function doExport() {
    setBusy(true);
    try {
      const data = await store.exportAll();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([JSON.stringify(data)], { type: "application/json" }));
      a.download = `swipe-file-${new Date().toISOString().slice(0, 10)}.json`;
      a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      toast(`Exported ${data.items.length} references`);
    } catch { toast("Export failed. Try again"); }
    setBusy(false);
  }
  async function doImport(f) {
    if (!f) return;
    setBusy(true);
    try { const n = await store.importAll(JSON.parse(await f.text())); await reload(); toast(`Imported ${n} references`); }
    catch { toast("That file is not a Swipe File backup"); }
    setBusy(false);
  }
  return (
    <>
      <Rise className="dhead"><h2 style={{ fontSize: 18 }}>Backup and sync</h2><button className="x" type="button" onClick={onClose} aria-label="Close">×</button></Rise>
      <Rise as="p" className="muted">Your references are stored in this browser only. Export a backup regularly, and import it on another device or browser to move your library. Import merges by ID, so it never deletes anything.</Rise>
      <Rise as="dl" className="meta">
        <dt>References</dt><dd>{count}</dd>
        {u && <><dt>Storage used</dt><dd>{fmtBytes(u.used)} of {fmtBytes(u.quota)}</dd></>}
      </Rise>
      <Rise className="actions">
        <button className="btn primary" type="button" disabled={busy || !count} onClick={doExport}>Export backup (.json)</button>
        <button className="btn" type="button" disabled={busy} onClick={() => file.current.click()}>Import backup</button>
        <input ref={file} type="file" accept="application/json,.json" hidden onChange={(e) => { doImport(e.target.files[0]); e.target.value = ""; }} />
      </Rise>
    </>
  );
}

/* ---------- count ticker (GSAP) ---------- */
function Count({ n }) {
  const ref = useRef(null), val = useRef({ v: 0 });
  useEffect(() => {
    if (reduced()) { ref.current.textContent = `${n} saved`; return; }
    const tw = gsap.to(val.current, { v: n, duration: 0.9, ease: "power2.out", onUpdate: () => { if (ref.current) ref.current.textContent = `${Math.round(val.current.v)} saved`; } });
    return () => tw.kill();
  }, [n]);
  return <span className="count" ref={ref} aria-live="polite">0 saved</span>;
}

/* ---------- app ---------- */
export default function App() {
  const [items, setItems] = useState([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [type, setType] = useState("All");
  const [tags, setTags] = useState(() => new Set());
  const [q, setQ] = useState("");
  const [qLive, setQLive] = useState("");
  const [favOnly, setFavOnly] = useState(false);
  const [drawer, setDrawer] = useState(null); // {mode:'detail'|'form'|'backup', id?, item?, prefillUrl?, file?}
  const [msg, setMsg] = useState(null);
  const pasteRef = useRef(null);
  const headerRef = useRef(null);
  const searchRef = useRef(null);

  const toast = useCallback((m) => setMsg({ m, k: Date.now() }), []);
  useEffect(() => { if (!msg) return; const t = setTimeout(() => setMsg(null), 2400); return () => clearTimeout(t); }, [msg]);

  const reload = useCallback(async () => { setItems(await store.listItems()); }, []);
  useEffect(() => {
    if (!("indexedDB" in window)) { setError("This browser blocks local storage, so references cannot be saved here."); setReady(true); return; }
    reload().then(() => setReady(true)).catch(() => { setError("Could not open local storage. Private browsing can block it."); setReady(true); });
    store.requestPersist();
    startLenis();
  }, [reload]);

  // GSAP intro on the toolbar
  useLayoutEffect(() => {
    if (reduced()) return;
    const ctx = gsap.context(() => {
      gsap.from(".intro", { y: -14, opacity: 0, duration: 0.7, ease: "power3.out", stagger: 0.07, delay: 0.05 });
    }, headerRef);
    return () => ctx.revert();
  }, []);

  useEffect(() => { const t = setTimeout(() => setQ(qLive), 120); return () => clearTimeout(t); }, [qLive]);

  const list = useMemo(() => {
    const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return items.filter((it) => {
      if (favOnly && !it.fav) return false;
      if (type !== "All" && it.type !== type) return false;
      for (const t of tags) if (!(it.tags || []).includes(t)) return false;
      if (words.length) { const hay = [it.title, it.url, it.note, it.type, ...(it.tags || [])].join(" ").toLowerCase(); if (!words.every((w) => hay.includes(w))) return false; }
      return true;
    });
  }, [items, q, type, tags, favOnly]);

  const counts = useMemo(() => { const c = {}; items.forEach((i) => (c[i.type] = (c[i.type] || 0) + 1)); return c; }, [items]);
  const tagList = useMemo(() => {
    const c = {}; items.forEach((i) => (i.tags || []).forEach((t) => (c[t] = (c[t] || 0) + 1)));
    return Object.keys(c).sort((a, b) => c[b] - c[a] || a.localeCompare(b));
  }, [items]);
  const favN = items.filter((i) => i.fav).length;
  const filtersOn = type !== "All" || tags.size || q || favOnly;

  const clearFilters = () => { setType("All"); setTags(new Set()); setQ(""); setQLive(""); setFavOnly(false); };
  const toggleTag = (t) => setTags((s) => { const n = new Set(s); n.has(t) ? n.delete(t) : n.add(t); return n; });
  const close = useCallback(() => setDrawer(null), []);
  const openAdd = useCallback((extra = {}) => setDrawer({ mode: "form", ...extra }), []);

  async function save({ it, file, clear, body }) {
    const now = new Date().toISOString();
    let imageId = clear ? null : it.imageId || null;
    if (file) { imageId = store.uid(); await store.putFile(imageId, file); }
    const rec = { ...body, id: it.id || store.uid(), imageId, createdAt: it.createdAt || now, updatedAt: now };
    await store.putItem(rec);
    if (it.imageId && it.imageId !== imageId) { store.forgetUrl(it.imageId); store.deleteFile(it.imageId).catch(() => {}); }
    await reload();
    if (it.id) { setDrawer({ mode: "detail", id: rec.id }); toast("Saved"); }
    else { close(); toast("Added to Swipe File"); if (filtersOn) clearFilters(); scrollTop(); }
  }
  async function remove(it) {
    try {
      await store.deleteItem(it.id);
      if (it.imageId) { store.forgetUrl(it.imageId); store.deleteFile(it.imageId).catch(() => {}); }
      close(); await reload(); toast("Deleted");
    } catch { toast("Could not delete. Try again"); }
  }
  async function toggleFav(it) {
    try { await store.putItem({ ...it, fav: !it.fav }); await reload(); } catch { toast("Could not update favorite"); }
  }

  // Keyboard + paste
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape" && drawer) return close();
      if (e.key === "/" && !isTyping() && !drawer) { e.preventDefault(); searchRef.current?.focus(); }
      if ((e.key === "n" || e.key === "N") && !isTyping() && !drawer && !e.metaKey && !e.ctrlKey) { e.preventDefault(); openAdd(); }
    };
    const onPaste = (e) => {
      const img = [...(e.clipboardData?.items || [])].find((i) => i.kind === "file" && /^(image|video)\//.test(i.type));
      const formOpen = drawer?.mode === "form";
      if (img && formOpen && pasteRef.current) { e.preventDefault(); return pasteRef.current(img.getAsFile()); }
      if (img && !drawer) { e.preventDefault(); return openAdd({ file: img.getAsFile() }); }
      const txt = e.clipboardData?.getData("text")?.trim();
      if (!isTyping() && !drawer && txt && safeUrl(txt)) { e.preventDefault(); openAdd({ prefillUrl: txt }); }
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("paste", onPaste);
    return () => { document.removeEventListener("keydown", onKey); document.removeEventListener("paste", onPaste); };
  }, [drawer, close, openAdd]);

  const current = drawer?.id ? items.find((i) => i.id === drawer.id) : drawer?.item;
  useEffect(() => { if (drawer?.mode === "detail" && !current) close(); }, [drawer, current, close]);

  return (
    <>
      <header ref={headerRef}>
        <div className="wrap">
          <div className="bar">
            <div className="brand intro"><h1>Swipe File</h1><Count n={items.length} /></div>
            <label className="search intro">
              <input ref={searchRef} type="search" placeholder="Search title, site, tag, note" aria-label="Search" value={qLive} onChange={(e) => setQLive(e.target.value)} />
              <kbd>/</kbd>
            </label>
            <button className="btn ghost intro" type="button" onClick={() => setDrawer({ mode: "backup" })}>Backup</button>
            <motion.button whileHover={{ y: -1 }} whileTap={{ scale: 0.96 }} className="btn primary intro" type="button" onClick={() => openAdd()}>+ Add <kbd className="inv">N</kbd></motion.button>
          </div>
          {!!items.length && (
            <div className="filters intro" role="toolbar" aria-label="Filter by type">
              {[["All", items.length], ...TYPES.filter((t) => counts[t]).map((t) => [t, counts[t]])].map(([t, n]) => (
                <button key={t} className="chip" type="button" aria-pressed={!favOnly && type === t} onClick={() => { setType(t); setFavOnly(false); }}>
                  {!favOnly && type === t && <motion.i layoutId="chipbg" className="chipbg" transition={spring} />}
                  <em>{t}</em> <span>{n}</span>
                </button>
              ))}
              {!!favN && (
                <button className="chip" type="button" aria-pressed={favOnly} onClick={() => setFavOnly((v) => !v)}>
                  {favOnly && <motion.i layoutId="chipbg" className="chipbg" transition={spring} />}
                  <em>★ Favorites</em> <span>{favN}</span>
                </button>
              )}
            </div>
          )}
        </div>
      </header>

      <main className="wrap">
        {error && <div className="notice">{error}</div>}
        {!!tagList.length && (
          <div className="tagrow">
            <span className="lbl">Tags</span>
            {tagList.map((t) => (
              <motion.button layout key={t} type="button" className={"tag" + (tags.has(t) ? " on" : "")} onClick={() => toggleTag(t)} aria-pressed={tags.has(t)}>#{t}</motion.button>
            ))}
            {filtersOn && <button type="button" className="tag clear" onClick={clearFilters}>Clear all</button>}
          </div>
        )}
        <div className="view">
          {!ready ? null : !items.length ? (
            <motion.div className="empty" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={spring}>
              <h2>Your references will show up here</h2>
              <p>Save websites, animations, graphics and images with a link, a screenshot and tags. Press <b>+ Add</b>, paste a URL anywhere on this page, or paste a screenshot straight from your clipboard.</p>
              <button className="btn primary" type="button" onClick={() => openAdd()}>+ Add first reference</button>
            </motion.div>
          ) : !list.length ? (
            <motion.div className="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <h2>Nothing matches</h2>
              <p>Clear the search or a filter to see more.</p>
              <button className="btn" type="button" onClick={clearFilters}>Clear filters</button>
            </motion.div>
          ) : (
            <Grid list={list} onOpen={(id) => setDrawer({ mode: "detail", id })} onFav={toggleFav} />
          )}
        </div>
      </main>

      <Drawer open={!!drawer} onClose={close} label={drawer?.mode === "form" ? "Reference form" : drawer?.mode === "backup" ? "Backup" : "Reference details"}>
        {drawer?.mode === "detail" && current && (
          <Detail key={"d" + current.id} it={current} onClose={close} toast={toast}
            onEdit={(it) => setDrawer({ mode: "form", item: it })}
            onDelete={remove}
            onTag={(t) => { setTags(new Set([t])); setType("All"); setFavOnly(false); close(); }} />
        )}
        {drawer?.mode === "form" && (
          <Form key={"f" + (drawer.item?.id || "new")} it={drawer.item} prefillUrl={drawer.prefillUrl} initialFile={drawer.file}
            allTags={tagList} onClose={close} onSave={save} pasteRef={pasteRef} toast={toast} />
        )}
        {drawer?.mode === "backup" && <Backup onClose={close} count={items.length} reload={reload} toast={toast} />}
      </Drawer>

      <AnimatePresence>
        {msg && (
          <motion.div key={msg.k} className="toast" role="status" initial={{ opacity: 0, y: 16, x: "-50%" }} animate={{ opacity: 1, y: 0, x: "-50%" }} exit={{ opacity: 0, y: 8, x: "-50%" }} transition={spring}>
            {msg.m}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
