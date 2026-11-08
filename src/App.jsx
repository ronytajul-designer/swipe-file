import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import * as store from "./store.js";
import { fetchMeta } from "./meta.js";
import { gsap, ScrollTrigger, lockScroll, reduced, scrollTop, startLenis } from "./motion.js";
import { Icon } from "./icons.jsx";

export const TYPES = ["Website", "Landing page", "UI component", "Animation", "Graphic", "Image", "Typography", "Color", "Copy", "Quote", "Note", "Other"];
const MAX = 20 * 1024 * 1024;
const spring = { type: "spring", stiffness: 420, damping: 38, mass: 0.8 };
const soft = { type: "spring", stiffness: 260, damping: 32 };

/* ---------- helpers ---------- */
const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return ""; } };
const safeUrl = (u) => { try { const x = new URL(u); return /^https?:$/.test(x.protocol) ? x.href : ""; } catch { return ""; } };
const niceName = (u) => { const h = host(u); if (!h) return ""; const b = h.split(".").slice(-2, -1)[0] || h; return b[0].toUpperCase() + b.slice(1); };
const isTyping = () => /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName) || document.activeElement?.isContentEditable;
const fmtBytes = (n) => (n > 1e9 ? (n / 1e9).toFixed(1) + " GB" : n > 1e6 ? (n / 1e6).toFixed(1) + " MB" : Math.round(n / 1e3) + " KB");
const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
function ago(t) {
  if (!t) return "";
  const s = (new Date(t) - Date.now()) / 1000;
  const steps = [[60, "second"], [60, "minute"], [24, "hour"], [7, "day"], [4.345, "week"], [12, "month"], [Infinity, "year"]];
  let v = s;
  for (const [n, u] of steps) { if (Math.abs(v) < n) return rtf.format(Math.round(v), u); v /= n; }
}
function shuffle(arr, seed) {
  const a = arr.slice(); let s = seed;
  const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
const kindOf = (it, broken) => {
  if (it.imageId || (it.cover && !broken)) return "media";
  if (it.type === "Quote" || it.type === "Copy") return "quote";
  if (it.type === "Note" || (!it.url && it.note)) return "note";
  return "link";
};

function useMedia(id) {
  const [m, setM] = useState(null);
  useEffect(() => { let live = true; setM(null); store.fileUrl(id).then((u) => live && setM(u)); return () => { live = false; }; }, [id]);
  return m;
}
function useColumns(ref, min = 250, gap = 28, max = 6) {
  const [n, setN] = useState(4);
  useLayoutEffect(() => {
    const el = ref.current; if (!el) return;
    const ro = new ResizeObserver(([e]) => setN(Math.max(1, Math.min(max, Math.floor((e.contentRect.width + gap) / (min + gap))))));
    ro.observe(el); return () => ro.disconnect();
  }, [ref, min, gap, max]);
  return n;
}

/* ---------- media (shared layoutId between card and modal) ---------- */
function Visual({ it, shared, onBroken, eager }) {
  const m = useMedia(it.imageId);
  if (it.imageId && !m) return <div className="skeleton" />;
  const src = m?.src || it.cover;
  if (!src) return null;
  const p = { layoutId: shared ? "v-" + it.id : undefined, className: "visual", transition: soft };
  return m?.type?.startsWith("video/")
    ? <motion.video {...p} src={src} muted loop playsInline autoPlay preload="metadata" />
    : <motion.img {...p} src={src} alt="" loading={eager ? "eager" : "lazy"} referrerPolicy="no-referrer" onError={onBroken} />;
}

/* ---------- tile body by kind ---------- */
function Favicon({ it }) {
  const h = host(it.url);
  if (!h) return <span className="favicon"><Icon.book /></span>;
  return <img className="favicon" alt="" src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(h)}&sz=64`} referrerPolicy="no-referrer" />;
}
function TileBody({ it, kind, onBroken, shared, big }) {
  if (kind === "media") return <Visual it={it} shared={shared} onBroken={onBroken} eager={big} />;
  if (kind === "quote") return (
    <div className="t-quote"><span className="qmark" aria-hidden>“</span><p>{it.note || it.title}</p><span className="qmark" aria-hidden>”</span></div>
  );
  if (kind === "note") return (
    <div className="t-note">{it.title && it.note && <div className="eyebrow">{it.title}</div>}<p>{it.note || it.title}</p></div>
  );
  return (
    <div className="t-link"><Favicon it={it} /><h3>{it.title || niceName(it.url) || "Untitled"}</h3>{big && it.desc && <p>{it.desc}</p>}</div>
  );
}
const captionOf = (it, kind) =>
  kind === "media" ? it.title || host(it.url)
  : kind === "link" ? host(it.url) || it.type
  : kind === "quote" ? (it.note ? it.title : "") || it.type
  : it.note && it.title ? "Note" : it.type;

/* ---------- card ---------- */
function Card({ it, onOpen, onFav }) {
  const inner = useRef(null);
  const [broken, setBroken] = useState(false);
  const kind = kindOf(it, broken);
  const url = safeUrl(it.url);
  useEffect(() => {
    if (reduced()) return;
    const tw = gsap.fromTo(inner.current, { y: 40, opacity: 0 }, {
      y: 0, opacity: 1, duration: 0.9, ease: "power3.out", clearProps: "transform",
      scrollTrigger: { trigger: inner.current, start: "top 96%", once: true },
    });
    return () => { tw.scrollTrigger?.kill(); tw.kill(); };
  }, []);
  return (
    <motion.article layout="position" className="card"
      initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.94, transition: { duration: 0.18 } }} transition={spring}
      tabIndex={0} aria-label={it.title || host(it.url) || it.type}
      onClick={() => onOpen(it.id)} onKeyDown={(e) => e.key === "Enter" && e.target === e.currentTarget && onOpen(it.id)}>
      <div ref={inner}>
        <div className={"tile k-" + kind}>
          <TileBody it={it} kind={kind} onBroken={() => setBroken(true)} shared />
          <div className="tile-tools">
            <button type="button" className={"tbtn" + (it.fav ? " on" : "")} aria-label={it.fav ? "Remove from favorites" : "Add to favorites"}
              onClick={(e) => { e.stopPropagation(); onFav(it); }}>{it.fav ? <Icon.starFill /> : <Icon.star />}</button>
            {url && <a className="tbtn" href={url} target="_blank" rel="noopener noreferrer" aria-label={"Open " + host(url)} onClick={(e) => e.stopPropagation()}><Icon.ext /></a>}
          </div>
          {it.fav && <span className="fav-dot" aria-hidden />}
        </div>
        <div className="caption">{captionOf(it, kind)}</div>
      </div>
    </motion.article>
  );
}

/* ---------- quick capture (first tile) ---------- */
function Quick({ onText, inputRef }) {
  const [v, setV] = useState("");
  const submit = () => { const t = v.trim(); if (!t) return; onText(t); setV(""); };
  return (
    <div className="card quick">
      <div className="tile k-quick">
        <label className="eyebrow accent" htmlFor="quick">New quick save</label>
        <textarea id="quick" ref={inputRef} rows={4} value={v} placeholder="Paste a link, type a note, or paste a screenshot…"
          onChange={(e) => setV(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } }} />
        <AnimatePresence>
          {v.trim() && (
            <motion.div className="quick-foot" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <span>{safeUrl(v.trim()) ? "Saves as a link" : "Saves as a note"} · Enter</span>
              <button type="button" className="pill accent" onClick={submit}>Save</button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function Grid({ list, showQuick, quick, onOpen, onFav }) {
  const ref = useRef(null);
  const n = useColumns(ref);
  const cols = useMemo(() => {
    const c = Array.from({ length: n }, () => []);
    const offset = showQuick ? 1 : 0;
    list.forEach((it, i) => c[(i + offset) % n].push(it));
    return c;
  }, [list, n, showQuick]);
  useEffect(() => { const t = setTimeout(() => ScrollTrigger.refresh(), 450); return () => clearTimeout(t); }, [list, n]);
  return (
    <div className="grid" ref={ref} style={{ gridTemplateColumns: `repeat(${n}, minmax(0,1fr))` }}>
      {cols.map((col, ci) => (
        <div className="col" key={ci}>
          {ci === 0 && showQuick && quick}
          <AnimatePresence mode="popLayout" initial={false}>
            {col.map((it) => <Card key={it.id} it={it} onOpen={onOpen} onFav={onFav} />)}
          </AnimatePresence>
        </div>
      ))}
    </div>
  );
}

/* ---------- modal shell ---------- */
function Modal({ open, onClose, children, label, className = "" }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    lockScroll(true);
    const prev = document.activeElement;
    const t = setTimeout(() => ref.current?.querySelector("[data-autofocus]")?.focus() || ref.current?.focus(), 80);
    const trap = (e) => {
      if (e.key !== "Tab" || !ref.current) return;
      const f = [...ref.current.querySelectorAll("a[href],button:not([disabled]),input,select,textarea,[tabindex='0']")].filter((x) => x.offsetParent);
      if (!f.length) return;
      const [a, z] = [f[0], f[f.length - 1]];
      if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); }
      else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
    };
    document.addEventListener("keydown", trap);
    return () => { clearTimeout(t); document.removeEventListener("keydown", trap); lockScroll(false); prev?.focus?.({ preventScroll: true }); };
  }, [open]);
  return (
    <AnimatePresence>
      {open && (
        <motion.div key="overlay" className="overlay" onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.2 } }}>
          <motion.div ref={ref} tabIndex={-1} className={"modal " + className} role="dialog" aria-modal="true" aria-label={label}
            onClick={(e) => e.stopPropagation()} data-lenis-prevent
            initial={{ opacity: 0, scale: 0.97, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.98, y: 8, transition: { duration: 0.18 } }}
            transition={soft}>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
const Rise = ({ children, className, as = "div", ...rest }) => {
  const C = motion[as];
  return <C className={className} variants={{ hide: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0, transition: spring } }} {...rest}>{children}</C>;
};

/* ---------- detail with inline editing ---------- */
function useAutosave(value, save, delay = 500) {
  const last = useRef(value), latest = useRef(value), saveRef = useRef(save);
  latest.current = value; saveRef.current = save;
  useEffect(() => {
    if (value === last.current) return;
    const t = setTimeout(() => { last.current = value; saveRef.current(value); }, delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  useEffect(() => () => { if (latest.current !== last.current) saveRef.current(latest.current); }, []);
}

function Detail({ it, onClose, patch, remove, setImage, toast, allTags, onPrev, onNext, onTag }) {
  const [title, setTitle] = useState(it.title || "");
  const [note, setNote] = useState(it.note || "");
  const [url, setUrl] = useState(it.url || "");
  const [adding, setAdding] = useState(false);
  const [tagDraft, setTagDraft] = useState("");
  const [armed, setArmed] = useState(false);
  const [broken, setBroken] = useState(false);
  const [over, setOver] = useState(false);
  const file = useRef(null);
  const kind = kindOf(it, broken);
  const link = safeUrl(it.url);

  useAutosave(title, (v) => patch(it.id, { title: v.trim(), autoTitle: false }));
  useAutosave(note, (v) => patch(it.id, { note: v.trim() }));
  useEffect(() => { if (!armed) return; const t = setTimeout(() => setArmed(false), 3000); return () => clearTimeout(t); }, [armed]);

  const tags = it.tags || [];
  const addTag = (raw) => {
    const t = raw.trim().toLowerCase().replace(/^#/, "");
    if (t) patch(it.id, (cur) => ({ tags: (cur.tags || []).includes(t) ? cur.tags : [...(cur.tags || []), t] }));
    setTagDraft("");
  };
  const commitUrl = () => {
    const u = url.trim();
    if (u === (it.url || "")) return;
    if (u && !safeUrl(u)) { toast("Link needs to start with https://"); setUrl(it.url || ""); return; }
    patch(it.id, { url: u });
  };
  const sugg = allTags.filter((t) => !tags.includes(t) && (!tagDraft || t.includes(tagDraft.toLowerCase()))).slice(0, 8);

  return (
    <>
      <div className={"preview" + (over ? " over" : "")}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); setImage(it, e.dataTransfer.files[0]); }}>
        <div className={"pv-inner k-" + kind}>
          <TileBody it={it} kind={kind} shared big onBroken={() => setBroken(true)} />
        </div>
        {link && <a className="pill accent float" href={link} target="_blank" rel="noopener noreferrer"><Icon.ext /> Open {host(link)}</a>}
        <div className="pv-nav">
          <button type="button" className="round" onClick={onPrev} aria-label="Previous"><Icon.left /></button>
          <button type="button" className="round" onClick={onNext} aria-label="Next"><Icon.right /></button>
        </div>
      </div>

      <motion.aside className="side" initial="hide" animate="show" variants={{ show: { transition: { staggerChildren: 0.045, delayChildren: 0.12 } } }}>
        <Rise className="side-head">
          <textarea className="d-title" rows={1} value={title} placeholder="Untitled" aria-label="Title"
            onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), e.target.blur())} />
          <div className="d-meta">
            <span>{ago(it.createdAt)}</span>
            {link && <a href={link} target="_blank" rel="noopener noreferrer"><Icon.ext /> {host(link)}</a>}
          </div>
          <button className="round close" type="button" onClick={onClose} aria-label="Close"><Icon.x /></button>
        </Rise>

        <div className="side-body">
          {it.desc && (
            <Rise className="sect">
              <div className="sect-l accent">Summary</div>
              <p className="summary">{it.desc}</p>
            </Rise>
          )}

          <Rise className="sect">
            <div className="sect-l">Tags</div>
            <div className="tags">
              {adding ? (
                <input className="tag-in" autoFocus value={tagDraft} placeholder="tag name" aria-label="New tag"
                  onChange={(e) => setTagDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addTag(tagDraft); }
                    if (e.key === "Escape") { e.stopPropagation(); setAdding(false); setTagDraft(""); }
                    if (e.key === "Backspace" && !tagDraft && tags.length) patch(it.id, (cur) => ({ tags: (cur.tags || []).slice(0, -1) }));
                  }}
                  onBlur={() => { if (tagDraft) addTag(tagDraft); setAdding(false); }} />
              ) : (
                <button type="button" className="pill accent" onClick={() => setAdding(true)}><Icon.plus /> Add tag</button>
              )}
              <span className="pill ghost type-pill">
                <Icon.globe />
                <select value={it.type} aria-label="Type" onChange={(e) => patch(it.id, { type: e.target.value })}>
                  {TYPES.map((t) => <option key={t}>{t}</option>)}
                </select>
              </span>
              <AnimatePresence initial={false}>
                {tags.map((t) => (
                  <motion.span layout key={t} className="pill ghost tagpill" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} transition={spring}>
                    <button type="button" className="tagjump" onClick={() => onTag(t)}>{t}</button>
                    <button type="button" className="tagx" aria-label={"Remove tag " + t} onClick={() => patch(it.id, (cur) => ({ tags: (cur.tags || []).filter((x) => x !== t) }))}><Icon.x /></button>
                  </motion.span>
                ))}
              </AnimatePresence>
            </div>
            {adding && !!sugg.length && (
              <div className="sugg">
                {sugg.map((t) => <button key={t} type="button" className="pill faint" onMouseDown={(e) => { e.preventDefault(); addTag(t); }}>{t}</button>)}
              </div>
            )}
          </Rise>

          <Rise className="sect">
            <label className="sect-l" htmlFor="d-note">Notes</label>
            <textarea id="d-note" className="box" rows={4} value={note} placeholder="Type here to add a note… What would you steal from this?" onChange={(e) => setNote(e.target.value)} />
          </Rise>

          <Rise className="sect">
            <label className="sect-l" htmlFor="d-url">Link</label>
            <input id="d-url" className="box mono" type="url" inputMode="url" placeholder="https://" value={url}
              onChange={(e) => setUrl(e.target.value)} onBlur={commitUrl} onKeyDown={(e) => e.key === "Enter" && e.target.blur()} />
          </Rise>
        </div>

        <Rise className="side-foot">
          <button type="button" className={"round" + (it.fav ? " on" : "")} onClick={() => patch(it.id, (cur) => ({ fav: !cur.fav }))} aria-label={it.fav ? "Remove from favorites" : "Add to favorites"} title="Favorite">
            {it.fav ? <Icon.starFill /> : <Icon.star />}
          </button>
          {link && <button type="button" className="round" title="Copy link" aria-label="Copy link"
            onClick={() => navigator.clipboard?.writeText(link).then(() => toast("Link copied"), () => toast("Copy failed. Select the link and copy it"))}><Icon.share /></button>}
          <button type="button" className="round" title={it.imageId || it.cover ? "Replace image" : "Add image"} aria-label="Add or replace image" onClick={() => file.current.click()}><Icon.image /></button>
          <input ref={file} type="file" hidden accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml,video/mp4,video/webm" onChange={(e) => { setImage(it, e.target.files[0]); e.target.value = ""; }} />
          <button type="button" className={"round danger" + (armed ? " armed" : "")} title={armed ? "Click again to delete" : "Delete"} aria-label={armed ? "Click again to delete" : "Delete"}
            onClick={() => (armed ? remove(it) : setArmed(true))}><Icon.trash /></button>
          <AnimatePresence>{armed && <motion.span className="armed-hint" initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}>Click again to delete</motion.span>}</AnimatePresence>
        </Rise>
      </motion.aside>
    </>
  );
}

/* ---------- backup ---------- */
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
    <div className="backup">
      <div className="side-head">
        <h2 className="d-title static">Backup</h2>
        <button className="round close" type="button" onClick={onClose} aria-label="Close"><Icon.x /></button>
      </div>
      <p className="muted">Everything lives in this browser only. Export a backup regularly, and import it on another device to move your library. Import merges and never deletes.</p>
      <dl className="meta">
        <dt>References</dt><dd>{count}</dd>
        {u && <><dt>Storage used</dt><dd>{fmtBytes(u.used)} of {fmtBytes(u.quota)}</dd></>}
      </dl>
      <div className="row">
        <button className="pill accent lg" type="button" data-autofocus disabled={busy || !count} onClick={doExport}><Icon.download /> Export backup</button>
        <button className="pill ghost lg" type="button" disabled={busy} onClick={() => file.current.click()}>Import backup</button>
        <input ref={file} type="file" accept="application/json,.json" hidden onChange={(e) => { doImport(e.target.files[0]); e.target.value = ""; }} />
      </div>
    </div>
  );
}

function Count({ n }) {
  const ref = useRef(null), val = useRef({ v: 0 });
  useEffect(() => {
    if (reduced()) { ref.current.textContent = n; return; }
    const tw = gsap.to(val.current, { v: n, duration: 0.9, ease: "power2.out", onUpdate: () => { if (ref.current) ref.current.textContent = Math.round(val.current.v); } });
    return () => tw.kill();
  }, [n]);
  return <sup className="count" ref={ref}>0</sup>;
}

/* ---------- app ---------- */
export default function App() {
  const [items, setItems] = useState([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("all"); // all | fav | random
  const [seed, setSeed] = useState(1);
  const [type, setType] = useState("All");
  const [tags, setTags] = useState(() => new Set());
  const [q, setQ] = useState("");
  const [qLive, setQLive] = useState("");
  const [openId, setOpenId] = useState(null);
  const [backup, setBackup] = useState(false);
  const [msg, setMsg] = useState(null);
  const rootRef = useRef(null);
  const searchRef = useRef(null);
  const quickRef = useRef(null);

  const toast = useCallback((m, action) => setMsg({ m, action, k: Date.now() }), []);
  useEffect(() => { if (!msg) return; const t = setTimeout(() => setMsg(null), msg.action ? 4500 : 2400); return () => clearTimeout(t); }, [msg]);

  const reload = useCallback(async () => { setItems(await store.listItems()); }, []);
  useEffect(() => {
    if (!("indexedDB" in window)) { setError("This browser blocks local storage, so references cannot be saved here."); setReady(true); return; }
    reload().then(() => setReady(true)).catch(() => { setError("Could not open local storage. Private browsing can block it."); setReady(true); });
    store.requestPersist();
    startLenis();
  }, [reload]);

  useLayoutEffect(() => {
    if (reduced()) return;
    const ctx = gsap.context(() => {
      gsap.from(".rail > *", { x: -16, opacity: 0, duration: 0.7, ease: "power3.out", stagger: 0.06 });
      gsap.from(".search-in", { y: 24, opacity: 0, duration: 1.1, ease: "expo.out", delay: 0.1 });
      gsap.from(".search-line", { scaleX: 0, transformOrigin: "left", duration: 1.2, ease: "expo.inOut", delay: 0.15 });
      gsap.from(".tabs > *", { y: -10, opacity: 0, duration: 0.6, ease: "power3.out", stagger: 0.06, delay: 0.25 });
    }, rootRef);
    return () => ctx.revert();
  }, []);

  useEffect(() => { const t = setTimeout(() => setQ(qLive), 120); return () => clearTimeout(t); }, [qLive]);

  const list = useMemo(() => {
    const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const out = items.filter((it) => {
      if (tab === "fav" && !it.fav) return false;
      if (type !== "All" && it.type !== type) return false;
      for (const t of tags) if (!(it.tags || []).includes(t)) return false;
      if (words.length) { const hay = [it.title, it.url, it.note, it.desc, it.type, ...(it.tags || [])].join(" ").toLowerCase(); if (!words.every((w) => hay.includes(w))) return false; }
      return true;
    });
    return tab === "random" ? shuffle(out, seed) : out;
  }, [items, q, type, tags, tab, seed]);

  const counts = useMemo(() => { const c = {}; items.forEach((i) => (c[i.type] = (c[i.type] || 0) + 1)); return c; }, [items]);
  const tagList = useMemo(() => {
    const c = {}; items.forEach((i) => (i.tags || []).forEach((t) => (c[t] = (c[t] || 0) + 1)));
    return Object.keys(c).sort((a, b) => c[b] - c[a] || a.localeCompare(b));
  }, [items]);
  const filtersOn = type !== "All" || tags.size > 0 || !!q;
  const clearFilters = () => { setType("All"); setTags(new Set()); setQ(""); setQLive(""); };
  const toggleTag = (t) => setTags((s) => { const n = new Set(s); n.has(t) ? n.delete(t) : n.add(t); return n; });

  /* --- create / update --- */
  const patch = useCallback(async (id, fields) => { try { await store.patchItem(id, fields); await reload(); } catch { toast("Could not save. Try again"); } }, [reload, toast]);

  const afterCreate = useCallback(async (rec) => {
    await reload();
    if (filtersOn || tab !== "all") { clearFilters(); setTab("all"); }
    toast("Saved", { label: "Add tags", run: () => setOpenId(rec.id) });
  }, [reload, toast, filtersOn, tab]);

  const createFromText = useCallback(async (text) => {
    const now = new Date().toISOString();
    const u = !/\s/.test(text) && safeUrl(text);
    const rec = u
      ? { id: store.uid(), url: u, title: niceName(u), autoTitle: true, type: "Website", tags: [], note: "", fav: false, imageId: null, createdAt: now, updatedAt: now }
      : { id: store.uid(), url: "", title: "", type: "Note", tags: [], note: text, fav: false, imageId: null, createdAt: now, updatedAt: now };
    try { await store.putItem(rec); } catch { return toast("Could not save. Browser storage may be full"); }
    await afterCreate(rec);
    if (u) {
      const m = await fetchMeta(u);
      if (m) {
        const cur = await store.getItem(rec.id);
        if (cur) await patch(rec.id, { cover: m.cover || cur.cover || "", desc: cur.desc || m.desc, title: cur.autoTitle && m.title ? m.title : cur.title });
      }
    }
  }, [afterCreate, patch, toast]);

  const createFromFile = useCallback(async (f) => {
    if (!f) return;
    if (!/^(image|video)\//.test(f.type)) return toast("That file is not an image or video");
    if (f.size > MAX) return toast("File is over 20 MB. Compress it and try again");
    const now = new Date().toISOString(), imageId = store.uid();
    const anim = f.type === "image/gif" || f.type.startsWith("video/");
    const rec = { id: store.uid(), url: "", title: (f.name || "").replace(/\.[a-z0-9]+$/i, "").replace(/^image$/i, ""), type: anim ? "Animation" : "Image", tags: [], note: "", fav: false, imageId, createdAt: now, updatedAt: now };
    try { await store.putFile(imageId, f); await store.putItem(rec); }
    catch (e) { return toast(e?.name === "QuotaExceededError" ? "Browser storage is full. Export a backup and delete old items" : "Could not save. Try again"); }
    afterCreate(rec);
  }, [afterCreate, toast]);

  const setImage = useCallback(async (it, f) => {
    if (!f) return;
    if (!/^(image|video)\//.test(f.type)) return toast("That file is not an image or video");
    if (f.size > MAX) return toast("File is over 20 MB. Compress it and try again");
    const imageId = store.uid();
    try {
      await store.putFile(imageId, f);
      await patch(it.id, { imageId });
      if (it.imageId) { store.forgetUrl(it.imageId); store.deleteFile(it.imageId).catch(() => {}); }
      toast("Image updated");
    } catch { toast("Could not save the image"); }
  }, [patch, toast]);

  const remove = useCallback(async (it) => {
    try {
      await store.deleteItem(it.id);
      if (it.imageId) { store.forgetUrl(it.imageId); store.deleteFile(it.imageId).catch(() => {}); }
      setOpenId(null); await reload(); toast("Deleted");
    } catch { toast("Could not delete. Try again"); }
  }, [reload, toast]);

  const toggleFav = useCallback((it) => patch(it.id, (cur) => ({ fav: !cur.fav })), [patch]);

  const current = openId ? items.find((i) => i.id === openId) : null;
  useEffect(() => { if (openId && ready && !current) setOpenId(null); }, [openId, current, ready]);
  const step = useCallback((d) => {
    if (!list.length) return;
    const i = list.findIndex((x) => x.id === openId);
    setOpenId(list[(i + d + list.length) % list.length].id);
  }, [list, openId]);

  /* --- keyboard, paste, drop --- */
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") { if (openId) return setOpenId(null); if (backup) return setBackup(false); }
      if (openId && !isTyping() && e.key === "ArrowRight") return step(1);
      if (openId && !isTyping() && e.key === "ArrowLeft") return step(-1);
      if (openId || backup || isTyping() || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "/") { e.preventDefault(); searchRef.current?.focus(); }
      if (e.key === "n" || e.key === "N") { e.preventDefault(); clearFilters(); setTab("all"); scrollTop(); setTimeout(() => quickRef.current?.focus(), 80); }
    };
    const onPaste = (e) => {
      const img = [...(e.clipboardData?.items || [])].find((i) => i.kind === "file" && /^(image|video)\//.test(i.type));
      if (img && current) { e.preventDefault(); return setImage(current, img.getAsFile()); }
      if (img && !backup) { e.preventDefault(); return createFromFile(img.getAsFile()); }
      if (openId || backup || isTyping()) return;
      const txt = e.clipboardData?.getData("text")?.trim();
      if (txt && safeUrl(txt) && !/\s/.test(txt)) { e.preventDefault(); createFromText(txt); }
    };
    const onDragOver = (e) => { if ([...(e.dataTransfer?.types || [])].includes("Files")) e.preventDefault(); };
    const onDrop = (e) => {
      if (openId || backup || !e.dataTransfer?.files?.length) return;
      e.preventDefault(); [...e.dataTransfer.files].forEach(createFromFile);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("paste", onPaste);
    window.addEventListener("dragover", onDragOver);
    window.addEventListener("drop", onDrop);
    return () => {
      document.removeEventListener("keydown", onKey); document.removeEventListener("paste", onPaste);
      window.removeEventListener("dragover", onDragOver); window.removeEventListener("drop", onDrop);
    };
  }, [openId, backup, current, step, setImage, createFromFile, createFromText]);

  const showQuick = tab === "all" && !filtersOn;
  const quick = <Quick key="quick" onText={createFromText} inputRef={quickRef} />;

  return (
    <div className="app" ref={rootRef}>
      <nav className="rail" aria-label="Main">
        <div className="logo" aria-hidden><Icon.logo /></div>
        <div className="brand">swipe file</div>
        <div className="rail-tools">
          <button type="button" className="rbtn" title="New quick save (N)" aria-label="New quick save" onClick={() => { clearFilters(); setTab("all"); scrollTop(); setTimeout(() => quickRef.current?.focus(), 80); }}><Icon.plus /></button>
          <button type="button" className="rbtn" title="Random" aria-label="Random order" onClick={() => { setTab("random"); setSeed((s) => s + 1); }}><Icon.shuffle /></button>
          <button type="button" className="rbtn" title="Backup" aria-label="Backup" onClick={() => setBackup(true)}><Icon.download /></button>
        </div>
      </nav>

      <div className="page">
        <header className="top">
          <div className="mobile-brand"><Icon.logo /> swipe file</div>
          <nav className="tabs" aria-label="Views">
            {[["all", "Everything"], ["fav", "Favorites"], ["random", "Random"]].map(([k, l]) => (
              <button key={k} type="button" className={"tab" + (tab === k ? " on" : "")} aria-pressed={tab === k}
                onClick={() => { setTab(k); if (k === "random") setSeed((s) => s + 1); }}>
                {tab === k && <motion.i layoutId="tabline" className="tabline" transition={spring} />}
                {l}{k === "all" && <Count n={items.length} />}
              </button>
            ))}
            <button type="button" className="rbtn mobile-only" aria-label="Backup" onClick={() => setBackup(true)}><Icon.download /></button>
          </nav>
        </header>

        <div className="search">
          <input ref={searchRef} className="search-in" type="search" value={qLive} onChange={(e) => setQLive(e.target.value)}
            placeholder="Search your swipe file…" aria-label="Search" />
          <div className="search-line" />
        </div>

        {!!items.length && (
          <div className="filters">
            <div className="frow" role="toolbar" aria-label="Filter by type">
              {["All", ...TYPES.filter((t) => counts[t])].map((t) => (
                <button key={t} type="button" className={"fchip" + (type === t ? " on" : "")} aria-pressed={type === t} onClick={() => setType(t)}>
                  {t}{t !== "All" && <span>{counts[t]}</span>}
                </button>
              ))}
            </div>
            {!!tagList.length && (
              <div className="frow tagsrow">
                {tagList.slice(0, 18).map((t) => (
                  <button key={t} type="button" className={"fchip tag" + (tags.has(t) ? " on" : "")} aria-pressed={tags.has(t)} onClick={() => toggleTag(t)}>#{t}</button>
                ))}
                {filtersOn && <button type="button" className="fchip clear" onClick={clearFilters}>Clear</button>}
              </div>
            )}
          </div>
        )}

        <main className="view">
          {error && <div className="notice">{error}</div>}
          {!ready ? null : list.length || showQuick ? (
            <>
              <Grid list={list} showQuick={showQuick} quick={quick} onOpen={setOpenId} onFav={toggleFav} />
              {!items.length && (
                <motion.p className="hint-first" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}>
                  Paste a link anywhere on this page, paste or drop a screenshot, or type a note in the card above. Press <kbd>N</kbd> to jump there, <kbd>/</kbd> to search.
                </motion.p>
              )}
            </>
          ) : (
            <motion.div className="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <h2>{tab === "fav" && !filtersOn ? "No favorites yet" : "Nothing matches"}</h2>
              <p>{tab === "fav" && !filtersOn ? "Open a reference and tap the star to keep it here." : "Clear the search or a filter to see more."}</p>
              <button className="pill ghost lg" type="button" onClick={() => { clearFilters(); setTab("all"); }}>Show everything</button>
            </motion.div>
          )}
        </main>
      </div>

      <Modal open={!!current} onClose={() => setOpenId(null)} label="Reference" className="detail">
        {current && (
          <Detail key={current.id} it={current} onClose={() => setOpenId(null)} patch={patch} remove={remove} setImage={setImage}
            toast={toast} allTags={tagList} onPrev={() => step(-1)} onNext={() => step(1)}
            onTag={(t) => { setTags(new Set([t])); setType("All"); setTab("all"); setOpenId(null); }} />
        )}
      </Modal>
      <Modal open={backup} onClose={() => setBackup(false)} label="Backup" className="small">
        <Backup onClose={() => setBackup(false)} count={items.length} reload={reload} toast={toast} />
      </Modal>

      <AnimatePresence>
        {msg && (
          <motion.div key={msg.k} className="toast" role="status" initial={{ opacity: 0, y: 16, x: "-50%" }} animate={{ opacity: 1, y: 0, x: "-50%" }} exit={{ opacity: 0, y: 8, x: "-50%" }} transition={spring}>
            {msg.m}
            {msg.action && <button type="button" onClick={() => { msg.action.run(); setMsg(null); }}>{msg.action.label}</button>}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
