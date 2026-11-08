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

Everything is sorted into its type section automatically. Change the type, title, note, tags or link inside the detail view. It saves as you type.

## Find

| What | How |
| --- | --- |
| Search | `⌘K` or `/`. Matches title, site, tag, note, summary. Focus the search to filter by tag |
| Jump to a type | Colored dots on the left rail |
| Views | By type, Latest, Favorites |
| Random pick | `Surprise me` or press `S` |
| Browse | `←` `→` in the detail view, `Esc` to close |
| Card size | `− 100% +` bottom right |

## Your data

Everything is stored in your browser (IndexedDB). No account and no server.

- Use **Backup** (top right) and export regularly. Clearing browser data deletes the library.
- Import merges by ID and never deletes, so it is safe for moving between devices.
- Link previews use the free [Microlink](https://microlink.io) API, which only receives the URL. It is rate limited; when it fails the card shows a text card with the favicon.

## Develop

```bash
npm install
npm run dev
```

Pushing to `main` deploys to GitHub Pages via `.github/workflows/deploy.yml`.
