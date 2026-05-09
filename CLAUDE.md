# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project context

**session.share** is a single-page web app for sharing Claude Code `.jsonl` session logs as readable, annotated artifacts. Read `BRIEF.md` for the full product brief, design history, and feedback log — when intent is ambiguous, defer to it.

## Running it

There is no build step, no bundler, no test suite, no linter. The "build" is the source files in the repo root.

To run locally:
```bash
python3 -m http.server 8000   # or any static server, from the repo root
# open http://localhost:8000/
```

`file://` won't work — `app.jsx` uses `fetch()` for `assets/sample.jsonl` and for the export bundler (which fetches the source files back in). It needs HTTP.

The page also pulls React, ReactDOM, and `@babel/standalone` from unpkg, so first load needs internet.

GitHub Pages is the deploy target (`.nojekyll` is in place). The default branch is the only branch — push there and Pages serves it.

## How the pieces fit

Four script files load in order. Order matters because each later file expects globals set by earlier ones:

1. **`parser.jsx`** — plain JS (no JSX). Exposes `window.SessionParser` with pure functions: `parseSessionJSONL`, `summarizeToolCall`, `defaultCollapsed`. Heuristic-driven, no LLM.
2. **`markdown.jsx`** — plain JS. Exposes `window.renderMarkdown(text)` returning escape-safe HTML.
3. **`ui.jsx`** — React + JSX. All visual components. Attaches them to `window` at the bottom (`Object.assign(window, { Icon, MD, NodeRow, ToolRun, ... })`).
4. **`app.jsx`** — React + JSX. Root `<App>` with state, persistence, export.

`parser.jsx` and `markdown.jsx` are written in plain JS but use `.jsx` extensions to match the prototype convention. They're loaded via `<script type="text/babel">` (rather than plain `<script src>`) because GitHub Pages serves `.jsx` with `application/octet-stream` + `nosniff`, which blocks plain script tags. Babel fetches them via XHR and ignores MIME.

## Architectural quirks worth knowing

**Theme attribute lives on `<html>`, not `<body>`.** CSS uses descendant selectors like `[data-theme="fieldnotes"] body { ... }`. Those only match when the attribute is on an *ancestor* of body. `app.jsx` sets `document.documentElement.dataset.theme`. The markup also starts with `data-theme="fieldnotes"` to avoid a flash on load.

**Locked vs. live mode.** When `window.__LOCKED_DATA__` exists (set by exported HTML), the app reads `raw`/`edits`/`meta`/`theme` from it and forces `mode="view"`. Otherwise it loads from `localStorage` under key `session-share-v1`.

**Tool-run grouping has its own state.** Consecutive same-tool calls (3+) collapse into a `<ToolRun>` group with internal `useState(open)`. Per-node "expand" doesn't open the wrapping group. The toolbar's *expand all* sets a top-level `allOpen` flag that's OR'd into `ToolRun.forceOpen` — without that, the button looks broken.

**Layout has two modes driven by comment count.** When comments exist, `body-grid` is a 5-column grid (1fr | col | gap | rail | 1fr) and the header reserves matching right-padding. When no comments, both recenter to `1fr | col | 1fr`. The `no-comments` class lives on `.loaded-state` so both header and body collapse together — don't put it on just one.

**Comment positioning runs in `useLayoutEffect`.** Each comment card is `position: absolute` with `top: var(--anchor-top)` set from the matching node's bounding box. The anti-overlap pass walks sorted items and pushes overlapping ones down. A `ResizeObserver` on `.conversation` re-runs it when collapses shift heights.

**Search highlighting uses two paths.** Markdown content goes through `MD` → `highlightHTML(html, needle)` which DOM-walks and wraps text nodes with `<mark class="hl">`, skipping `SCRIPT`/`STYLE`/`MARK`. Plain text (user prompts, thinking blocks) uses the `<HiText>` React component. Both consume `SearchCtx`.

## The export function (most error-prone code)

`handleExport` in `app.jsx` builds a single self-contained HTML file by concatenating all source + CSS into one outer `<script type="text/babel">` tag, then injecting state as `window.__LOCKED_DATA__`. Two pitfalls:

1. **`</script>` and `</style>` literals in the bundled source must be escaped** to `<\/script>` / `<\/style>`. The bundled `app.jsx` itself contains `</script>` inside its own export template literal — without escaping, the HTML parser closes the outer script tag early. `safeJs` and `safeCss` handle this; don't bypass them.
2. **Asset URLs are rewritten** by `repAssets` — anywhere the source contains the exact strings `"assets/clawd.png"` or `"assets/person.png"`, they're swapped to base64 data URIs. If you add new asset paths, extend `repAssets`.

## Style for changes

The prototype is React-via-CDN with no build system. Don't introduce one (no Vite, no Webpack, no TypeScript) without explicit user direction — it would defeat the "single-file artifact you can share" premise.

Keep DOM/CSS pixel-faithful to the design when iterating; refer to BRIEF.md §6 (aesthetic) and §8 (feedback log) before redesigning anything that's already been deliberately tuned.
