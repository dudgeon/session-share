# session.share — Project Brief

> A handoff document for Claude (or any contributor) joining the project cold. Pair this with the working prototype at `Session Share.html`.

---

## 1. What this is

**session.share** is a single-page web app that lets product managers (and anyone using Claude Code) **share their own — and read others' — Claude Code sessions** as readable, annotated artifacts.

The premise: Claude Code sessions are full of useful prompting craft, but the raw `.jsonl` transcripts are noisy and overwhelming. The "interesting" parts (the human's prompts, Claude's reasoning, the final answers) are buried in a sea of tool calls, file reads, edit diffs, and bash output. The goal is to make sessions **skimmable for learning** without losing the ability to drill into the full detail.

## 2. Goals

1. **Make prompts learnable.** A reader should be able to scroll a session and read every prompt and every substantive response without scrolling past hundreds of lines of `Read`/`Edit`/`Bash` output.
2. **Preserve full fidelity.** Nothing is deleted by default — collapsed nodes stay one click away, and the original prompt language is always accessible verbatim.
3. **Allow author commentary.** Authors can add notes to specific moments in the session ("here's where I pivoted because…") that render in a marginalia rail.
4. **Two clean states.** *Edit* mode for the author (collapse/delete/comment); *Locked* (viewer) mode for readers — same look, no controls.
5. **Single self-contained artifact.** Authors **export one HTML file** with the data + everything needed to view it. Open offline-ish, share via Slack/email/etc. No backend, no server.
6. **Zero LLM in the loop.** Summarization, default-collapse decisions, etc. are all **regex/heuristic-driven** in JS. No Claude calls at runtime.

## 3. Non-goals

- Not a real-time collaborative tool.
- Not a live Claude Code wrapper. It only ingests **completed** session logs.
- No backend storage. All state is local; export is the share mechanism.
- Not trying to summarize *meaning* — just to compress the noise.

## 4. The two modes

### Edit mode
- Import a `.jsonl` from `~/.claude/projects/<slug>/<uuid>.jsonl`.
- Toggle individual nodes between collapsed/expanded (overrides the default).
- Delete nodes (consecutive deletions render as a single `12 turns hidden` row with a restore option).
- Add comments to any node — they appear in a right-side rail aligned to that node.
- Edit session title, byline, and a short description.
- Collapse-all / expand-all helpers.
- Search.
- Choose a theme.
- Click **Export** → a single self-contained `.html` file is downloaded.

### Locked / viewer mode
- Same look, no edit chrome.
- Search, expand-all/collapse-all.
- Per-node "expand" peek for nodes the author left collapsed.
- Copy-prompt button on user turns.
- Comment rail visible only when ≥1 comment exists on a session.

## 5. Default-collapse rules (heuristic, no LLM)

These get auto-collapsed:
- All tool calls (`Bash`, `Read`, `Edit`, `Write`, `Grep`, etc.) — collapsed to a one-line summary like `read · path/to/file.tsx` or `bash · "git status"`.
- Tool results / outputs.
- Claude's `<thinking>` / reasoning blocks.
- Long file contents and diffs.

These stay expanded by default:
- User prompts (the whole point of the artifact).
- Claude's natural-language responses to the user.

**Consecutive same-tool runs** (3+ in a row) collapse into a single `read · 10 calls` row with a chevron. Expanding the run reveals the individual calls (each still respecting its own collapse state). Runs auto-open if any inner node has a comment or matches a search hit.

## 6. Aesthetic direction

Anthropic-y. Warm cream paper, restrained serif accents, no gradients, no emoji, no rounded-corner-with-left-accent SaaS tropes.

Four themes:
- **Letter** — narrow column, marginalia
- **Atelier** — numbered turns, dashed gutter timeline
- **Field notes** — ledger-ruled, mono accents, denser
- **Twilight** — dark plum, cream ink

User comments support basic markdown (links, bold, code, lists).

## 7. Architecture

Pure client-side React + Babel-in-the-browser. Files:

- `Session Share.html` — entry; loads everything via `<script>` tags.
- `parser.jsx` — parses Claude Code `.jsonl` into a node graph; classifies each line (`user-prompt`, `assistant-text`, `thinking`, `tool-call`, `tool-result`); applies default-collapse heuristics; groups consecutive same-tool runs.
- `markdown.jsx` — small custom markdown renderer (no third-party dep) that emits HTML; supports search-highlight `<mark>` injection.
- `ui.jsx` — all React components (Toolbar, NodeRow, ToolRun, CommentRail, CommentCard, ImportModal, ImportLanding, SessionHeader, Avatar, Icon set, MD, HiText, CopyButton).
- `app.jsx` — top-level App; state management for edits/comments/deletions; localStorage persistence keyed by file hash; export bundler that fetches all sources + asset PNGs (as base64 data URIs) and writes a single self-contained HTML.
- `themes.css` — all styles, including the four themes.
- `assets/clawd.png` — pixel-art icon for Claude.
- `assets/person.png` — emoji-style icon for the user.

State persistence: edits/comments/collapse-overrides are stored in `localStorage` so refreshing doesn't lose work. The exported HTML inlines the parsed data as a JSON blob.

## 8. Full feedback log (chronological)

This is every direction the user has given so far, in order. Treat it as design intent — when in doubt, defer to it.

1. **Initial brief** — make a single-page app for sharing Claude Code sessions. Allow reader to see full prompt language and full Claude response. Collapse the chatty back-and-forth (default-collapsed states should still be skimmable). Allow author to add context to nodes. Two states: edit + locked viewer. In edit mode: import, collapse, delete (rendered as 'deleted X turns'), comment, export. Export = single flat HTML, no editing controls. Single SPA, no backend, no LLM summarization (regex-driven). Represent Claude with the attached SVG; user with a gender-neutral person icon.

2. **Setup answers** —
   - Input format: Claude Code's `.jsonl` (one JSON message per line).
   - Need a help button explaining how to show hidden folders + where logs live (`~/.claude/projects/...`), placed near the upload button.
   - Assume users will sometimes pick the wrong file initially → support replace + re-render.
   - Comments support basic markdown (links).
   - Default-collapse: tool calls, tool results, thinking blocks, long file contents/diffs.
   - Aesthetic: Anthropic-y. Warm cream paper, serif accents, restrained.
   - Edit affordances: per-node collapse toggle, title + author/byline fields.
   - Viewer features: per-node expand for collapsed content, copy-prompt button on user turns, table of contents / scrubber, search.
   - Export: single self-contained file, same look as edit mode minus controls.
   - 4 variations.

3. **Action buttons** — Tightened the per-node action buttons to icon-only, smaller hit targets, subtle hover. (Done.)

4. **User prompt restraint** — The user prompt was originally a 22px display-serif pull-quote with drop-cap. Toned it down to a 14px UI-sans paragraph, no border, no drop-cap. *(Was later reversed — see #14.)*

5. **Group consecutive tool calls** — Runs of 3+ same-tool calls collapse to a single `read · 10 calls` row with a chevron. Expanding shows individual calls. Auto-opens if any inner node has a comment or search hit. (Done.)

6. **Verifier sweep fixes** — `dt` no-wrap on the meta grid; eyebrow date wraps gracefully; tool-run head no-wraps so "15 calls" stays together; comment marker is now a thin outlined dot in the accent color rather than a filled badge. (Done.)

7. **Search highlighting** — Search was wired up but selectors were wrong. Fixed; matching nodes show an accent rule on the left, non-matches dim to ~30% (lift to 60% on hover). Then: actually highlight matching text inline with `<mark class="hl">` — translucent accent, applied through markdown content (preserves links/code) and plain-text fields (user prompts, thinking blocks). Walker skips `<script>`/`<style>`/already-marked nodes. (Done.)

8. **Icon swap (Claude, attempt 1)** — Replaced the SVG. Broke things; reverted.

9. **Icon swap (Claude, attempt 2)** — Pixel-art PNG. Use `image-rendering: pixelated; crisp-edges` so it stays sharp at any size. Export inlines the PNG as a base64 data URI. (Done.)

10. **Import / replace UX** — Make a custom modal (not the system file dialog) for upload/replace. It should show the help content (how to show hidden folders, where logs live) AND a drag/drop target AND a select file button. (Done.)

11. **Help disclosure refinement** — Even in collapsed state, show the file path inline (e.g. "Your logs live at `~/.claude/projects/`"). In expanded state, reduce text size — was too large and hurt legibility. (Done.)

12. **Person icon swap** — Use the attached emoji-style PNG for the human user. (Done.)

13. **User prompt visual emphasis** — Prompts need to *pop* while preserving/increasing legibility. Currently flat. Add a card treatment: white-ish background, subtle border, accent left rule, soft shadow. Bump type size and weight. (Done — 15px / weight 500, near-white card, thin accent rule.)

14. **Bigger user avatar** — Came alongside #13. Avatar was 22px (image 14px); too small for the new emoji-style icon. Bumped slot to 28px, image to 26px; Claude pixel-bot scaled to match. (Done.)

15. **Markdown for user prompts + copy button** — Render user prompts through the markdown pipeline (so links, code blocks, lists work). Add a subtle copy button on each user prompt — icon only, top-right of the card, fades in on hover, ✓ flash on click. (Done — uses the same `MD` component as Claude replies; copy button stops click propagation so it doesn't toggle collapse.)

## 9. Open / probable next directions

- The exported single-file artifact currently fetches React/Babel from unpkg → needs internet on first open. Could be inlined for fully offline use; user hasn't asked yet.
- Comment positioning is anti-overlap but very long comment chains can still bunch.
- No Table of Contents / scrubber yet — was on the original list but hasn't been built explicitly (search and collapse-all currently fill the role).
- Keyboard shortcuts and an export-footer credit haven't been added (offered, not requested).

## 10. How to read the prototype

Open `Session Share.html` in a browser. Click **Try a sample session** on the landing to see a fully populated session with example comments, deletions, and tool-run grouping. Toggle between edit and locked from the toolbar to see both states. Cycle through the four themes from the toolbar's theme selector.
