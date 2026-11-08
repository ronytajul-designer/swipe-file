import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import * as store from "./store.js";
import { fetchMeta } from "./meta.js";
import * as detect from "./detect.js";
import { gsap, ScrollTrigger, SplitText, lockScroll, reduced, scrollToEl, scrollTop, startLenis } from "./motion.js";
import { Icon } from "./icons.jsx";

/* Each type is a "place": its own section, color dot and plural label. */
export const TYPES = ["Website", "Landing page", "Dashboard", "Mobile app", "UI component", "Animation", "Illustration", "Graphic", "Branding", "Typography", "Color", "Image", "Copy", "Quote", "Note", "Other"];
const META = {
  "Website": ["Websites", "#7c9cf0"], "Landing page": ["Landing pages", "#f0a07a"], "Dashboard": ["Dashboards", "#6fb5e8"],
  "Mobile app": ["Mobile apps", "#8fd0b0"], "UI component": ["UI components", "#b39af0"], "Animation": ["Animations", "#ef8fb0"],
  "Illustration": ["Illustrations", "#e8b26f"], "Graphic": ["Graphics", "#7cc7a4"], "Branding": ["Branding", "#d68fd0"],
  "Typography": ["Typography", "#dcc074"], "Color": ["Color", "#ee8a85"], "Image": ["Images", "#7cc3cc"],
  "Copy": ["Copy", "#c4a68d"], "Quote": ["Quotes", "#9aa5e3"], "Note": ["Notes", "#aab6bf"], "Other": ["Other", "#c4c0b8"],
};
// Setting a source link can sharpen an auto-picked category (e.g. a dribbble.com shot), never a manual one.
const withSource = (u) => (cur) => {
  const guess = detect.fromText({ url: u, title: cur.title });
  return { url: u, ...(cur.autoType && guess !== "Website" ? { type: guess } : {}) };
};
const label = (t) => META[t]?.[0] || t;
const color = (t) => META[t]?.[1] || "#c4c0b8";
const slug = (t) => "sec-" + t.toLowerCase().replace(/\s+/g, "-");

const MAX = 20 * 1024 * 1024;
const spring = { type: "spring", stiffness: 420, damping: 38, mass: 0.8 };
const soft = { type: "spring", stiffness: 300, damping: 34 };
const DENSITY = [220, 280, 340, 420, 520]; // min card width per step; 340 is 100%

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
const fmtDate = (t) => {
  if (!t) return "";
  const d = new Date(t), same = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString(undefined, same ? { day: "numeric", month: "short" } : { day: "numeric", month: "short", year: "numeric" });
};
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
function useSize(ref) {
  const [s, setS] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = ref.current; if (!el) return;
    setS({ w: el.clientWidth, h: el.clientHeight });
    const ro = new ResizeObserver(([e]) => setS({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el); return () => ro.disconnect();
  }, [ref]);
  return s;
}
function useColumns(ref, min, gap = 24, max = 6) {
  const { w } = useSize(ref);
  return w ? Math.max(1, Math.min(max, Math.floor((w + gap) / (min + gap)))) : 4;
}
async function copyImage(it) {
  const blob = await store.getFile(it.imageId);
  if (!blob || !blob.type.startsWith("image/")) throw new Error("no_image");
  let png = blob;
  if (blob.type !== "image/png") {
    const bmp = await createImageBitmap(blob);
    const c = document.createElement("canvas"); c.width = bmp.width; c.height = bmp.height;
    c.getContext("2d").drawImage(bmp, 0, 0);
    png = await new Promise((r) => c.toBlob(r, "image/png"));
  }
  await navigator.clipboard.write([new ClipboardItem({ "image/png": png })]);
}

/* ---------- media in cards: long images crop to the top (hero), video plays in view ---------- */
function Thumb({ it, onBroken }) {
  const m = useMedia(it.imageId);
  const [tall, setTall] = useState(false);
  const vref = useRef(null);
  useEffect(() => {
    const v = vref.current; if (!v) return;
    const io = new IntersectionObserver(([e]) => (e.isIntersecting ? v.play().catch(() => {}) : v.pause()), { threshold: 0.2 });
    io.observe(v); return () => io.disconnect();
  }, [m]);
  if (it.imageId && !m) return <div className="skeleton" />;
  const src = m?.src || it.cover;
  if (!src) return null;
  const isVideo = m?.type?.startsWith("video/");
  return (
    <div className={"thumb" + (tall ? " tall" : "")}>
      {isVideo
        ? <video ref={vref} src={src} muted loop playsInline preload="metadata" onLoadedMetadata={(e) => setTall(e.target.videoHeight / e.target.videoWidth > 1.45)} />
        : <img src={src} alt="" loading="lazy" referrerPolicy="no-referrer" onError={onBroken} onLoad={(e) => setTall(e.target.naturalHeight / e.target.naturalWidth > 1.45)} />}
      {tall && <span className="badge">Full page</span>}
      {isVideo && <span className="badge play">▶ Motion</span>}
    </div>
  );
}
function Favicon({ it, size = 20 }) {
  const h = host(it.url);
  if (!h) return null;
  return <img className="favicon" width={size} height={size} alt="" src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(h)}&sz=64`} referrerPolicy="no-referrer" />;
}

/* ---------- card ---------- */
function Card({ it, onOpen }) {
  const inner = useRef(null);
  const [broken, setBroken] = useState(false);
  const kind = kindOf(it, broken);
  const url = safeUrl(it.url);
  useEffect(() => {
    if (reduced()) return;
    const tw = gsap.fromTo(inner.current, { y: 36, opacity: 0 }, {
      y: 0, opacity: 1, duration: 0.9, ease: "power3.out", clearProps: "transform",
      scrollTrigger: { trigger: inner.current, start: "top 96%", once: true },
    });
    return () => { tw.scrollTrigger?.kill(); tw.kill(); };
  }, []);
  const sub = host(it.url) ? `${host(it.url)} · ${fmtDate(it.createdAt)}` : `Saved ${fmtDate(it.createdAt)}`;
  return (
    <motion.article layout="position" className={"card k-" + kind}
      initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.92, transition: { duration: 0.18 } }} transition={spring}
      tabIndex={0} aria-label={it.title || host(it.url) || it.type}
      onClick={() => onOpen(it.id)} onKeyDown={(e) => e.key === "Enter" && e.target === e.currentTarget && onOpen(it.id)}>
      <div ref={inner} className="card-in">
        {kind === "media" && (
          <div className="frame">
            <Thumb it={it} onBroken={() => setBroken(true)} />
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
          <div className="quote"><p>“{it.note || it.title}”</p><span className="sub">{it.note && it.title ? it.title + " · " : ""}{fmtDate(it.createdAt)}</span></div>
        )}
        {kind === "note" && (
          <div className="sheet note">{it.title && it.note && <h3>{it.title}</h3>}<p>{it.note || it.title}</p><span className="sub">{fmtDate(it.createdAt)}</span></div>
        )}
        {url && (
          <div className="card-tools">
            <a className="tbtn wide" href={url} target="_blank" rel="noopener noreferrer" title={url} onClick={(e) => e.stopPropagation()}>{host(url)} <Icon.ext /></a>
          </div>
        )}
      </div>
    </motion.article>
  );
}

function Masonry({ list, min, onOpen }) {
  const ref = useRef(null);
  const n = useColumns(ref, min);
  const cols = useMemo(() => { const c = Array.from({ length: n }, () => []); list.forEach((it, i) => c[i % n].push(it)); return c; }, [list, n]);
  useEffect(() => { const t = setTimeout(() => ScrollTrigger.refresh(), 450); return () => clearTimeout(t); }, [list, n]);
  return (
    <div className="grid" ref={ref} style={{ gridTemplateColumns: `repeat(${n}, minmax(0,1fr))` }}>
      {cols.map((col, ci) => (
        <div className="col" key={ci}>
          <AnimatePresence mode="popLayout" initial={false}>
            {col.map((it) => <Card key={it.id} it={it} onOpen={onOpen} />)}
          </AnimatePresence>
        </div>
      ))}
    </div>
  );
}

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

function RailRow({ open, k, text, dot, on, onClick, ring, dashed }) {
  return (
    <button type="button" className={"rail-item" + (on ? " on" : "")} onClick={onClick} aria-label={typeof text === "string" ? text : k} aria-current={on || undefined}>
      <span className={"rail-dot" + (ring ? " ring" : "") + (dashed ? " dashed" : "")} style={{ "--dot": dot }} />
      <AnimatePresence>
        {open && (
          <motion.span className="rail-label" initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -4, transition: { duration: 0.1 } }} transition={{ duration: 0.18, delay: 0.04 }}>
            {text}
          </motion.span>
        )}
      </AnimatePresence>
    </button>
  );
}

/* ---------- rail: collapsed dots, expands on hover (Knowspace-style) ---------- */
function Rail({ view, groups, active, onPick, onRandom, onSettings }) {
  const [open, setOpen] = useState(false);
  const t = useRef(null);
  const enter = () => { clearTimeout(t.current); setOpen(true); };
  const leave = () => { clearTimeout(t.current); t.current = setTimeout(() => setOpen(false), 120); };
  return (
    <motion.nav className={"rail" + (open ? " open" : "")} aria-label="Browse"
      onMouseEnter={enter} onMouseLeave={leave} onFocus={enter} onBlur={leave}
      animate={{ width: open ? 212 : 44 }} transition={soft}>
      <RailRow open={open} k="all" text="Everything" dot="linear-gradient(#7c9cf0,#b39af0)" on={view === "places" && !active} onClick={() => onPick("all")} />
      <RailRow open={open} k="latest" text="Latest" dot="#111" on={view === "latest"} onClick={() => onPick("latest")} />
      {!!groups.length && <span className="rail-sep" />}
      {groups.map(([type, l]) => (
        <RailRow open={open} key={type} k={label(type)} text={<>{label(type)}<em>{l.length}</em></>} dot={color(type)} on={view === "places" && active === type} onClick={() => onPick(type)} />
      ))}
      <RailRow open={open} k="random" text="Random" ring onClick={onRandom} />
      <span className="rail-sep" />
      <RailRow open={open} k="settings" text="Backup and settings" dashed onClick={onSettings} />
    </motion.nav>
  );
}

/* ---------- modal shell ---------- */
function Modal({ open, onClose, children, label: aria, className = "" }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    lockScroll(true);
    const prev = document.activeElement;
    const t = setTimeout(() => { if (!ref.current?.contains(document.activeElement)) (ref.current?.querySelector("[data-autofocus]") || ref.current)?.focus(); }, 80);
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
          <motion.div ref={ref} tabIndex={-1} className={"modal " + className} role="dialog" aria-modal="true" aria-label={aria}
            onClick={(e) => e.stopPropagation()}
            initial={{ opacity: 0, y: 28, scale: 0.985 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 16, scale: 0.99, transition: { duration: 0.16 } }}
            transition={soft}>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

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

/* ---------- stage: live site, scrollable full image, playing video ---------- */
function LiveFrame({ url, device }) {
  const box = useRef(null);
  const { w, h } = useSize(box);
  const [loaded, setLoaded] = useState(false);
  const [hint, setHint] = useState(false);
  useEffect(() => { setLoaded(false); setHint(false); const t = setTimeout(() => setHint(true), 3500); return () => clearTimeout(t); }, [url, device]);
  const mobile = device === "mobile";
  const vw = mobile ? 390 : 1440, vh = mobile ? 844 : 0;
  const scale = !w || !h ? 1 : mobile ? Math.min(1, (h - 8) / vh) : Math.min(1, w / vw);
  const frameH = mobile ? vh : Math.ceil(h / scale);
  return (
    <div className={"live" + (mobile ? " mobile" : "")} ref={box}>
      {!!w && (
        <div className="live-shell" style={{ width: vw * scale, height: frameH * scale }}>
          <iframe key={url + device} src={url} title="Live preview" loading="lazy" onLoad={() => setLoaded(true)}
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
            referrerPolicy="no-referrer-when-downgrade"
            style={{ width: vw, height: frameH, transform: `scale(${scale})` }} />
          {!loaded && <div className="live-loading"><span className="spinner" />Loading live site…</div>}
        </div>
      )}
      <AnimatePresence>
        {hint && (
          <motion.div className="live-hint" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            Blank? Some sites block previews inside other pages.
            <a href={url} target="_blank" rel="noopener noreferrer">Open site <Icon.ext /></a>
            <button type="button" aria-label="Dismiss" onClick={() => setHint(false)}><Icon.x /></button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function MediaStage({ it, onDims, onBroken }) {
  const m = useMedia(it.imageId);
  if (it.imageId && !m) return <div className="stage-center"><div className="skeleton big" /></div>;
  const src = m?.src || it.cover;
  if (m?.type?.startsWith("video/")) {
    return (
      <div className="stage-center">
        <video className="stage-video" src={src} autoPlay loop muted playsInline controls
          onLoadedMetadata={(e) => onDims({ w: e.target.videoWidth, h: e.target.videoHeight, video: true })} />
      </div>
    );
  }
  return <StageImage src={src} onDims={onDims} onBroken={onBroken} />;
}
function StageImage({ src, onDims, onBroken }) {
  const [tall, setTall] = useState(false);
  return (
    <div className={tall ? "stage-scroll" : "stage-center fit"} data-lenis-prevent>
      <img className="stage-img" src={src} alt="" referrerPolicy="no-referrer" onError={onBroken}
        onLoad={(e) => { const w = e.target.naturalWidth, h = e.target.naturalHeight; setTall(h / w > 1.2); onDims({ w, h }); }} />
    </div>
  );
}

/* ---------- tags: chips + one inline input, Enter to add ---------- */
function TagRow({ it, patch, allTags }) {
  const [adding, setAdding] = useState(false);
  const [d, setD] = useState("");
  const tags = it.tags || [];
  const add = (raw) => {
    const t = raw.trim().toLowerCase().replace(/^#/, "").replace(/\s+/g, "-");
    if (t) patch(it.id, (cur) => ({ tags: (cur.tags || []).includes(t) ? cur.tags : [...(cur.tags || []), t] }));
    setD("");
  };
  const q = d.trim().toLowerCase().replace(/^#/, "");
  const sugg = allTags.filter((t) => !tags.includes(t) && (!q || t.includes(q))).slice(0, 6);
  return (
    <div className="tagrow">
      <AnimatePresence initial={false}>
        {tags.map((t) => (
          <motion.span layout key={t} className="tagchip" initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.85 }} transition={spring}>
            #{t}
            <button type="button" aria-label={"Remove tag " + t} onClick={() => patch(it.id, (cur) => ({ tags: (cur.tags || []).filter((x) => x !== t) }))}><Icon.x /></button>
          </motion.span>
        ))}
      </AnimatePresence>
      {adding ? (
        <span className="tag-add-wrap">
          <input autoFocus value={d} placeholder="tag, Enter" aria-label="New tag" onChange={(e) => setD(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === ",") { e.preventDefault(); add(d); }
              if (e.key === "Escape") { e.stopPropagation(); setAdding(false); setD(""); }
              if (e.key === "Backspace" && !d && tags.length) patch(it.id, (cur) => ({ tags: (cur.tags || []).slice(0, -1) }));
            }}
            onBlur={() => { if (d.trim()) add(d); setAdding(false); }} />
          {!!sugg.length && (
            <span className="tag-sugg">
              {sugg.map((t) => <button key={t} type="button" onMouseDown={(e) => { e.preventDefault(); add(t); }}>#{t}</button>)}
            </span>
          )}
        </span>
      ) : (
        <button type="button" className="tag-add" onClick={() => setAdding(true)}><Icon.plus /> Tag</button>
      )}
    </div>
  );
}

/* ---------- detail: the saved thing, its source link, delete. Nothing else. ---------- */
function Detail({ it, onClose, patch, remove, setImage, toast, onPrev, onNext, linkFocus, allTags }) {
  const [broken, setBroken] = useState(false);
  const kind = kindOf(it, broken);
  const link = safeUrl(it.url);
  const canLive = link.startsWith("https:");
  const hasMedia = kind === "media";
  const [mode, setMode] = useState("saved");
  const [device, setDevice] = useState(() => (window.innerWidth < 860 ? "mobile" : "desktop"));
  const [title, setTitle] = useState(it.title || "");
  const [editLink, setEditLink] = useState(!link || !!linkFocus);
  const [url, setUrl] = useState(it.url || "");
  const [armed, setArmed] = useState(false);
  const [over, setOver] = useState(false);
  const [, setDims] = useState(null);
  useAutosave(title, (v) => patch(it.id, { title: v.trim(), autoTitle: false }));
  useEffect(() => { if (!armed) return; const t = setTimeout(() => setArmed(false), 3000); return () => clearTimeout(t); }, [armed]);
  useEffect(() => { setUrl(it.url || ""); }, [it.url]);
  // Live is a viewing option for the source link; the saved media is always the default when there is one.
  const showLive = canLive && (!hasMedia || mode === "live");

  const commitUrl = () => {
    const u = url.trim();
    if (u === (it.url || "")) { if (u) setEditLink(false); return; }
    if (u && !safeUrl(u)) { toast("Link needs to start with https://"); return; }
    patch(it.id, u ? withSource(u) : { url: "" });
    if (u) { setEditLink(false); toast("Source link saved"); }
  };

  return (
    <div className="dv" onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={(e) => e.currentTarget === e.target && setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); setImage(it, e.dataTransfer.files[0]); }}>
      <header className="dv-head">
        <div className="dv-id">
          <span className="dv-logo" style={{ "--dot": color(it.type) }}>{link ? <Favicon it={it} size={22} /> : <i />}</span>
          <input className="dv-title" value={title} placeholder={niceName(it.url) || "Untitled"} aria-label="Title"
            onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.key === "Enter" && e.target.blur()} />
        </div>
        {canLive && hasMedia && (
          <div className="seg" role="tablist" aria-label="Preview">
            {[["saved", "Saved"], ["live", "Live site"]].map(([k, l]) => (
              <button key={k} type="button" role="tab" aria-selected={mode === k} className={mode === k ? "on" : ""} onClick={() => setMode(k)}>
                {mode === k && <motion.i layoutId="segbg" className="seg-bg" transition={spring} />}<span>{l}</span>
              </button>
            ))}
          </div>
        )}
        <div className="dv-tools">
          {showLive && (
            <div className="seg sm" role="tablist" aria-label="Device">
              {[["desktop", "Desktop"], ["mobile", "Mobile"]].map(([k, l]) => (
                <button key={k} type="button" role="tab" aria-selected={device === k} className={device === k ? "on" : ""} onClick={() => setDevice(k)}>
                  {device === k && <motion.i layoutId="devbg" className="seg-bg" transition={spring} />}<span>{l}</span>
                </button>
              ))}
            </div>
          )}
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close" data-autofocus><Icon.x /></button>
        </div>
      </header>

      <div className={"dv-stage" + (over ? " over" : "")}>
        {showLive ? <LiveFrame url={link} device={device} />
          : hasMedia ? <MediaStage it={it} onDims={setDims} onBroken={() => setBroken(true)} />
          : kind === "quote" ? <div className="stage-center"><p className="stage-quote">“{it.note || it.title}”</p></div>
          : kind === "note" ? <div className="stage-center"><p className="stage-note">{it.note || it.title}</p></div>
          : <div className="stage-center"><div className="stage-empty"><Favicon it={it} size={40} /><b>{it.title || niceName(it.url)}</b><span>Live preview needs an https link. Drop or paste a screenshot here to keep a copy.</span></div></div>}
        <button type="button" className="arrow prev" onClick={onPrev} aria-label="Previous"><Icon.left /></button>
        <button type="button" className="arrow next" onClick={onNext} aria-label="Next"><Icon.right /></button>
      </div>

      <footer className="dv-foot">
        <div className="foot-left">
          <label className="found-chip" title="Category"><i style={{ background: color(it.type) }} />
            <select value={it.type} aria-label="Category" onChange={(e) => patch(it.id, { type: e.target.value, autoType: false })}>{TYPES.map((t) => <option key={t}>{t}</option>)}</select>
          </label>
          <TagRow it={it} patch={patch} allTags={allTags} />
        </div>

        <div className="source">
          {link && !editLink ? (
            <>
              <a className="source-pill" href={link} target="_blank" rel="noopener noreferrer" title={link}>
                <Favicon it={it} size={16} /><span>{link.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")}</span><Icon.ext />
              </a>
              <button type="button" className="icon-btn sm" aria-label="Edit source link" title="Edit link" onClick={() => setEditLink(true)}><Icon.edit /></button>
            </>
          ) : (
            <div className="source-in">
              <Icon.link />
              <input autoFocus={!!linkFocus || !!it.url} type="url" inputMode="url" value={url} placeholder="Paste the source link (where you found this)" aria-label="Source link"
                onChange={(e) => setUrl(e.target.value)} onBlur={commitUrl}
                onKeyDown={(e) => { if (e.key === "Enter") e.target.blur(); if (e.key === "Escape" && link) { e.stopPropagation(); setUrl(it.url); setEditLink(false); } }} />
            </div>
          )}
        </div>

        <button type="button" className={"del-btn" + (armed ? " armed" : "")} onClick={() => (armed ? remove(it) : setArmed(true))}>
          <Icon.trash /><span>{armed ? "Click again to delete" : "Delete"}</span>
        </button>
      </footer>
    </div>
  );
}

/* ---------- composer (bottom dock) ---------- */
function Composer({ onText, onFile, onClose }) {
  const [v, setV] = useState("");
  const [files, setFiles] = useState([]);
  const [type, setType] = useState("");
  const file = useRef(null);
  const text = v.trim();
  const isLink = !!safeUrl(text) && !/\s/.test(text);
  const canSave = files.length ? !text || isLink : !!text;
  const submit = () => {
    if (!canSave) return;
    if (files.length) files.forEach((f) => onFile(f, type || null, isLink ? text : ""));
    else onText(text, type || null);
    onClose();
  };
  const addFiles = (list) => setFiles((cur) => [...cur, ...[...list].filter((f) => /^(image|video)\//.test(f.type))]);
  return (
    <motion.div className="composer" role="dialog" aria-label="Save something"
      onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); e.stopPropagation(); addFiles(e.dataTransfer.files); }}
      onPaste={(e) => { const fs = [...(e.clipboardData?.files || [])]; if (fs.length) { e.preventDefault(); e.stopPropagation(); addFiles(fs); } }}
      initial={{ opacity: 0, y: 16, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.97, transition: { duration: 0.15 } }} transition={spring}>
      {!!files.length && (
        <div className="files">
          {files.map((f, i) => (
            <span key={i} className="chip"><Icon.image />{(f.name || "Pasted image").slice(0, 28)}
              <button type="button" className="chip-x" aria-label="Remove file" onClick={() => setFiles((c) => c.filter((_, j) => j !== i))}><Icon.x /></button></span>
          ))}
        </div>
      )}
      <textarea autoFocus rows={files.length ? 1 : 3} value={v} aria-label={files.length ? "Source link" : "Link or note"}
        placeholder={files.length ? "Source link, where you found it (optional)" : "Paste a link, write a note, or paste a screenshot…"}
        onChange={(e) => setV(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } if (e.key === "Escape") { e.stopPropagation(); onClose(); } }} />
      <div className="composer-foot">
        <button type="button" className="ghost-btn" onClick={() => file.current.click()}><Icon.image /> Media</button>
        <input ref={file} type="file" hidden multiple accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml,video/mp4,video/webm"
          onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
        <label className="type-select">
          <i style={{ background: type ? color(type) : "linear-gradient(#7c9cf0,#ef8fb0)" }} />
          <select value={type} onChange={(e) => setType(e.target.value)} aria-label="Category">
            <option value="">Auto-detect</option>
            {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
        <span className="composer-hint">{files.length && text && !isLink ? "Link needs https://" : ""}</span>
        <button type="button" className="black-pill sm" disabled={!canSave} onClick={submit}>Save</button>
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
      <button className="icon-btn close-abs" type="button" onClick={onClose} aria-label="Close"><Icon.x /></button>
      <h2>Backup and move</h2>
      <p>Everything lives in this browser only. Export a backup now and then, and import it on another device to move your library. Import merges and never deletes.</p>
      <dl className="meta">
        <dt>References</dt><dd>{count}</dd>
        {u && <><dt>Storage used</dt><dd>{fmtBytes(u.used)} of {fmtBytes(u.quota)}</dd></>}
      </dl>
      <div className="row">
        <button className="black-pill" type="button" data-autofocus disabled={busy || !count} onClick={doExport}><Icon.download /> Export backup</button>
        <button className="soft-pill" type="button" disabled={busy} onClick={() => file.current.click()}>Import backup</button>
        <input ref={file} type="file" accept="application/json,.json" hidden onChange={(e) => { doImport(e.target.files[0]); e.target.value = ""; }} />
      </div>
    </div>
  );
}

/* ---------- app ---------- */
export default function App() {
  const [items, setItems] = useState([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [view, setView] = useState("places"); // places | latest
  const [tags, setTags] = useState(() => new Set());
  const [q, setQ] = useState("");
  const [qLive, setQLive] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [density, setDensity] = useState(() => { try { const s = localStorage.getItem("sf-density"); const v = Number(s); return s !== null && v >= 0 && v < DENSITY.length ? v : 2; } catch { return 2; } });
  const [openId, setOpenId] = useState(null);
  const [linkFocus, setLinkFocus] = useState(null);
  const [backup, setBackup] = useState(false);
  const [composer, setComposer] = useState(false);
  const [active, setActive] = useState(null);
  const [pendingJump, setPendingJump] = useState(null);
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
      // Fade only on fixed chrome: transforms here fight the pills' own CSS hover transitions and can stick off-position.
      gsap.from(".topbar > *, .dock, .corner", { autoAlpha: 0, duration: 0.7, ease: "power2.out", stagger: 0.06, clearProps: "opacity,visibility" });
      gsap.from(".hello > *", { y: 20, opacity: 0, duration: 1, ease: "expo.out", stagger: 0.08, delay: 0.1, clearProps: "transform,opacity" });
    }, rootRef);
    return () => ctx.revert();
  }, []);

  useEffect(() => { const t = setTimeout(() => setQ(qLive), 120); return () => clearTimeout(t); }, [qLive]);

  const filtered = useMemo(() => {
    const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return items.filter((it) => {
      for (const t of tags) if (!(it.tags || []).includes(t)) return false;
      if (words.length) { const hay = [it.title, it.url, it.note, it.desc, it.type, label(it.type), ...(it.tags || [])].join(" ").toLowerCase(); if (!words.every((w) => hay.includes(w))) return false; }
      return true;
    });
  }, [items, q, tags, view]);

  const groups = useMemo(() => TYPES.map((t) => [t, filtered.filter((i) => i.type === t)]).filter(([, l]) => l.length), [filtered]);
  const allGroups = useMemo(() => TYPES.map((t) => [t, items.filter((i) => i.type === t)]).filter(([, l]) => l.length), [items]);
  const tagList = useMemo(() => {
    const c = {}; items.forEach((i) => (i.tags || []).forEach((t) => (c[t] = (c[t] || 0) + 1)));
    return Object.keys(c).sort((a, b) => c[b] - c[a] || a.localeCompare(b));
  }, [items]);
  const filtersOn = tags.size > 0 || !!q;
  const flatList = view === "places" ? groups.flatMap(([, l]) => l) : filtered;
  const clearFilters = useCallback(() => { setTags(new Set()); setQ(""); setQLive(""); }, []);
  const toggleTag = (t) => setTags((s) => { const n = new Set(s); n.has(t) ? n.delete(t) : n.add(t); return n; });

  /* scroll spy */
  useEffect(() => {
    if (view !== "places") return;
    const els = groups.map(([t]) => document.getElementById(slug(t))).filter(Boolean);
    if (!els.length) return;
    const io = new IntersectionObserver((es) => es.forEach((e) => e.isIntersecting && setActive(e.target.dataset.type)), { rootMargin: "-35% 0px -60% 0px" });
    els.forEach((el) => io.observe(el));
    const onTop = () => window.scrollY < 200 && setActive(null);
    window.addEventListener("scroll", onTop, { passive: true });
    return () => { io.disconnect(); window.removeEventListener("scroll", onTop); };
  }, [groups, view]);
  useEffect(() => {
    if (!pendingJump || view !== "places") return;
    const t = setTimeout(() => { scrollToEl(document.getElementById(slug(pendingJump))); setPendingJump(null); }, 60);
    return () => clearTimeout(t);
  }, [pendingJump, view, groups]);

  const pick = (k) => {
    if (k === "latest") { setView(k); scrollTop(); return; }
    if (k === "all") { setView("places"); setActive(null); scrollTop(); return; }
    if (!groups.some(([t]) => t === k)) clearFilters();
    setView("places"); setPendingJump(k);
  };

  /* --- data actions --- */
  const patch = useCallback(async (id, fields) => { try { await store.patchItem(id, fields); await reload(); } catch { toast("Could not save. Try again"); } }, [reload, toast]);
  const afterCreate = useCallback(async (rec) => {
    await reload();
    clearFilters();
    toast("Saved to " + label(rec.type), rec.url
      ? { label: "Open", run: () => setOpenId(rec.id) }
      : rec.imageId ? { label: "Add source link", run: () => { setLinkFocus(rec.id); setOpenId(rec.id); } } : null);
  }, [reload, toast, clearFilters]);

  const createFromText = useCallback(async (text, forced = null) => {
    const now = new Date().toISOString();
    const u = !/\s/.test(text) && safeUrl(text);
    const type = forced || (u ? detect.fromText({ url: u }) : detect.fromText2(text));
    const rec = u
      ? { id: store.uid(), url: u, title: niceName(u), autoTitle: true, type, autoType: !forced, tags: [], note: "", fav: false, imageId: null, createdAt: now, updatedAt: now }
      : { id: store.uid(), url: "", title: "", type, autoType: !forced, tags: [], note: text, fav: false, imageId: null, createdAt: now, updatedAt: now };
    try { await store.putItem(rec); } catch { return toast("Could not save. Browser storage may be full"); }
    await afterCreate(rec);
    if (u) {
      const m = await fetchMeta(u);
      if (m) await patch(rec.id, (cur) => ({
        cover: cur.cover || m.cover || "", desc: cur.desc || m.desc,
        title: cur.autoTitle && m.title ? m.title : cur.title,
        type: cur.autoType ? detect.fromText({ url: u, title: m.title, desc: m.desc }) : cur.type,
      }));
    }
  }, [afterCreate, patch, toast]);

  const createFromFile = useCallback(async (f, forced = null, src = "") => {
    if (!f) return;
    if (!/^(image|video)\//.test(f.type)) return toast("That file is not an image or video");
    if (f.size > MAX) return toast("File is over 20 MB. Compress it and try again");
    const now = new Date().toISOString(), imageId = store.uid();
    const type = forced || (await detect.fromFile(f));
    const url = safeUrl(src);
    const fname = (f.name || "").replace(/\.[a-z0-9]+$/i, "").replace(/^(image|screenshot.*|untitled)$/i, "");
    const rec = { id: store.uid(), url, title: fname || niceName(url), type, autoType: !forced, tags: [], note: "", fav: false, imageId, createdAt: now, updatedAt: now };
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
      if (backup || isTyping()) return;
      const txt = e.clipboardData?.getData("text")?.trim();
      if (!txt || !safeUrl(txt) || /\s/.test(txt)) return;
      e.preventDefault();
      if (current) { patch(current.id, withSource(safeUrl(txt))); toast("Source link saved"); return; }
      createFromText(txt);
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
  }, [openId, backup, composer, current, step, setImage, createFromFile, createFromText, surprise, patch, toast]);

  const min = DENSITY[density];

  return (
    <div className="app" ref={rootRef}>
      <header className="topbar">
        <div className="logo-pill" aria-label="Swipe File"><Icon.logo /></div>
        <div className={"search-pill" + (searchOpen ? " open" : "")}>
          <Icon.search />
          <input ref={searchRef} type="search" value={qLive} placeholder="Search anything you saved…" aria-label="Search"
            onChange={(e) => setQLive(e.target.value)} onFocus={() => setSearchOpen(true)} onBlur={() => setTimeout(() => setSearchOpen(false), 150)} />
          {qLive ? <button type="button" className="kbd-btn" onClick={() => { setQLive(""); setQ(""); }} aria-label="Clear search"><Icon.x /></button> : <kbd>⌘K</kbd>}
          <AnimatePresence>
            {searchOpen && !!tagList.length && (
              <motion.div className="search-pop" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.16 }}>
                <div className="pop-label">Filter by tag</div>
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
          <button type="button" className="white-pill" onClick={surprise}><Icon.sparkle /> <span className="hide-sm">Surprise me</span></button>
        </div>
      </header>

      {!!items.length && (
        <Rail view={view} groups={allGroups} active={active} onPick={pick} onRandom={surprise} onSettings={() => setBackup(true)} />
      )}

      <main className="page">
        <section className="hello">
          {!!items.length && (
            <div className="mchips" role="toolbar" aria-label="Browse">
              {[["all", "Everything"], ["latest", "Latest"]].map(([k, l]) => (
                <button key={k} type="button" className={"chip" + ((k === "all" ? view === "places" : view === k) ? " on" : "")} onClick={() => pick(k)}>{l}</button>
              ))}
              {allGroups.map(([t]) => <button key={t} type="button" className="chip" onClick={() => pick(t)}><i style={{ background: color(t) }} />{label(t)}</button>)}
            </div>
          )}
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
            <p>Paste a link, a screenshot or a video anywhere on this page. It lands in the right place automatically.</p>
            <button className="black-pill" type="button" onClick={() => setComposer(true)}><Icon.plus /> Save your first reference</button>
          </motion.div>
        ) : !filtered.length ? (
          <motion.div className="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <h2>Nothing matches</h2>
            <p>Try fewer words, or clear the tags.</p>
            <button className="white-pill" type="button" onClick={() => { clearFilters(); setView("places"); }}>Show everything</button>
          </motion.div>
        ) : view === "places" ? (
          groups.map(([t, l]) => (
            <section key={t} id={slug(t)} data-type={t} className="place">
              <SectionTitle text={label(t)} count={l.length} dot={color(t)} />
              <Masonry list={l} min={min} onOpen={setOpenId} />
            </section>
          ))
        ) : (
          <section className="place">
            <SectionTitle key={view} text="Latest" count={filtered.length} dot="#111" />
            <Masonry list={filtered} min={min} onOpen={setOpenId} />
          </section>
        )}
      </main>

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
          <span>{Math.round((DENSITY[density] / 340) * 100)}%</span>
          <button type="button" onClick={() => setDensity((d) => Math.min(DENSITY.length - 1, d + 1))} disabled={density === DENSITY.length - 1} aria-label="Bigger cards"><Icon.plus /></button>
        </div>
      </div>

      <Modal open={!!current} onClose={() => { setOpenId(null); setLinkFocus(null); }} label="Reference" className="detail">
        {current && (
          <Detail key={current.id} it={current} onClose={() => { setOpenId(null); setLinkFocus(null); }} patch={patch} remove={remove} setImage={setImage}
            toast={toast} onPrev={() => step(-1)} onNext={() => step(1)} linkFocus={linkFocus === current.id} allTags={tagList} />
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
