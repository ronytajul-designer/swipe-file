// Best-effort link preview (title, description, cover image) via Microlink's free API.
// Free tier is rate limited, so any failure just leaves the card as a text link card.
export async function fetchMeta(url) {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 15000);
    const r = await fetch("https://api.microlink.io/?url=" + encodeURIComponent(url), { signal: ctrl.signal });
    clearTimeout(t);
    if (!r.ok) return null;
    const j = await r.json();
    if (j.status !== "success") return null;
    const d = j.data || {};
    return { title: d.title || "", desc: d.description || "", cover: d.image?.url || "", logo: d.logo?.url || "" };
  } catch {
    return null;
  }
}
