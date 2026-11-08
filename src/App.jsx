import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import * as store from "./store.js";
import { fetchMeta } from "./meta.js";
import { gsap, ScrollTrigger, SplitText, lockScroll, reduced, scrollToEl, scrollTop, startLenis } from "./motion.js";
import { Icon } from "./icons.jsx";

/* Each type is a "place" on the canvas: its own section, color dot and plural label. */
export const TYPES = ["Website", "Landing page", "UI component", "Animation", "Graphic", "Image", "Typography", "Color", "Copy", "Quote", "Note", "Other"];
const META = {
  "Website": ["Websites", "#4f7cf0"], "Landing page": ["Landing pages", "#f08a4b"], "UI component": ["UI components", "#9273ea"],
  "Animation": ["Animations", "#ec5f8c"], "Graphic": ["Graphics", "#36b37e"], "Image": ["Images", "#22a6b3"],
  "Typography": ["Typography", "#c9a227"], "Color": ["Color", "#e5484d"], "Copy": ["Copy", "#9a7b62"],
  "Quote": ["Quotes", "#6f7fd6"], "Note": ["Notes", "#8a9aa6"], "Other": ["Other", "#b3aea4"],
};
const label = (t) => META[t]?.[0] || t;
const color = (t) => META[t]?.[1] || "#b3aea4";
const slug = (t) => "sec-" + t.toLowerCase().replace(/\s+/g, "-");

const MAX = 20 * 1024 * 1024;
const spring = { type: "spring", stiffness: 420, damping: 38, mass: 0.8 };
const soft = { type: "spring", stiffness: 260, damping: 32 };
const DENSITY = [160, 200, 240, 290, 340];

/* ---------- helpers ---------- */
const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return ""; } };
const safeUrl = (u) => { try { const x = new URL(u); return /^https?:$/.test(x.protocol) ? x.href : ""; } catch { return ""; } };
const niceName = (u) => { const h = host(u); if (!h) return ""; const b = h.split(".").slice(-2, -1)[0] || h; return b[0].toUpperCase() + b.slice(1); };
const isTyping = () => /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName) || document.activeElement?.isContentEditable;
const fmtBytes = (n) => (n > 1e9 ? (n / 1e9).toFixed(1) + " GB" : n > 1e6 ? (n / 1e6).toFixed(1) + " MB" : Math.round(n / 1e3) + " KB");
const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
function ago(t) {
  if (!t) return "";
  let v = (new Date(t) - Date.now()) / 1000;
  for (const [n, u] of [[60, "second"], [60, "minute"], [24, "hour"], [7, "day"], [4.345, "week"], [12, "month"], [Infinity, "year"]]) {
    if (Math.abs(v) < n) return rtf.format(Math.round(v), u); v /= n;
  }
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
function useColumns(ref, min, gap = 20, max = 7) {
  const [n, setN] = useState(4);
  useLayoutEffect(() => {
    const el = ref.current; if (!el) return;
    const calc = (w) => setN(Math.max(1, Math.min(max, Math.floor((w + gap) / (min + gap)))));
    calc(el.clientWidth);
    const ro = new ResizeObserver(([e]) => calc(e.contentRect.width));
    ro.observe(el); return () => ro.disconnect();
  }, [ref, min, gap, max]);
  return n;
}

/* ---------- visuals ---------- */
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
function Favicon({ it, size = 20 }) {
  const h = host(it.url);
  if (!h) return null;
  return <img className="favicon" width={size} height={size} alt="" src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(h)}&sz=64`} referrerPolicy="no-referrer" />;
}

/* ---------- card ---------- */
function Card({ it, onOpen, onFav }) {
  const inner = useRef(null);
  const [broken, setBroken] = useState(false);
  const kind = kindOf(it, broken);
  const url = safeUrl(it.url);
  useEffect(() => {
    if (reduced()) return;
    const tw = gsap.fromTo(inner.current, { y: 36, opacity: 0, rotate: (Math.random() - 0.5) * 3 }, {
      y: 0, opacity: 1, rotate: 0, duration: 0.9, ease: "power3.out", clearProps: "transform",
      scrollTrigger: { trigger: inner.current, start: "top 96%", once: true },
    });
    return () => { tw.scrollTrigger?.kill(); tw.kill(); };
  }, []);
  const sub = host(it.url) || ago(it.createdAt);
  return (
    <motion.article layout="position" className={"card k-" + kind}
      initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.92, transition: { duration: 0.18 } }} transition={spring}
      tabIndex={0} aria-label={it.title || host(it.url) || it.type}
      onClick={() => onOpen(it.id)} onKeyDown={(e) => e.key === "Enter" && e.target === e.currentTarget && onOpen(it.id)}>
      <div ref={inner} className="card-in">
        {kind === "media" && (
          <div className="frame">
            <div className="frame-media"><Visual it={it} shared onBroken={() => setBroken(true)} /></div>
            {(it.title || sub) && <div className="frame-cap"><b>{it.title || niceName(it.url)}</b><span>{sub}</span></div>}
          </div>
        )}
        {kind === "link" && (
          <div className="sheet">
            <Favicon it={it} />
            <h3>{it.title || niceName(it.url) || "Untitled"}</h3>
            {it.desc && <p>{it.desc}</p>}
            <span className="sub">{sub}</span>
          </div>
        )}
        {kind === "quote" && (
          <div className="quote"><p>“{it.note || it.title}”</p>{it.note && it.title && <span className="sub">{it.title}</span>}</div>
        )}
        {kind === "note" && (
          <div className="sheet note">{it.title && it.note && <h3>{it.title}</h3>}<p>{it.note || it.title}</p><span className="sub">{ago(it.createdAt)}</span></div>
        )}
        <div className="card-tools">
          <button type="button" className={"tbtn" + (it.fav ? " on" : "")} aria-label={it.fav ? "Remove from favorites" : "Add to favorites"}
            onClick={(e) => { e.stopPropagation(); onFav(it); }}>{it.fav ? <Icon.bookmarkFill /> : <Icon.bookmark />}</button>
          {url && <a className="tbtn" href={url} target="_blank" rel="noopener noreferrer" aria-label={"Open " + host(url)} onClick={(e) => e.stopPropagation()}><Icon.ext /></a>}
        </div>
        {it.fav && <span className="fav-mark" aria-hidden><Icon.bookmarkFill /></span>}
      </div>
    </motion.article>
  );
}

function Masonry({ list, min, onOpen, onFav }) {
  const ref = useRef(null);
  const n = useColumns(ref, min);
  const cols = useMemo(() => {
    const c = Array.from({ length: n }, () => []);
    list.forEach((it, i) => c[i % n].push(it));
    return c;
  }, [list, n]);
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

/* Big italic serif section title, split into characters by GSAP on first view */
function SectionTitle({ text, count, dot }) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    if (reduced() || !ref.current) return;
    const split = new SplitText(ref.current, { type: "chars" });
    const tw = gsap.from(split.chars, {
      yPercent: 70, opacity: 0, rotate: 6, duration: 0.9, ease: "expo.out", stagger: 0.025,
      scrollTrigger: { trigger: ref.current, start: "top 92%", once: true },
    });
    return () => { tw.scrollTrigger?.kill(); tw.kill(); split.revert(); };
  }, [text]);
  return (
    <div className="sec-head">
      <h2 ref={ref}>{text}</h2>
      <span className="sec-count"><i style={{ background: dot }} />{count} {count === 1 ? "thing" : "things"}</span>
    </div>
  );
}

/* ---------- modal shell ---------- */
function Modal({ open, onClose, children, label: aria, className = "" }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    lockScroll(true);
    const prev = document.activeElement;
    const t = setTimeout(() => (ref.current?.querySelector("[data-autofocus]") || ref.current)?.focus(), 80);
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
        <motion.div key="overlay" className="overlay" onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.22 } }}>
          <motion.div ref={ref} tabIndex={-1} className={"modal " + className} role="dialog" aria-modal="true" aria-label={aria}
            onClick={(e) => e.stopPropagation()}
            initial={{ opacity: 0, y: 40, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 24, scale: 0.98, transition: { duration: 0.18 } }}
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
  return <C className={className} variants={{ hide: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: spring } }} {...rest}>{children}</C>;
};

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

/* ---------- detail: reading-card layout, everything editable in place ---------- */
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
  const tags = it.tags || [];

  useAutosave(title, (v) => patch(it.id, { title: v.trim(), autoTitle: false }));
  useAutosave(note, (v) => patch(it.id, { note: v.trim() }));
  useEffect(() => { if (!armed) return; const t = setTimeout(() => setArmed(false), 3000); return () => clearTimeout(t); }, [armed]);

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
  const drop = {
    onDragOver: (e) => { e.preventDefault(); setOver(true); },
    onDragLeave: () => setOver(false),
    onDrop: (e) => { e.preventDefault(); setOver(false); setImage(it, e.dataTransfer.files[0]); },
  };

  return (
    <>
      <button type="button" className="round side-nav prev" onClick={onPrev} aria-label="Previous"><Icon.left /></button>
      <button type="button" className="round side-nav next" onClick={onNext} aria-label="Next"><Icon.right /></button>
      <button className="round close" type="button" onClick={onClose} aria-label="Close"><Icon.x /></button>
      <div className="d-scroll" data-lenis-prevent>
        {kind === "media" ? (
          <div className={"hero" + (over ? " over" : "")} {...drop}><Visual it={it} shared eager onBroken={() => setBroken(true)} /></div>
        ) : (
          <div className={"hero empty-hero" + (over ? " over" : "")} style={{ "--dot": color(it.type) }} {...drop}>
            {kind === "quote" ? <p className="hero-quote">“{it.note || it.title}”</p> : <span className="hero-hint"><Icon.image /> Drop or paste an image to add a cover</span>}
          </div>
        )}

        <motion.div className="d-body" initial="hide" animate="show" variants={{ show: { transition: { staggerChildren: 0.05, delayChildren: 0.1 } } }}>
          <Rise className="d-meta">
            <span className="meta-type"><i style={{ background: color(it.type) }} />
              <select value={it.type} aria-label="Type" onChange={(e) => patch(it.id, { type: e.target.value })}>
                {TYPES.map((t) => <option key={t}>{t}</option>)}
              </select>
            </span>
            {link && <a href={link} target="_blank" rel="noopener noreferrer"><Favicon it={it} size={14} />{host(link)}</a>}
            <span>Saved {ago(it.createdAt)}</span>
          </Rise>

          <Rise>
            <textarea className="d-title" rows={1} value={title} placeholder="Untitled" aria-label="Title"
              onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), e.target.blur())} />
          </Rise>

          {it.desc && <Rise as="p" className="d-lede">{it.desc}</Rise>}

          <Rise className="callout">
            <label htmlFor="d-note" className="callout-l">{kind === "quote" ? "Quote" : kind === "note" ? "Note" : "Why I saved it"}</label>
            <textarea id="d-note" rows={3} value={note} placeholder="What would you steal from this? The layout, the motion, a phrase…" onChange={(e) => setNote(e.target.value)} />
          </Rise>

          <Rise className="d-sect">
            <div className="d-label">Tags</div>
            <div className="tags">
              <AnimatePresence initial={false}>
                {tags.map((t) => (
                  <motion.span layout key={t} className="chip" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} transition={spring}>
                    <button type="button" className="chip-jump" onClick={() => onTag(t)}>#{t}</button>
                    <button type="button" className="chip-x" aria-label={"Remove tag " + t} onClick={() => patch(it.id, (cur) => ({ tags: (cur.tags || []).filter((x) => x !== t) }))}><Icon.x /></button>
                  </motion.span>
                ))}
              </AnimatePresence>
              {adding ? (
                <input className="tag-in" autoFocus value={tagDraft} placeholder="Type a tag, Enter" aria-label="New tag"
                  onChange={(e) => setTagDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addTag(tagDraft); }
                    if (e.key === "Escape") { e.stopPropagation(); setAdding(false); setTagDraft(""); }
                    if (e.key === "Backspace" && !tagDraft && tags.length) patch(it.id, (cur) => ({ tags: (cur.tags || []).slice(0, -1) }));
                  }}
                  onBlur={() => { if (tagDraft) addTag(tagDraft); setAdding(false); }} />
              ) : (
                <button type="button" className="chip add" onClick={() => setAdding(true)}><Icon.plus /> Add tag</button>
              )}
            </div>
            {adding && !!sugg.length && (
              <div className="sugg">{sugg.map((t) => <button key={t} type="button" className="chip faint" onMouseDown={(e) => { e.preventDefault(); addTag(t); }}>#{t}</button>)}</div>
            )}
          </Rise>

          <Rise className="d-sect">
            <label className="d-label" htmlFor="d-url">Link</label>
            <input id="d-url" className="d-url" type="url" inputMode="url" placeholder="https://" value={url}
              onChange={(e) => setUrl(e.target.value)} onBlur={commitUrl} onKeyDown={(e) => e.key === "Enter" && e.target.blur()} />
          </Rise>
        </motion.div>
      </div>

      <div className="d-foot">
        <button type="button" className={"ghost-btn" + (it.fav ? " on" : "")} onClick={() => patch(it.id, (cur) => ({ fav: !cur.fav }))}>
          {it.fav ? <Icon.bookmarkFill /> : <Icon.bookmark />} {it.fav ? "Favorited" : "Favorite"}
        </button>
        {link && <button type="button" className="ghost-btn hide-sm" onClick={() => navigator.clipboard?.writeText(link).then(() => toast("Link copied"), () => toast("Copy failed. Select the link and copy it"))}><Icon.share /> Copy link</button>}
        <button type="button" className="ghost-btn icon-only" title={it.imageId || it.cover ? "Replace image" : "Add image"} aria-label="Add or replace image" onClick={() => file.current.click()}><Icon.image /></button>
        <input ref={file} type="file" hidden accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml,video/mp4,video/webm" onChange={(e) => { setImage(it, e.target.files[0]); e.target.value = ""; }} />
        <button type="button" className={"ghost-btn icon-only danger" + (armed ? " armed" : "")} aria-label={armed ? "Click again to delete" : "Delete"} title="Delete"
          onClick={() => (armed ? remove(it) : setArmed(true))}><Icon.trash />{armed && <span>Click again</span>}</button>
        {link
          ? <a className="black-pill" href={link} target="_blank" rel="noopener noreferrer">Open site <Icon.ext /></a>
          : <button type="button" className="black-pill" onClick={onClose}>Done</button>}
      </div>
    </>
  );
}

/* ---------- composer (bottom dock) ---------- */
function Composer({ onText, onFile, onClose }) {
  const [v, setV] = useState("");
  const file = useRef(null);
  const submit = () => { const t = v.trim(); if (!t) return; onText(t); setV(""); onClose(); };
  const isLink = !!safeUrl(v.trim()) && !/\s/.test(v.trim());
  return (
    <motion.div className="composer" role="dialog" aria-label="Save something"
      initial={{ opacity: 0, y: 16, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.97, transition: { duration: 0.15 } }} transition={spring}>
      <textarea autoFocus rows={3} value={v} placeholder="Paste a link, or write a note…" aria-label="Link or note"
        onChange={(e) => setV(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } if (e.key === "Escape") { e.stopPropagation(); onClose(); } }} />
      <div className="composer-foot">
        <button type="button" className="ghost-btn" onClick={() => file.current.click()}><Icon.image /> Image</button>
        <input ref={file} type="file" hidden multiple accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml,video/mp4,video/webm"
          onChange={(e) => { [...e.target.files].forEach(onFile); e.target.value = ""; onClose(); }} />
        <span className="composer-hint">{v.trim() ? (isLink ? "Saves as a link" : "Saves as a note") : "Tip: paste a link or screenshot anywhere"}</span>
        <button type="button" className="black-pill sm" disabled={!v.trim()} onClick={submit}>Save</button>
      </div>
    </motion.div>
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
      <button className="round close" type="button" onClick={onClose} aria-label="Close"><Icon.x /></button>
      <div className="d-meta"><span className="meta-type"><i style={{ background: "var(--accent)" }} />Your library</span></div>
      <h2 className="d-title static">Backup and move</h2>
      <p className="d-lede">Everything lives in this browser only. Export a backup regularly, and import it on another device to move your library. Import merges and never deletes.</p>
      <dl className="meta">
        <dt>References</dt><dd>{count}</dd>
        {u && <><dt>Storage used</dt><dd>{fmtBytes(u.used)} of {fmtBytes(u.quota)}</dd></>}
      </dl>
      <div className="row">
        <button className="black-pill" type="button" data-autofocus disabled={busy || !count} onClick={doExport}><Icon.download /> Export backup</button>
        <button className="white-pill" type="button" disabled={busy} onClick={() => file.current.click()}>Import backup</button>
        <input ref={file} type="file" accept="application/json,.json" hidden onChange={(e) => { doImport(e.target.files[0]); e.target.value = ""; }} />
      </div>
    </div>
  );
}

/* ---------- small bits ---------- */
function WeekRing({ n, goal = 10 }) {
  const p = Math.min(1, n / goal), r = 8, c = 2 * Math.PI * r;
  return (
    <span className="white-pill static week" title="Saved in the last 7 days">
      <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden>
        <circle cx="10" cy="10" r={r} fill="none" stroke="var(--line)" strokeWidth="2" />
        <motion.circle cx="10" cy="10" r={r} fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" transform="rotate(-90 10 10)"
          strokeDasharray={c} initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: c * (1 - p) }} transition={{ duration: 1.2, ease: [0.2, 0.7, 0.2, 1] }} />
      </svg>
      <b>{n}</b>&nbsp;of {goal} this week
    </span>
  );
}
function Thumb({ it }) {
  const m = useMedia(it.imageId);
  const src = m?.src || it.cover;
  return <span className="rthumb" style={{ "--dot": color(it.type) }}>{src && !m?.type?.startsWith("video/") ? <img src={src} alt="" referrerPolicy="no-referrer" /> : null}</span>;
}

/* ---------- app ---------- */
export default function App() {
  const [items, setItems] = useState([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [view, setView] = useState("places"); // places | latest | fav
  const [tags, setTags] = useState(() => new Set());
  const [q, setQ] = useState("");
  const [qLive, setQLive] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [density, setDensity] = useState(() => { try { const v = Number(localStorage.getItem("sf-density")); return v >= 0 && v < DENSITY.length && localStorage.getItem("sf-density") !== null ? v : 2; } catch { return 2; } });
  const [openId, setOpenId] = useState(null);
  const [backup, setBackup] = useState(false);
  const [composer, setComposer] = useState(false);
  const [active, setActive] = useState(null);
  const [msg, setMsg] = useState(null);
  const rootRef = useRef(null);
  const searchRef = useRef(null);

  const toast = useCallback((m, action) => setMsg({ m, action, k: Date.now() }), []);
  useEffect(() => { if (!msg) return; const t = setTimeout(() => setMsg(null), msg.action ? 4500 : 2400); return () => clearTimeout(t); }, [msg]);
  useEffect(() => { try { localStorage.setItem("sf-density", String(density)); } catch {} }, [density]);

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
      gsap.from(".topbar > *", { y: -18, opacity: 0, duration: 0.8, ease: "power3.out", stagger: 0.07 });
      gsap.from(".dock > *, .corner > *", { y: 24, opacity: 0, duration: 0.8, ease: "power3.out", stagger: 0.06, delay: 0.2 });
      gsap.from(".hello > *", { y: 20, opacity: 0, duration: 1, ease: "expo.out", stagger: 0.08, delay: 0.1 });
    }, rootRef);
    return () => ctx.revert();
  }, []);

  useEffect(() => { const t = setTimeout(() => setQ(qLive), 120); return () => clearTimeout(t); }, [qLive]);

  const filtered = useMemo(() => {
    const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return items.filter((it) => {
      if (view === "fav" && !it.fav) return false;
      for (const t of tags) if (!(it.tags || []).includes(t)) return false;
      if (words.length) { const hay = [it.title, it.url, it.note, it.desc, it.type, label(it.type), ...(it.tags || [])].join(" ").toLowerCase(); if (!words.every((w) => hay.includes(w))) return false; }
      return true;
    });
  }, [items, q, tags, view]);

  const groups = useMemo(() => TYPES.map((t) => [t, filtered.filter((i) => i.type === t)]).filter(([, l]) => l.length), [filtered]);
  const tagList = useMemo(() => {
    const c = {}; items.forEach((i) => (i.tags || []).forEach((t) => (c[t] = (c[t] || 0) + 1)));
    return Object.keys(c).sort((a, b) => c[b] - c[a] || a.localeCompare(b));
  }, [items]);
  const week = useMemo(() => items.filter((i) => Date.now() - new Date(i.createdAt) < 7 * 864e5).length, [items]);
  const filtersOn = tags.size > 0 || !!q;
  const flatList = view === "places" ? groups.flatMap(([, l]) => l) : filtered;
  const clearFilters = useCallback(() => { setTags(new Set()); setQ(""); setQLive(""); }, []);
  const toggleTag = (t) => setTags((s) => { const n = new Set(s); n.has(t) ? n.delete(t) : n.add(t); return n; });

  /* scroll spy for the rail */
  useEffect(() => {
    if (view !== "places") return;
    const els = groups.map(([t]) => document.getElementById(slug(t))).filter(Boolean);
    if (!els.length) return;
    const io = new IntersectionObserver((es) => es.forEach((e) => e.isIntersecting && setActive(e.target.dataset.type)), { rootMargin: "-35% 0px -60% 0px" });
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [groups, view]);

  /* --- data actions --- */
  const patch = useCallback(async (id, fields) => { try { await store.patchItem(id, fields); await reload(); } catch { toast("Could not save. Try again"); } }, [reload, toast]);
  const afterCreate = useCallback(async (rec) => {
    await reload();
    clearFilters();
    setView((v) => (v === "fav" ? "places" : v));
    toast("Saved to " + label(rec.type), { label: "Add tags", run: () => setOpenId(rec.id) });
  }, [reload, toast, clearFilters]);

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
      if (m) await patch(rec.id, (cur) => ({ cover: cur.cover || m.cover || "", desc: cur.desc || m.desc, title: cur.autoTitle && m.title ? m.title : cur.title }));
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
  const surprise = useCallback(() => {
    if (!items.length) return toast("Save a few things first");
    const pool = items.length > 1 ? items.filter((i) => i.id !== openId) : items;
    setOpenId(pool[Math.floor(Math.random() * pool.length)].id);
  }, [items, openId, toast]);

  const current = openId ? items.find((i) => i.id === openId) : null;
  useEffect(() => { if (openId && ready && !current) setOpenId(null); }, [openId, current, ready]);
  const step = useCallback((d) => {
    const l = flatList.length ? flatList : items;
    if (!l.length) return;
    const i = l.findIndex((x) => x.id === openId);
    setOpenId(l[(i + d + l.length) % l.length].id);
  }, [flatList, items, openId]);

  /* --- keyboard, paste, drop --- */
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); searchRef.current?.focus(); return; }
      if (e.key === "Escape") {
        if (openId) return setOpenId(null);
        if (backup) return setBackup(false);
        if (composer) return setComposer(false);
        if (document.activeElement === searchRef.current) return searchRef.current.blur();
      }
      if (openId && !isTyping() && e.key === "ArrowRight") return step(1);
      if (openId && !isTyping() && e.key === "ArrowLeft") return step(-1);
      if (openId || backup || composer || isTyping() || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "/") { e.preventDefault(); searchRef.current?.focus(); }
      if (e.key === "n" || e.key === "N") { e.preventDefault(); setComposer(true); }
      if (e.key === "s" || e.key === "S") { e.preventDefault(); surprise(); }
    };
    const onPaste = (e) => {
      const img = [...(e.clipboardData?.items || [])].find((i) => i.kind === "file" && /^(image|video)\//.test(i.type));
      if (img && current) { e.preventDefault(); return setImage(current, img.getAsFile()); }
      if (img && !backup) { e.preventDefault(); setComposer(false); return createFromFile(img.getAsFile()); }
      if (openId || backup || isTyping()) return;
      const txt = e.clipboardData?.getData("text")?.trim();
      if (txt && safeUrl(txt) && !/\s/.test(txt)) { e.preventDefault(); createFromText(txt); }
    };
    const onDragOver = (e) => { if ([...(e.dataTransfer?.types || [])].includes("Files")) e.preventDefault(); };
    const onDrop = (e) => {
      if (openId || backup || !e.dataTransfer?.files?.length) return;
      e.preventDefault(); setComposer(false); [...e.dataTransfer.files].forEach(createFromFile);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("paste", onPaste);
    window.addEventListener("dragover", onDragOver);
    window.addEventListener("drop", onDrop);
    return () => {
      document.removeEventListener("keydown", onKey); document.removeEventListener("paste", onPaste);
      window.removeEventListener("dragover", onDragOver); window.removeEventListener("drop", onDrop);
    };
  }, [openId, backup, composer, current, step, setImage, createFromFile, createFromText, surprise]);

  const min = DENSITY[density];
  const hour = new Date().getHours();
  const greet = hour < 5 ? "Good night." : hour < 12 ? "Good morning." : hour < 18 ? "Good afternoon." : "Good evening.";
  const recent = items.slice(0, 3);

  return (
    <div className="app" ref={rootRef}>
      <header className="topbar">
        <div className="white-pill brand-pill static"><Icon.logo /><b>Swipe File</b><span className="brand-sub">Personal inspiration library</span></div>
        <div className={"search-pill" + (searchOpen ? " open" : "")}>
          <Icon.search />
          <input ref={searchRef} type="search" value={qLive} placeholder="Search anything you saved…" aria-label="Search"
            onChange={(e) => setQLive(e.target.value)} onFocus={() => setSearchOpen(true)} onBlur={() => setTimeout(() => setSearchOpen(false), 150)} />
          {qLive ? <button type="button" className="kbd-btn" onClick={() => { setQLive(""); setQ(""); }} aria-label="Clear search"><Icon.x /></button> : <kbd>⌘K</kbd>}
          <AnimatePresence>
            {searchOpen && !!tagList.length && (
              <motion.div className="search-pop" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.16 }}>
                <div className="d-label">Filter by tag</div>
                <div className="tags">
                  {tagList.slice(0, 24).map((t) => (
                    <button key={t} type="button" className={"chip" + (tags.has(t) ? " on" : "")} onMouseDown={(e) => { e.preventDefault(); toggleTag(t); }}>#{t}</button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <div className="top-right">
          {!!items.length && <WeekRing n={week} />}
          <button type="button" className="white-pill" onClick={surprise}><Icon.sparkle /> <span className="hide-sm">Surprise me</span></button>
          <button type="button" className="white-pill icon" onClick={() => setBackup(true)} aria-label="Backup" title="Backup"><Icon.download /></button>
        </div>
      </header>

      {view === "places" && groups.length > 1 && (
        <nav className="rail" aria-label="Jump to section">
          {groups.map(([t]) => (
            <button key={t} type="button" className={"rail-dot" + (active === t ? " on" : "")} style={{ "--dot": color(t) }}
              onClick={() => scrollToEl(document.getElementById(slug(t)))} aria-label={label(t)}>
              <span className="rail-tip">{label(t)}</span>
            </button>
          ))}
        </nav>
      )}

      <main className="page">
        <section className="hello">
          <p className="eyebrow">{items.length ? `${items.length} things saved` : "Your library is empty"}</p>
          <h1>{greet}</h1>
          <p className="hello-sub">{items.length ? "What are you designing today? Search it, or let a random pick surprise you." : "Paste a link or a screenshot anywhere on this page. It lands in the right place automatically."}</p>
          <div className="views" role="tablist" aria-label="View">
            {[["places", "By type", <Icon.grid key="g" />], ["latest", "Latest", <Icon.clock key="c" />], ["fav", "Favorites", <Icon.bookmark key="b" />]].map(([k, l, ic]) => (
              <button key={k} type="button" role="tab" aria-selected={view === k} className={"view-tab" + (view === k ? " on" : "")} onClick={() => setView(k)}>
                {view === k && <motion.i layoutId="viewbg" className="view-bg" transition={spring} />}
                <span>{ic}{l}</span>
              </button>
            ))}
          </div>
          {filtersOn && (
            <div className="active-filters">
              <span>{filtered.length} {filtered.length === 1 ? "result" : "results"}{q ? <> for “{q}”</> : null}</span>
              {[...tags].map((t) => <button key={t} type="button" className="chip on" onClick={() => toggleTag(t)}>#{t} <Icon.x /></button>)}
              <button type="button" className="chip clear" onClick={clearFilters}>Clear all</button>
            </div>
          )}
        </section>

        {error && <div className="notice">{error}</div>}

        {!ready ? null : !items.length ? (
          <motion.div className="empty" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={spring}>
            <h2>Nothing here yet</h2>
            <p>Start with one thing that inspired you today.</p>
            <button className="black-pill" type="button" onClick={() => setComposer(true)}><Icon.plus /> Save your first reference</button>
          </motion.div>
        ) : !filtered.length ? (
          <motion.div className="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <h2>{view === "fav" && !filtersOn ? "No favorites yet" : "Nothing matches"}</h2>
            <p>{view === "fav" && !filtersOn ? "Open a reference and tap Favorite to keep it here." : "Try fewer words, or clear the tags."}</p>
            <button className="white-pill" type="button" onClick={() => { clearFilters(); setView("places"); }}>Show everything</button>
          </motion.div>
        ) : view === "places" ? (
          groups.map(([t, l]) => (
            <section key={t} id={slug(t)} data-type={t} className="place">
              <SectionTitle text={label(t)} count={l.length} dot={color(t)} />
              <Masonry list={l} min={min} onOpen={setOpenId} onFav={toggleFav} />
            </section>
          ))
        ) : (
          <section className="place">
            <SectionTitle key={view} text={view === "fav" ? "Favorites" : "Latest"} count={filtered.length} dot={view === "fav" ? "var(--accent)" : "#111"} />
            <Masonry list={filtered} min={min} onOpen={setOpenId} onFav={toggleFav} />
          </section>
        )}
      </main>

      <div className="corner left">
        {!!recent.length && (
          <button type="button" className="white-pill recent" onClick={() => { setView("latest"); clearFilters(); scrollTop(); }}>
            <span className="rstack">{recent.map((it) => <Thumb key={it.id} it={it} />)}</span> <span className="hide-sm">Recently saved</span>
          </button>
        )}
      </div>
      <div className="dock">
        <AnimatePresence>{composer && <Composer onText={createFromText} onFile={createFromFile} onClose={() => setComposer(false)} />}</AnimatePresence>
        <button type="button" className="black-pill lg" onClick={() => setComposer((v) => !v)} aria-expanded={composer}>
          <motion.span animate={{ rotate: composer ? 45 : 0 }} transition={spring} style={{ display: "inline-flex" }}><Icon.plus /></motion.span>
          {composer ? "Close" : "Save something"} <kbd className="inv">N</kbd>
        </button>
      </div>
      <div className="corner right">
        <div className="white-pill static density" role="group" aria-label="Card size">
          <button type="button" onClick={() => setDensity((d) => Math.max(0, d - 1))} disabled={density === 0} aria-label="Smaller cards"><Icon.minus /></button>
          <span>{Math.round((DENSITY[density] / 240) * 100)}%</span>
          <button type="button" onClick={() => setDensity((d) => Math.min(DENSITY.length - 1, d + 1))} disabled={density === DENSITY.length - 1} aria-label="Bigger cards"><Icon.plus /></button>
        </div>
      </div>

      <Modal open={!!current} onClose={() => setOpenId(null)} label="Reference" className="detail">
        {current && (
          <Detail key={current.id} it={current} onClose={() => setOpenId(null)} patch={patch} remove={remove} setImage={setImage}
            toast={toast} allTags={tagList} onPrev={() => step(-1)} onNext={() => step(1)}
            onTag={(t) => { setTags(new Set([t])); setOpenId(null); }} />
        )}
      </Modal>
      <Modal open={backup} onClose={() => setBackup(false)} label="Backup" className="small">
        <Backup onClose={() => setBackup(false)} count={items.length} reload={reload} toast={toast} />
      </Modal>

      <AnimatePresence>
        {msg && (
          <motion.div key={msg.k} className="toast" role="status" initial={{ opacity: 0, y: -12, x: "-50%" }} animate={{ opacity: 1, y: 0, x: "-50%" }} exit={{ opacity: 0, y: -8, x: "-50%" }} transition={spring}>
            {msg.m}
            {msg.action && <button type="button" onClick={() => { msg.action.run(); setMsg(null); }}>{msg.action.label}</button>}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
