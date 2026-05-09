// ---------------------------------------------------------------------------
// app.jsx — root <App>, state + persistence + export
// ---------------------------------------------------------------------------

const { useState: U, useEffect: E, useRef: R, useMemo: M, useLayoutEffect: LE, Fragment: F } = React;

// ────────────────────────────────────────────────────────────────────────────
// Persistence
// ────────────────────────────────────────────────────────────────────────────
const LS_KEY = "session-share-v1";
const PREFS_KEY = "session-share-prefs-v1";

function loadPersisted() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}
function savePersisted(state) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify({
      raw: state.raw,
      edits: state.edits,
      meta: state.meta,
      theme: state.theme,
      mode: state.mode,
    }));
    return true;
  } catch (e) {
    return false;
  }
}
function loadPrefs() {
  try { return JSON.parse(localStorage.getItem(PREFS_KEY) || "{}"); }
  catch { return {}; }
}
function savePrefs(prefs) {
  try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch {}
}

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────
function uid() { return Math.random().toString(36).slice(2, 9); }

function downloadFile(filename, content, mime) {
  const blob = new Blob([content], { type: mime || "text/html" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 0);
}

function slugify(s) {
  return (s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
}

function escapeHtml(s) {
  return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

// ────────────────────────────────────────────────────────────────────────────
// App
// ────────────────────────────────────────────────────────────────────────────
function App() {
  const isLocked = !!window.__LOCKED_DATA__;
  const persisted = !isLocked ? loadPersisted() : null;
  const exported = isLocked ? window.__LOCKED_DATA__ : null;

  const [raw, setRaw] = U(exported ? exported.raw : (persisted ? persisted.raw : ""));
  const [edits, setEdits] = U(exported ? exported.edits : (persisted ? persisted.edits : {}));
  const [meta, setMeta] = U(exported ? exported.meta : (persisted ? persisted.meta : { title: "", author: "", description: "" }));
  const [mode, setMode] = U(isLocked ? "view" : (persisted ? persisted.mode : "edit"));
  // searchInput drives the input field (instant); search drives the actual
  // highlighting (debounced). Walking the DOM and inserting <mark> nodes is
  // expensive — short queries like "e" match thousands of times and made the
  // next keystroke feel sticky.
  const [searchInput, setSearchInput] = U("");
  const [search, setSearch] = U("");
  E(() => {
    const t = setTimeout(() => setSearch(searchInput), 120);
    return () => clearTimeout(t);
  }, [searchInput]);
  const [showImport, setShowImport] = U(false);
  const [parseError, setParseError] = U(null);
  const [prefs, setPrefs] = U(loadPrefs);
  const [showExportInfo, setShowExportInfo] = U(false);
  const [persistError, setPersistError] = U(false);
  // ID of the comment that was just added — CommentCard reads this to enter
  // edit mode automatically on mount, then clears it via onConsumeAutoEdit.
  const [autoEditCommentId, setAutoEditCommentId] = U(null);
  // Theme is locked to fieldnotes; the html element already carries it from
  // markup, so no runtime sync needed.
  const theme = "fieldnotes";

  // Persist on changes (skip in locked mode)
  E(() => {
    if (isLocked) return;
    const ok = savePersisted({ raw, edits, meta, theme, mode });
    setPersistError(!ok);
  }, [raw, edits, meta, mode, isLocked]);
  // Lock indicator on body for CSS hooks
  E(() => { if (isLocked) document.body.dataset.locked = "true"; }, [isLocked]);

  // Parse
  const parsed = M(() => {
    if (!raw) return null;
    try {
      setParseError(null);
      return window.SessionParser.parseSessionJSONL(raw);
    } catch (err) {
      setParseError(err.message || "Could not parse this file.");
      return null;
    }
    // eslint-disable-next-line
  }, [raw]);

  // ── File handling ─────────────────────────────────────────────────────────
  const handleFile = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target.result;
      setRaw(text);
      setEdits({});                                                // wipe per-node overrides on new file
      setMeta((m) => ({ ...m, title: m.title || filenameToTitle(file.name) }));
      setMode("edit");
    };
    reader.readAsText(file);
  };

  const handleSample = async () => {
    try {
      const r = await fetch("assets/sample.jsonl");
      const text = await r.text();
      setRaw(text);
      setEdits({});
      setMeta({ title: "Sample · Rollout design handoff", author: "demo", description: "A short session showing how Claude Code consumes a design handoff and pushes it to GitHub." });
      setMode("edit");
    } catch {
      alert("Could not load sample. Try uploading your own file.");
    }
  };

  const triggerUpload = () => setShowImport(true);

  // ── Per-node mutations ────────────────────────────────────────────────────
  const updateEdit = (nodeId, patch) => {
    setEdits((prev) => ({
      ...prev,
      [nodeId]: { ...(prev[nodeId] || {}), ...patch },
    }));
  };

  const toggleCollapse = (node) => {
    const cur = edits[node.id];
    const def = window.SessionParser.defaultCollapsed(node);
    const isCollapsed = cur && typeof cur.collapsed === "boolean" ? cur.collapsed : def;
    updateEdit(node.id, { collapsed: !isCollapsed });
  };

  const deleteNode = (node) => {
    updateEdit(node.id, { deleted: true });
  };

  const addComment = (node) => {
    const newId = uid();
    const cur = edits[node.id] || {};
    const comments = (cur.comments || []).concat({
      id: newId,
      text: "",
      author: meta.author || "note",
      createdAt: Date.now(),
    });
    updateEdit(node.id, { comments });
    setAutoEditCommentId(newId);
  };

  const editComment = (nodeId, commentId, text) => {
    const cur = edits[nodeId] || {};
    const comments = (cur.comments || []).map((c) => c.id === commentId ? { ...c, text } : c);
    updateEdit(nodeId, { comments });
  };

  const deleteComment = (nodeId, commentId) => {
    const cur = edits[nodeId] || {};
    const comments = (cur.comments || []).filter((c) => c.id !== commentId);
    updateEdit(nodeId, { comments });
  };

  const restoreRun = (nodeIds) => {
    setEdits((prev) => {
      const next = { ...prev };
      for (const id of nodeIds) {
        if (next[id]) next[id] = { ...next[id], deleted: false };
      }
      return next;
    });
  };

  // Force-open is propagated to ToolRun groups; without it, "expand all" only
  // expands the inner nodes whose collapsed group hides them.
  const [allOpen, setAllOpen] = U(false);

  const collapseAllDefaults = () => {
    setAllOpen(false);
    setEdits((prev) => {
      const next = { ...prev };
      for (const k of Object.keys(next)) {
        if (next[k] && typeof next[k].collapsed === "boolean") {
          next[k] = { ...next[k], collapsed: undefined };
          if (Object.keys(next[k]).every(kk => next[k][kk] === undefined)) delete next[k];
        }
      }
      return next;
    });
  };
  const expandAll = () => {
    if (!parsed) return;
    setAllOpen(true);
    setEdits((prev) => {
      const next = { ...prev };
      for (const n of parsed.nodes) {
        next[n.id] = { ...(next[n.id] || {}), collapsed: false };
      }
      return next;
    });
  };

  // ── Search ────────────────────────────────────────────────────────────────
  const searchHits = M(() => {
    if (!parsed || !search.trim()) return null;
    const needle = search.toLowerCase();
    const hits = new Set();
    for (const n of parsed.nodes) {
      const hay = [
        n.text || "",
        n.toolName || "",
        n.input ? JSON.stringify(n.input) : "",
        n.result || "",
      ].join(" ").toLowerCase();
      if (hay.includes(needle)) hits.add(n.id);
    }
    return hits;
  }, [parsed, search]);

  // ── Effective node list (with grouped deletions + tool-runs) ─────────────
  const renderable = M(() => {
    if (!parsed) return [];
    // pass 1: drop deletions, group runs of consecutive deletions
    const live = [];
    let runIds = [];
    for (const n of parsed.nodes) {
      const e = edits[n.id] || {};
      if (e.deleted) { runIds.push(n.id); continue; }
      if (runIds.length) {
        live.push({ kind: "deleted-run", count: runIds.length, nodeIds: runIds });
        runIds = [];
      }
      live.push({ kind: "node", node: n });
    }
    if (runIds.length) live.push({ kind: "deleted-run", count: runIds.length, nodeIds: runIds });

    // pass 2: group consecutive same-tool tool-calls (≥3) into tool-run
    const out = [];
    const TOOL_RUN_MIN = 3;
    let buf = [];
    const flushBuf = () => {
      if (buf.length >= TOOL_RUN_MIN) {
        out.push({ kind: "tool-run", tool: buf[0].node.tool, nodes: buf.map(b => b.node) });
      } else {
        for (const b of buf) out.push(b);
      }
      buf = [];
    };
    for (const it of live) {
      if (it.kind === "node" && it.node.kind === "tool-call") {
        if (buf.length === 0 || buf[0].node.tool === it.node.tool) {
          buf.push(it);
          continue;
        }
        flushBuf();
        buf.push(it);
        continue;
      }
      flushBuf();
      out.push(it);
    }
    flushBuf();
    return out;
  }, [parsed, edits]);

  // ── Comments flat list with positioning data ─────────────────────────────
  const allComments = M(() => {
    if (!parsed) return [];
    const out = [];
    for (const n of parsed.nodes) {
      const e = edits[n.id] || {};
      if (e.deleted) continue;
      for (const c of (e.comments || [])) {
        out.push({ ...c, nodeId: n.id, anchorTop: 0 });
      }
    }
    return out;
  }, [parsed, edits]);

  // Position comments to align with their nodes
  const conversationRef = R(null);
  const railRef = R(null);
  const commentRefs = R(new Map());
  const [positioned, setPositioned] = U([]);

  const recomputePositions = () => {
    if (!conversationRef.current) return;
    const grid = conversationRef.current.parentElement; // body-grid
    if (!grid) return;
    const gridTop = grid.getBoundingClientRect().top + window.scrollY;
    const items = [];
    for (const c of allComments) {
      const nodeEl = document.getElementById(`node-${c.nodeId}`);
      if (!nodeEl) continue;
      const r = nodeEl.getBoundingClientRect();
      const top = (r.top + window.scrollY) - gridTop;
      items.push({ ...c, anchorTop: top });
    }
    items.sort((a, b) => a.anchorTop - b.anchorTop);
    // Anti-overlap pass
    const MIN_GAP = 12;
    for (let i = 1; i < items.length; i++) {
      const prev = items[i - 1];
      const prevEl = commentRefs.current.get(prev.id);
      const prevH = prevEl ? prevEl.offsetHeight : 80;
      const minTop = prev.anchorTop + prevH + MIN_GAP;
      if (items[i].anchorTop < minTop) items[i].anchorTop = minTop;
    }
    setPositioned(items);
  };

  LE(() => {
    recomputePositions();
    // eslint-disable-next-line
  }, [allComments, edits, mode, theme, search]);

  // ── Search match highlighting now happens in MD/text components via context

  E(() => {
    const onResize = () => recomputePositions();
    window.addEventListener("resize", onResize);
    // observe DOM size changes (collapsing nodes shifts everything)
    let ro;
    if (conversationRef.current && window.ResizeObserver) {
      ro = new ResizeObserver(onResize);
      ro.observe(conversationRef.current);
    }
    return () => {
      window.removeEventListener("resize", onResize);
      if (ro) ro.disconnect();
    };
    // eslint-disable-next-line
  }, [parsed]);

  // recompute when fonts settle
  E(() => {
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => recomputePositions());
    }
    // eslint-disable-next-line
  }, []);

  // ── Export ────────────────────────────────────────────────────────────────
  const handleExport = async () => {
    try {
      const blobToDataUri = (blob) => new Promise((res, rej) => {
        const fr = new FileReader();
        fr.onload = () => res(fr.result);
        fr.onerror = rej;
        fr.readAsDataURL(blob);
      });
      const REACT_URL = "https://unpkg.com/react@18.3.1/umd/react.production.min.js";
      const REACT_DOM_URL = "https://unpkg.com/react-dom@18.3.1/umd/react-dom.production.min.js";
      const BABEL_URL = "https://unpkg.com/@babel/standalone@7.29.0/babel.min.js";

      const [parserSrc, markdownSrc, uiSrc, appSrc, cssSrc, clawdBlob, personBlob] = await Promise.all([
        fetch("parser.jsx").then(r => r.text()),
        fetch("markdown.jsx").then(r => r.text()),
        fetch("ui.jsx").then(r => r.text()),
        fetch("app.jsx").then(r => r.text()),
        fetch("themes.css").then(r => r.text()),
        fetch("assets/clawd.png").then(r => r.blob()),
        fetch("assets/person.png").then(r => r.blob()),
      ]);

      // Try to inline React/Babel for a fully offline artifact. If unpkg is
      // unreachable (offline export), fall back to <script src=...> tags so
      // the artifact still works for viewers with a connection.
      // Override with ?inline=0 in the URL to force the CDN-tag path (useful
      // for testing whether viewers' networks reach unpkg).
      const inlineParam = new URLSearchParams(window.location.search).get("inline");
      const inlineLibs = inlineParam === "0" ? false : true;
      let libsBlock;
      if (!inlineLibs) {
        libsBlock =
`<script src="${REACT_URL}" crossorigin="anonymous"></script>
<script src="${REACT_DOM_URL}" crossorigin="anonymous"></script>
<script src="${BABEL_URL}" crossorigin="anonymous"></script>`;
      } else {
        try {
          const [reactSrc, reactDomSrc, babelSrc] = await Promise.all([
            fetch(REACT_URL).then(r => { if (!r.ok) throw new Error("react"); return r.text(); }),
            fetch(REACT_DOM_URL).then(r => { if (!r.ok) throw new Error("react-dom"); return r.text(); }),
            fetch(BABEL_URL).then(r => { if (!r.ok) throw new Error("babel"); return r.text(); }),
          ]);
          const safeJs = (s) => s.replace(/<\/script/gi, "<\\/script");
          libsBlock =
`<script>${safeJs(reactSrc)}</script>
<script>${safeJs(reactDomSrc)}</script>
<script>${safeJs(babelSrc)}</script>`;
        } catch (e) {
          console.warn("Could not inline React/Babel; falling back to CDN tags:", e);
          libsBlock =
`<script src="${REACT_URL}" crossorigin="anonymous"></script>
<script src="${REACT_DOM_URL}" crossorigin="anonymous"></script>
<script src="${BABEL_URL}" crossorigin="anonymous"></script>`;
        }
      }

      const clawdUri = await blobToDataUri(clawdBlob);
      const personUri = await blobToDataUri(personBlob);
      const repAssets = (s) => s
        .split('"assets/clawd.png"').join('"' + clawdUri + '"')
        .split('"assets/person.png"').join('"' + personUri + '"');

      // Inlined source can contain literal "</script>" (in comments and in
      // this very export template). Without escaping, the HTML parser ends
      // the outer <script> early and dumps the rest of the source as text.
      // "<\/script" still parses to "</script" in JS strings/comments but
      // the HTML parser doesn't recognise it as a closing tag.
      const safeJs = (s) => s.replace(/<\/script/gi, "<\\/script");
      const safeCss = (s) => s.replace(/<\/style/gi, "<\\/style");

      const exportState = {
        raw, edits, meta, theme,
        version: 1,
        exportedAt: new Date().toISOString(),
      };

      const stateJson = JSON.stringify(exportState).replace(/</g, "\\u003c");

      const title = escapeHtml(meta.title || "Claude Code session");
      const desc = escapeHtml(meta.description || "");

      const html =
`<!DOCTYPE html>
<html lang="en" data-theme="${theme}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<meta name="description" content="${desc}">
<style>${safeCss(cssSrc)}</style>
</head>
<body>
<div id="root"></div>
<script>window.__LOCKED_DATA__ = ${stateJson};</script>
${libsBlock}
<script type="text/babel" data-presets="react">
${safeJs(repAssets(parserSrc))}
${safeJs(repAssets(markdownSrc))}
${safeJs(repAssets(uiSrc))}
${safeJs(repAssets(appSrc))}
</script>
</body>
</html>`;

      const filename = (slugify(meta.title) || "session") + ".html";
      downloadFile(filename, html, "text/html");
      if (!prefs.hideExportInfo) setShowExportInfo(true);
    } catch (err) {
      console.error(err);
      alert("Export failed: " + (err.message || err));
    }
  };

  const updatePref = (key, val) => {
    const next = { ...prefs, [key]: val };
    setPrefs(next);
    savePrefs(next);
  };

  // ── Render ────────────────────────────────────────────────────────────────
  const hasData = !!parsed;
  const sessionInfo = parsed ? parsed.session : { messageCount: 0, toolCount: 0 };
  const hasComments = positioned.length > 0;

  // Compute first user-prompt index for drop-cap
  const firstPromptIdx = parsed
    ? (() => {
        for (let i = 0; i < parsed.nodes.length; i++) {
          const n = parsed.nodes[i];
          if (n.kind === "user-prompt" && !(edits[n.id] && edits[n.id].deleted)) return n.id;
        }
        return null;
      })()
    : null;

  return (
    <div className="app-root">
      {persistError ? (
        <div className="persist-warn" role="status">
          <span>Session too large to autosave to this browser. Your edits are still in memory but will be lost if you refresh — export now to keep them.</span>
          <button className="iconbtn" onClick={() => setPersistError(false)} aria-label="Dismiss"><Icon.X/></button>
        </div>
      ) : null}
      <Toolbar
        mode={mode}
        onMode={isLocked ? () => {} : setMode}
        onUploadClick={triggerUpload}
        onExport={handleExport}
        search={searchInput}
        onSearch={setSearchInput}
        hasData={hasData}
        isLocked={isLocked}
        onCollapseAll={collapseAllDefaults}
        onExpandAll={expandAll}
      />

      <main className="page">
        {!hasData ? (
          <div className="empty-state">
            {parseError ? (
              <div style={{ maxWidth: 520, margin: "60px auto 0", padding: 16, border: "1px solid var(--rule)", borderRadius: 8, background: "color-mix(in srgb, var(--error) 8%, var(--paper-2))" }}>
                <strong style={{ color: "var(--error)" }}>Couldn't parse that file.</strong>
                <p style={{ margin: "6px 0 0", fontSize: 14 }}>{parseError}</p>
              </div>
            ) : null}
            <ImportLanding
              onFile={handleFile}
              onSample={handleSample}
              onHelp={() => setShowImport(true)}
            />
          </div>
        ) : (
          <div className={`loaded-state ${hasComments ? "" : "no-comments"}`}>
            <SessionHeader
              meta={meta}
              sessionInfo={sessionInfo}
              onMetaChange={setMeta}
              mode={mode}
            />

            <div className={`body-grid ${hasComments ? "" : "no-comments"}`}>
              <div className="conversation" ref={conversationRef}>
                <window.SearchCtx.Provider value={search}>
                <div className="spine"></div>
                {renderable.map((it, idx) => {
                  if (it.kind === "deleted-run") {
                    return (
                      <DeletedRun
                        key={`del-${idx}`}
                        count={it.count}
                        mode={mode}
                        onRestore={() => restoreRun(it.nodeIds)}
                      />
                    );
                  }
                  if (it.kind === "tool-run") {
                    const innerHasComments = it.nodes.some(n => (edits[n.id]?.comments || []).length > 0);
                    return (
                      <ToolRun
                        key={`run-${it.nodes[0].id}`}
                        tool={it.tool}
                        nodes={it.nodes}
                        forceOpen={allOpen || innerHasComments || (searchHits && it.nodes.some(n => searchHits.has(n.id)))}
                        renderNode={(node) => {
                          const e = edits[node.id] || {};
                          const def = window.SessionParser.defaultCollapsed(node);
                          const isCollapsed = typeof e.collapsed === "boolean" ? e.collapsed : def;
                          const nodeComments = e.comments || [];
                          const hit = searchHits ? searchHits.has(node.id) : null;
                          return (
                            <div
                              key={node.id}
                              className={hit === false ? "search-miss-wrap" : (hit === true ? "search-hit-wrap" : "")}
                            >
                              <NodeRow
                                node={node}
                                index={idx}
                                isCollapsed={isCollapsed}
                                isFirst={false}
                                comments={nodeComments}
                                mode={mode}
                                onToggleCollapse={() => toggleCollapse(node)}
                                onDelete={() => deleteNode(node)}
                                onAddComment={() => addComment(node)}
                              />
                            </div>
                          );
                        }}
                      />
                    );
                  }
                  const node = it.node;
                  const e = edits[node.id] || {};
                  const def = window.SessionParser.defaultCollapsed(node);
                  const isCollapsed = typeof e.collapsed === "boolean" ? e.collapsed : def;
                  const isFirst = node.id === firstPromptIdx;
                  const nodeComments = e.comments || [];
                  const hit = searchHits ? searchHits.has(node.id) : null;
                  return (
                    <div
                      key={node.id}
                      className={hit === false ? "search-miss-wrap" : (hit === true ? "search-hit-wrap" : "")}
                    >
                      <NodeRow
                        node={node}
                        index={idx}
                        isCollapsed={isCollapsed}
                        isFirst={isFirst}
                        comments={nodeComments}
                        mode={mode}
                        onToggleCollapse={() => toggleCollapse(node)}
                        onDelete={() => deleteNode(node)}
                        onAddComment={() => addComment(node)}
                      />
                    </div>
                  );
                })}
                </window.SearchCtx.Provider>
              </div>

              <div className="rail-slot" ref={railRef}>
                {hasComments ? (
                  <CommentRail
                    items={positioned}
                    mode={mode}
                    onEdit={editComment}
                    onDelete={deleteComment}
                    registerRef={(id, el) => {
                      if (el) commentRefs.current.set(id, el);
                      else commentRefs.current.delete(id);
                    }}
                    autoEditId={autoEditCommentId}
                    onConsumeAutoEdit={() => setAutoEditCommentId(null)}
                    onResize={recomputePositions}
                  />
                ) : null}
              </div>
            </div>
          </div>
        )}
      </main>

      <ImportModal
        open={showImport}
        onClose={() => setShowImport(false)}
        onFile={handleFile}
        onSample={hasData ? null : handleSample}
        mode={hasData ? "replace" : "initial"}
      />

      <ExportInfoModal
        open={showExportInfo}
        onClose={() => setShowExportInfo(false)}
        hidePref={!!prefs.hideExportInfo}
        setHidePref={(v) => updatePref("hideExportInfo", v)}
      />
    </div>
  );
}

function filenameToTitle(name) {
  return (name || "")
    .replace(/\.(jsonl|json|txt|log)$/i, "")
    .replace(/^[a-f0-9-]{32,}$/i, "")    // raw uuid → leave blank
    .replace(/[-_]/g, " ")
    .trim();
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
