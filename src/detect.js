// Best-guess category from what we know at save time: file type, image shape, file name, URL and page metadata.
// Always overridable by the user; items keep `autoType: true` until they change it.

const HOSTS = [
  [/(^|\.)(fonts\.google\.com|fontshare\.com|typewolf\.com|myfonts\.com|fontsinuse\.com|futurefonts\.xyz|pangrampangram\.com|klim\.co\.nz|typotheque\.com)$/, "Typography"],
  [/(^|\.)(coolors\.co|colorhunt\.co|realtimecolors\.com|khroma\.co|colors\.lol|happyhues\.co)$/, "Color"],
  [/(^|\.)(lottiefiles\.com|rive\.app|codepen\.io|motion\.dev|gsap\.com|animista\.net|youtube\.com|youtu\.be|vimeo\.com|jitter\.video)$/, "Animation"],
  [/(^|\.)(apps\.apple\.com|play\.google\.com|mobbin\.com|screenlane\.com|pageflows\.com)$/, "Mobile app"],
  [/(^|\.)(land-book\.com|lapa\.ninja|onepagelove\.com|landingfolio\.com|saaslandingpage\.com|godly\.website|awwwards\.com|siteinspire\.com|httpster\.net)$/, "Landing page"],
  [/(^|\.)(uiverse\.io|21st\.dev|component\.gallery|ui\.shadcn\.com|shadcn\.com|tailwindui\.com|flowbite\.com|nicelydone\.club)$/, "UI component"],
  [/(^|\.)(dribbble\.com|behance\.net)$/, "Graphic"],
  [/(^|\.)(underconsideration\.com|brandnew\.com|logobook\.com|logolounge\.com|brandingstyleguides\.com)$/, "Branding"],
  [/(^|\.)(unsplash\.com|pexels\.com|pinterest\.com|cosmos\.so|are\.na|savee\.it)$/, "Image"],
  [/(^|\.)(storyset\.com|undraw\.co|blush\.design|humaaans\.com|opendoodles\.com)$/, "Illustration"],
];

// Ordered: first match wins. Checked against title, description, file name and URL path.
const WORDS = [
  [/\b(dashboard|analytics|admin panel|crm|back ?office)\b/i, "Dashboard"],
  [/\b(ios|android|mobile app|app screen|iphone)\b/i, "Mobile app"],
  [/\b(typeface|font|typography|lettering|type ?specimen|serif|sans)\b/i, "Typography"],
  [/\b(palette|colou?r scheme|gradient|swatch)\b/i, "Color"],
  [/\b(animation|motion|lottie|interaction|micro.?interaction|transition|scroll effect)\b/i, "Animation"],
  [/\b(illustration|drawing|sketch|mascot)\b/i, "Illustration"],
  [/\b(logo|brand ?identity|branding|visual identity|style ?guide)\b/i, "Branding"],
  [/\b(button|navbar|navigation|modal|dropdown|card|form|input|toggle|tabs|tooltip|component|pricing table|footer)\b/i, "UI component"],
  [/\b(landing|hero|homepage|home page|pricing|signup|sign up|waitlist)\b/i, "Landing page"],
  [/\b(poster|banner|flyer|cover|graphic|social post|ad creative)\b/i, "Graphic"],
  [/\b(photo|photograph|moodboard|mood board)\b/i, "Image"],
];

const hostOf = (u) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return ""; } };
const pathOf = (u) => { try { return decodeURIComponent(new URL(u).pathname).replace(/[-_/]+/g, " "); } catch { return ""; } };

export function fromText({ url = "", title = "", desc = "" }) {
  const h = hostOf(url);
  for (const [re, t] of HOSTS) if (re.test(h)) return t;
  const hay = [title, desc, pathOf(url)].join(" ");
  for (const [re, t] of WORDS) if (re.test(hay)) return t;
  return url ? "Website" : "Note";
}

export function fromText2(text) {
  // Short pasted text in quotes, or one or two sentences with an attribution, reads as a quote
  const t = text.trim();
  if (/^["“].+["”](\s*[-–]\s*.+)?$/s.test(t)) return "Quote";
  return "Note";
}

async function dims(file) {
  if (file.type.startsWith("video/") || file.type === "image/svg+xml") return null;
  try { const b = await createImageBitmap(file); const d = { w: b.width, h: b.height }; b.close?.(); return d; } catch { return null; }
}

export async function fromFile(file) {
  if (file.type.startsWith("video/") || file.type === "image/gif") return "Animation";
  const name = (file.name || "").replace(/\.[a-z0-9]+$/i, "");
  if (file.type === "image/svg+xml") return /\b(icon|logo)\b/i.test(name) ? "Branding" : "Graphic";
  for (const [re, t] of WORDS) if (re.test(name.replace(/[-_]+/g, " "))) return t;
  const d = await dims(file);
  if (d) {
    const r = d.h / d.w;
    if (d.w <= 1320 && r >= 1.9 && r <= 2.4) return "Mobile app";   // phone screenshot
    if (r > 1.4) return "Landing page";                            // full-page capture
    if (d.w >= 1200 && r >= 0.5 && r <= 0.75) return "Website";   // desktop viewport capture
  }
  return "Image";
}
