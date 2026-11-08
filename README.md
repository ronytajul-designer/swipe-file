# Swipe File

Personal inspiration library. Save websites, animations, graphics and images in seconds, then find them again while you work.

Live: https://ronytajul-designer.github.io/swipe-file/

**Stack:** React + Vite, [Motion](https://motion.dev) (Framer Motion), [Lenis](https://lenis.darkroom.engineering), [GSAP](https://gsap.com) with ScrollTrigger and SplitText.

## Save

| What | How |
| --- | --- |
| A link | Paste a URL anywhere on the page. Title, summary and cover fill in automatically |
| A screenshot or GIF | Paste it (Ctrl/Cmd + V) or drop files anywhere on the page |
| A note | `Save something` (or press `N`), type, Enter |

Each save gets a date and a category automatically. The category is a best guess from the file type, image shape (phone screenshot, full page capture, desktop viewport), file name, site and page title. Pick one yourself in the composer dropdown, or change it later from "Found in" in the detail view.

Categories: Website, Landing page, Dashboard, Mobile app, UI component, Animation, Illustration, Graphic, Branding, Typography, Color, Image, Copy, Quote, Note, Other.

## View

- **Links** open as a live site inside the viewer, with Desktop (1440) and Mobile (390) widths. Some sites block being shown inside another page; then use Open site or add a screenshot.
- **Long screenshots** show only the top (hero) on the card and scroll in full in the viewer.
- **Videos and GIFs** play on the card while visible and with controls in the viewer.
- Title, notes, tags and link live behind **More info**, so the viewer stays clean.

## Find

| What | How |
| --- | --- |
| Search | `⌘K` or `/`. Matches title, site, tag, note, summary. Focus the search to filter by tag |
| Jump to a type | Left rail. Hover to expand names |
| Views | Everything, Latest, Favorites (top of the rail) |
| Random pick | `Surprise me` or press `S` |
| Browse | `←` `→` in the detail view, `Esc` to close |
| Card size | `− 100% +` bottom right |

## Your data

Everything is stored in your browser (IndexedDB). No account and no server.

- Use **Backup and settings** (bottom of the rail) and export regularly. Clearing browser data deletes the library.
- Import merges by ID and never deletes, so it is safe for moving between devices.
- Link previews use the free [Microlink](https://microlink.io) API, which only receives the URL. It is rate limited; when it fails the card shows a text card with the favicon.

## Develop

```bash
npm install
npm run dev
```

Pushing to `main` deploys to GitHub Pages via `.github/workflows/deploy.yml`.
