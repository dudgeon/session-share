// ---------------------------------------------------------------------------
// ui.jsx — node + sidebar + toolbar components
// All React components shared via Object.assign(window, ...) at bottom.
// ---------------------------------------------------------------------------

const { useState, useEffect, useRef, useMemo, useCallback, useLayoutEffect, useContext, createContext, Fragment } = React;

const SearchCtx = createContext("");
window.SearchCtx = SearchCtx;

function escapeRegex(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

function highlightHTML(html, needle) {
  if (!needle) return html;
  const re = new RegExp(escapeRegex(needle), "gi");
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, "text/html");
  const root = doc.body.firstChild;
  const SKIP = new Set(["SCRIPT","STYLE","MARK"]);
  const walk = (node) => {
    for (const child of [...node.childNodes]) {
      if (child.nodeType === 3) {
        const text = child.nodeValue;
        if (!re.test(text)) { re.lastIndex = 0; continue; }
        re.lastIndex = 0;
        const frag = doc.createDocumentFragment();
        let last = 0;
        text.replace(re, (m, off) => {
          if (off > last) frag.appendChild(doc.createTextNode(text.slice(last, off)));
          const mk = doc.createElement("mark"); mk.className = "hl"; mk.textContent = m;
          frag.appendChild(mk); last = off + m.length; return m;
        });
        if (last < text.length) frag.appendChild(doc.createTextNode(text.slice(last)));
        child.replaceWith(frag);
      } else if (child.nodeType === 1 && !SKIP.has(child.tagName)) {
        walk(child);
      }
    }
  };
  walk(root);
  return root.innerHTML;
}

function HiText({ text }) {
  const needle = useContext(SearchCtx);
  if (!needle || !text) return text || null;
  const re = new RegExp(escapeRegex(needle), "gi");
  const out = []; let last = 0; let i = 0;
  text.replace(re, (m, off) => {
    if (off > last) out.push(text.slice(last, off));
    out.push(<mark key={i++} className="hl">{m}</mark>);
    last = off + m.length;
    return m;
  });
  if (last < text.length) out.push(text.slice(last));
  return <>{out}</>;
}
window.HiText = HiText;

const ASSET_CLAWD = "assets/clawd.png";
const ASSET_PERSON = "assets/person.png";

// ────────────────────────────────────────────────────────────────────────────
// Tiny icon helpers
// ────────────────────────────────────────────────────────────────────────────
const Icon = {
  Chevron: ({ open }) => (
    <svg className={`icn chev ${open ? "open" : ""}`} width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
      <path d="M3 4.5 L6 7.5 L9 4.5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  Plus:  () => <svg className="icn" width="12" height="12" viewBox="0 0 12 12"><path d="M6 2v8M2 6h8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>,
  Trash: () => <svg className="icn" width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"><path d="M2.5 4h9M5.5 4V2.5h3V4M4 4l.5 7.5h5L10 4"/></svg>,
  Comment: () => <svg className="icn" width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3.5h10v6.5H6L3.5 12V10H2z"/></svg>,
  Copy: () => <svg className="icn" width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="4" width="8" height="8" rx="1.2"/><path d="M2 9.5V2.5h7"/></svg>,
  Help: () => <svg className="icn" width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"><circle cx="7" cy="7" r="5.5"/><path d="M5.5 5.4c.1-1 .9-1.6 1.7-1.6 1 0 1.7.7 1.7 1.6 0 1.5-1.7 1.4-1.7 2.6"/><path d="M7.2 9.6h.01"/></svg>,
  Upload: () => <svg className="icn" width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"><path d="M7 9.5V2.5M4.2 5.3 7 2.5l2.8 2.8M2.5 11.5h9"/></svg>,
  Download: () => <svg className="icn" width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"><path d="M7 2.5v7M4.2 6.7 7 9.5l2.8-2.8M2.5 11.5h9"/></svg>,
  Lock: () => <svg className="icn" width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="6" width="8" height="6" rx="1"/><path d="M5 6V4.3a2 2 0 1 1 4 0V6"/></svg>,
  Edit: () => <svg className="icn" width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"><path d="m9.5 2.5 2 2L5 11l-2.5.5L3 9z"/></svg>,
  Search: () => <svg className="icn" width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"><circle cx="6" cy="6" r="3.7"/><path d="m9 9 2.5 2.5"/></svg>,
  X: () => <svg className="icn" width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"><path d="m3.5 3.5 7 7M10.5 3.5l-7 7"/></svg>,
};

// ────────────────────────────────────────────────────────────────────────────
// Mini-markdown via window.renderMarkdown (escaped, link-safe)
// ────────────────────────────────────────────────────────────────────────────
function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  const onClick = (e) => {
    e.stopPropagation();
    try {
      navigator.clipboard.writeText(text || "");
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch (_) {}
  };
  return (
    <button
      className={`copy-btn ${copied ? "is-copied" : ""}`}
      onClick={onClick}
      title="Copy prompt"
      aria-label="Copy prompt"
    >
      {copied ? <span className="copy-done">✓</span> : <Icon.Copy/>}
    </button>
  );
}
window.CopyButton = CopyButton;

function MD({ text, className }) {
  const needle = useContext(SearchCtx);
  const html = useMemo(() => highlightHTML(window.renderMarkdown(text || ""), needle), [text, needle]);
  return <div className={`md ${className || ""}`} dangerouslySetInnerHTML={{ __html: html }} />;
}

// ────────────────────────────────────────────────────────────────────────────
// Avatars
// ────────────────────────────────────────────────────────────────────────────
function Avatar({ kind }) {
  if (kind === "user-prompt") {
    return <span className="avatar avatar-user" aria-label="User"><img src={ASSET_PERSON} alt="" /></span>;
  }
  if (kind === "assistant-text" || kind === "thinking") {
    return <span className="avatar avatar-claude" aria-label="Claude"><img src={ASSET_CLAWD} alt="" /></span>;
  }
  return <span className="avatar avatar-tool" aria-hidden="true"></span>;
}

// ────────────────────────────────────────────────────────────────────────────
// Tool call body (collapsed + expanded)
// ────────────────────────────────────────────────────────────────────────────
function ToolCallBody({ node, collapsed }) {
  const summary = useMemo(() => window.SessionParser.summarizeToolCall(node), [node]);
  if (collapsed) {
    return (
      <div className="tool-line">
        <span className="tool-verb">{summary.verb}</span>
        {summary.target ? (
          <span className={`tool-target ${summary.mono ? "mono" : ""}`}>{summary.target}</span>
        ) : null}
        {node.isError ? <span className="tool-err">error</span> : null}
      </div>
    );
  }
  return (
    <div className="tool-detail">
      <div className="tool-line tool-line-detail">
        <span className="tool-verb">{summary.verb}</span>
        {summary.target ? <span className={`tool-target ${summary.mono ? "mono" : ""}`}>{summary.target}</span> : null}
      </div>
      {Object.keys(node.input || {}).length > 0 ? (
        <pre className="tool-input">{prettyInput(node.input)}</pre>
      ) : null}
      {node.result ? (
        <div className={`tool-result ${node.isError ? "is-error" : ""}`}>
          <div className="tool-result-label">{node.isError ? "Error" : "Result"}</div>
          <pre className="tool-result-body">{truncForDisplay(node.result)}</pre>
        </div>
      ) : null}
    </div>
  );
}

function prettyInput(input) {
  try {
    return JSON.stringify(input, null, 2);
  } catch { return String(input); }
}
function truncForDisplay(s) {
  if (!s) return "";
  // hard cap to avoid 50KB blobs in DOM
  return s.length > 8000 ? s.slice(0, 8000) + "\n…[truncated]" : s;
}

// ────────────────────────────────────────────────────────────────────────────
// Generic node row
// ────────────────────────────────────────────────────────────────────────────
function NodeRow({
  node, index, isCollapsed, isFirst,
  comments, mode,
  onToggleCollapse, onDelete, onAddComment, onScrollToComment,
}) {
  const ref = useRef(null);

  useEffect(() => {
    if (ref.current) ref.current.dataset.nodeId = node.id;
  }, [node.id]);

  const hasComments = comments && comments.length > 0;
  const canCollapse = node.kind === "tool-call" || node.kind === "thinking" || node.kind === "assistant-text" || node.kind === "user-prompt";

  // header per kind
  let body;
  if (node.kind === "user-prompt") {
    body = (
      <div className="node-body user-prompt">
        {isCollapsed ? (
          <div className="collapsed-line">
            <span className="kind-label">Prompt</span>
            <span className="collapsed-preview">{(node.text || "").replace(/\s+/g, " ").slice(0, 120)}</span>
          </div>
        ) : (
          <Fragment>
            <CopyButton text={node.text} />
            <MD text={node.text} className={`prompt-text reply ${isFirst ? "first-prompt" : ""}`} />
          </Fragment>
        )}
      </div>
    );
  } else if (node.kind === "assistant-text") {
    body = (
      <div className="node-body assistant-text">
        {isCollapsed ? (
          <div className="collapsed-line">
            <span className="kind-label">Reply</span>
            <span className="collapsed-preview">{(node.text || "").replace(/\s+/g, " ").slice(0, 120)}</span>
          </div>
        ) : (
          <MD text={node.text} className="reply" />
        )}
      </div>
    );
  } else if (node.kind === "thinking") {
    body = (
      <div className={`node-body thinking ${isCollapsed ? "is-collapsed" : ""}`}>
        {isCollapsed ? (
          <div className="collapsed-line">
            <span className="kind-label">Thinking</span>
            <span className="collapsed-preview">{(node.text || "").replace(/\s+/g, " ").slice(0, 100)}</span>
          </div>
        ) : (
          <div className="thinking-text"><HiText text={node.text} /></div>
        )}
      </div>
    );
  } else if (node.kind === "tool-call") {
    body = (
      <div className={`node-body tool-call ${isCollapsed ? "is-collapsed" : ""} ${node.isError ? "is-error" : ""}`}>
        <ToolCallBody node={node} collapsed={isCollapsed} />
      </div>
    );
  }

  return (
    <div
      ref={ref}
      className={`node node-${node.kind} ${isCollapsed ? "collapsed" : "expanded"} ${hasComments ? "has-comments" : ""}`}
      id={`node-${node.id}`}
    >
      <div className="node-rail">
        <Avatar kind={node.kind} />
      </div>
      <div className="node-main">
        <div
          className={`node-content ${canCollapse ? "clickable" : ""}`}
          onClick={canCollapse ? onToggleCollapse : undefined}
          role={canCollapse ? "button" : undefined}
          tabIndex={canCollapse ? 0 : -1}
          onKeyDown={canCollapse ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onToggleCollapse(); } } : undefined}
        >
          {canCollapse && (node.kind === "tool-call" || node.kind === "thinking" || isCollapsed) ? (
            <span className="chev-wrap"><Icon.Chevron open={!isCollapsed} /></span>
          ) : null}
          {body}
        </div>
        {mode === "edit" ? (
          <div className="node-handles">
            {canCollapse ? (
              <button className="hbtn hbtn-icon" onClick={onToggleCollapse} title={isCollapsed ? "Expand" : "Collapse by default"} aria-label={isCollapsed ? "Expand" : "Collapse by default"}>
                <Icon.Chevron open={!isCollapsed} />
              </button>
            ) : null}
            <button className="hbtn hbtn-icon" onClick={onAddComment} title="Add comment" aria-label="Add comment"><Icon.Comment/></button>
            <button className="hbtn hbtn-icon hbtn-danger" onClick={onDelete} title="Delete this node" aria-label="Delete this node"><Icon.Trash/></button>
          </div>
        ) : null}
        {hasComments ? (
          <button
            className="comment-marker"
            onClick={() => onScrollToComment && onScrollToComment(comments[0].id)}
            title={`${comments.length} comment${comments.length === 1 ? "" : "s"}`}
          >
            {comments.length}
          </button>
        ) : null}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Tool run (consecutive same-tool tool-calls grouped)
// ────────────────────────────────────────────────────────────────────────────
function ToolRun({ tool, nodes, forceOpen, renderNode }) {
  const [open, setOpen] = useState(false);
  const isOpen = forceOpen || open;
  const verb = (tool || "tool").toLowerCase();
  return (
    <div className={`tool-run ${isOpen ? "is-open" : ""}`}>
      <button
        className="tool-run-head"
        onClick={() => setOpen(o => !o)}
        aria-expanded={isOpen}
        title={isOpen ? "Collapse group" : "Expand group"}
      >
        <span className="chev-wrap"><Icon.Chevron open={isOpen} /></span>
        <span className="tool-run-label">
          <span className="tr-verb">{verb}</span>
          <span className="tr-sep">·</span>
          <span className="tr-count">{nodes.length} {nodes.length === 1 ? "call" : "calls"}</span>
        </span>
      </button>
      {isOpen ? (
        <div className="tool-run-body">
          {nodes.map(n => renderNode(n))}
        </div>
      ) : null}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Deleted run (consecutive deletions merged)
// ────────────────────────────────────────────────────────────────────────────
function DeletedRun({ count, mode, onRestore }) {
  return (
    <div className="deleted-run">
      <span className="deleted-line"></span>
      <span className="deleted-label">{count} {count === 1 ? "turn" : "turns"} hidden</span>
      <span className="deleted-line"></span>
      {mode === "edit" ? (
        <button className="hbtn deleted-restore" onClick={onRestore}>restore</button>
      ) : null}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Comment rail (right side)
// ────────────────────────────────────────────────────────────────────────────
function CommentRail({ items, mode, onEdit, onDelete, registerRef }) {
  if (!items || items.length === 0) return null;
  return (
    <aside className="comment-rail">
      {items.map((it) => (
        <CommentCard
          key={it.id}
          item={it}
          mode={mode}
          onEdit={(text) => onEdit(it.nodeId, it.id, text)}
          onDelete={() => onDelete(it.nodeId, it.id)}
          registerRef={(el) => registerRef && registerRef(it.id, el)}
        />
      ))}
    </aside>
  );
}

function CommentCard({ item, mode, onEdit, onDelete, registerRef }) {
  // Newly-added comments arrive with empty text — open them in edit mode so
  // the user doesn't have to click again to start typing.
  const [editing, setEditing] = useState(mode === "edit" && !item.text);
  const [draft, setDraft] = useState(item.text);

  useEffect(() => { setDraft(item.text); }, [item.text]);

  const taRef = useRef(null);
  useEffect(() => {
    if (editing && taRef.current) {
      taRef.current.focus();
      taRef.current.selectionStart = taRef.current.value.length;
    }
  }, [editing]);

  const save = () => {
    onEdit(draft.trim());
    setEditing(false);
  };

  const handleScrollTo = () => {
    const el = document.getElementById(`node-${item.nodeId}`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  return (
    <div
      className={`comment-card ${editing ? "editing" : ""}`}
      ref={registerRef}
      data-comment-id={item.id}
      data-node-id={item.nodeId}
      style={{ "--anchor-top": item.anchorTop + "px" }}
    >
      <button className="comment-anchor-btn" onClick={handleScrollTo} title="Jump to node">
        <span className="comment-author">{item.author || "comment"}</span>
        <span className="comment-anchor-line"></span>
      </button>
      {editing ? (
        <div className="comment-edit-wrap">
          <textarea
            ref={taRef}
            className="comment-textarea"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Write a comment. Markdown ok."
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") save();
              if (e.key === "Escape") { setEditing(false); setDraft(item.text); }
            }}
          />
          <div className="comment-actions">
            <button className="hbtn" onClick={save}>save</button>
            <button className="hbtn" onClick={() => { setEditing(false); setDraft(item.text); }}>cancel</button>
          </div>
        </div>
      ) : (
        <div className="comment-view-wrap">
          <MD text={item.text || "_(empty comment)_"} className="comment-md" />
          {mode === "edit" ? (
            <div className="comment-actions">
              <button className="hbtn" onClick={() => setEditing(true)}><Icon.Edit/><span>edit</span></button>
              <button className="hbtn hbtn-danger" onClick={onDelete}><Icon.Trash/><span>delete</span></button>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Help popover (where to find your logs)
// ────────────────────────────────────────────────────────────────────────────
// Combined import + help modal
// Used for the "replace session" command, and the help link on the landing.
// ────────────────────────────────────────────────────────────────────────────
function ImportModal({ open, onClose, onFile, onSample, mode }) {
  const inputRef = useRef(null);
  const [drag, setDrag] = useState(false);
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  const handleFile = (f) => { onFile(f); onClose(); };
  const handleSample = () => { onSample(); onClose(); };
  return (
    <div className="modal-scrim" onClick={onClose}>
      <div className="import-card" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Import session">
        <div className="import-head">
          <h2>{mode === "replace" ? "Replace session log" : "Import a session log"}</h2>
          <button className="iconbtn" onClick={onClose} aria-label="Close"><Icon.X/></button>
        </div>

        <div className="import-body">
          <div
            className={`drop ${drag ? "is-drag" : ""}`}
            onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDrag(false);
              const file = e.dataTransfer.files[0];
              if (file) handleFile(file);
            }}
            onClick={() => inputRef.current && inputRef.current.click()}
          >
            <Icon.Upload />
            <div className="drop-label">
              <strong>Choose a .jsonl file</strong>
              <span>or drag &amp; drop here</span>
            </div>
            <input
              ref={inputRef}
              type="file"
              accept=".jsonl,.json,.txt"
              style={{ display: "none" }}
              onChange={(e) => { if (e.target.files[0]) handleFile(e.target.files[0]); }}
            />
          </div>

          {onSample ? (
            <div className="import-sample">
              <button className="link-btn" onClick={handleSample}>Or try a sample session →</button>
            </div>
          ) : null}

          {mode === "replace" ? (
            <p className="import-replace-note">
              Replacing the session will reset your collapses, comments, and deletions for the current file.
            </p>
          ) : null}

          <details className="help-disclosure" open={mode !== "replace"}>
            <summary>
              <span className="help-summary-label">Your logs live at</span>
              <code className="help-summary-path">~/.claude/projects/</code>
            </summary>
            <div className="help-body">
              <p>Each Claude Code session is one <code>.jsonl</code> file under that folder.</p>
              <ol>
                <li>In Finder, press <kbd>⌘ ⇧ G</kbd> and paste the path. (In a file dialog, <kbd>⌘ ⇧ .</kbd> reveals hidden files.)</li>
                <li>Open the subfolder named after your project — usually a slug of its absolute path, e.g. <code>-Users-you-Documents-GitHub-myproject</code>.</li>
                <li>Sort by date modified to find the most recent session, then drop it above.</li>
              </ol>
              <p className="help-note">
                Linux: same path. Windows: <code>%USERPROFILE%\.claude\projects\</code> — toggle <em>Show hidden files</em> in Explorer first (Linux: <kbd>Ctrl H</kbd>).
              </p>
            </div>
          </details>
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Empty / import landing
// ────────────────────────────────────────────────────────────────────────────
function ImportLanding({ onFile, onSample, onHelp }) {
  const inputRef = useRef(null);
  const [drag, setDrag] = useState(false);
  return (
    <div className="landing">
      <div className="landing-art">
        <img src={ASSET_CLAWD} alt="" className="landing-clawd" />
        <div className="landing-rules"></div>
      </div>
      <h1 className="landing-title">Share a Claude Code session</h1>
      <p className="landing-sub">
        Drop a session log to render it as a readable, annotated artifact. Works fully in your browser — nothing is uploaded anywhere.
      </p>
      <div
        className={`drop ${drag ? "is-drag" : ""}`}
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          const file = e.dataTransfer.files[0];
          if (file) onFile(file);
        }}
        onClick={() => inputRef.current && inputRef.current.click()}
      >
        <Icon.Upload />
        <div className="drop-label">
          <strong>Choose a .jsonl file</strong>
          <span>or drag &amp; drop here</span>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept=".jsonl,.json,.txt"
          style={{ display: "none" }}
          onChange={(e) => { if (e.target.files[0]) onFile(e.target.files[0]); }}
        />
      </div>
      <div className="landing-aux">
        <button className="link-btn" onClick={onHelp}>
          <Icon.Help/> Where do I find my session logs?
        </button>
        <span className="landing-aux-sep">·</span>
        <button className="link-btn" onClick={onSample}>Try a sample session</button>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Header (title, byline, meta) — editable in edit mode
// ────────────────────────────────────────────────────────────────────────────
function SessionHeader({ meta, sessionInfo, onMetaChange, mode }) {
  const dur = formatDuration(sessionInfo.firstTimestamp, sessionInfo.lastTimestamp);
  const date = formatDate(sessionInfo.firstTimestamp);
  const [metaOpen, setMetaOpen] = useState(false);

  const handleField = (key) => (e) => onMetaChange({ ...meta, [key]: e.target.value });

  return (
    <header className="session-header">
      <div className="session-eyebrow">
        <span className="eyebrow-dot"></span>
        <span>Claude Code session</span>
        {date ? <span className="eyebrow-pair"><span className="eyebrow-sep">·</span><span>{date}</span></span> : null}
      </div>

      {mode === "edit" ? (
        <input
          className="title-input"
          value={meta.title}
          placeholder="Untitled session"
          onChange={handleField("title")}
        />
      ) : (
        <h1 className="session-title">{meta.title || "Untitled session"}</h1>
      )}

      <div className="session-byline">
        <span>by </span>
        {mode === "edit" ? (
          <input
            className="byline-input"
            value={meta.author}
            placeholder="your name"
            onChange={handleField("author")}
          />
        ) : (
          <span className="byline-name">{meta.author || "—"}</span>
        )}
      </div>

      {mode === "edit" ? (
        <textarea
          className="desc-input"
          value={meta.description}
          placeholder="A sentence or two of context. What were you trying to do? What's worth noticing?"
          onChange={handleField("description")}
        />
      ) : meta.description ? (
        <p className="session-desc">{meta.description}</p>
      ) : null}

      <div className="session-meta-wrap">
        <button
          type="button"
          className="session-meta-toggle"
          onClick={() => setMetaOpen(o => !o)}
          aria-expanded={metaOpen}
        >
          <span className="chev-wrap"><Icon.Chevron open={metaOpen} /></span>
          <span className="smt-summary">
            {sessionInfo.cwd ? <span className="smt-chip mono">{shortenCwd(sessionInfo.cwd)}</span> : null}
            {sessionInfo.gitBranch ? <span className="smt-chip mono">{sessionInfo.gitBranch}</span> : null}
            {dur ? <span className="smt-chip">{dur}</span> : null}
            <span className="smt-chip">{sessionInfo.messageCount} msgs · {sessionInfo.toolCount} tools</span>
          </span>
        </button>
        {metaOpen ? (
          <dl className="session-meta">
            {sessionInfo.cwd ? <span className="meta-pair"><dt>cwd</dt><dd className="mono">{shortenCwd(sessionInfo.cwd)}</dd></span> : null}
            {sessionInfo.gitBranch ? <span className="meta-pair"><dt>branch</dt><dd className="mono">{sessionInfo.gitBranch}</dd></span> : null}
            {sessionInfo.version ? <span className="meta-pair"><dt>cc version</dt><dd className="mono">{sessionInfo.version}</dd></span> : null}
            {dur ? <span className="meta-pair"><dt>duration</dt><dd>{dur}</dd></span> : null}
            <span className="meta-pair"><dt>messages</dt><dd>{sessionInfo.messageCount}</dd></span>
            <span className="meta-pair"><dt>tool calls</dt><dd>{sessionInfo.toolCount}</dd></span>
          </dl>
        ) : null}
      </div>
    </header>
  );
}

function shortenCwd(p) {
  if (!p) return "";
  return p.replace(/^\/Users\/[^/]+/, "~").replace(/^\/home\/[^/]+/, "~");
}

function formatDate(iso) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
  } catch { return ""; }
}

function formatDuration(a, b) {
  if (!a || !b) return "";
  try {
    const ms = new Date(b) - new Date(a);
    if (ms < 0) return "";
    const m = Math.round(ms / 60000);
    if (m < 1) return "< 1 min";
    if (m < 60) return `${m} min`;
    const h = Math.floor(m / 60);
    const rem = m % 60;
    return rem ? `${h}h ${rem}m` : `${h}h`;
  } catch { return ""; }
}

// ────────────────────────────────────────────────────────────────────────────
// Toolbar
// ────────────────────────────────────────────────────────────────────────────
function Toolbar({
  mode, onMode, onUploadClick, onExport,
  search, onSearch, theme, onTheme, hasData,
  onCollapseAll, onExpandAll,
}) {
  return (
    <div className="toolbar">
      <div className="toolbar-inner">
        <div className="toolbar-left">
          <div className="brandmark">
            <img src={ASSET_CLAWD} alt="" />
            <span>session.share</span>
          </div>
        </div>
        <div className="toolbar-mid">
          {hasData ? (
            <div className="search">
              <Icon.Search />
              <input
                placeholder="Search this session"
                value={search}
                onChange={(e) => onSearch(e.target.value)}
              />
              {search ? <button className="iconbtn" onClick={() => onSearch("")}><Icon.X /></button> : null}
            </div>
          ) : null}
        </div>
        <div className="toolbar-right">
          {hasData ? (
            <div className="seg">
              <button className={mode === "edit" ? "on" : ""} onClick={() => onMode("edit")}><Icon.Edit/> Edit</button>
              <button className={mode === "view" ? "on" : ""} onClick={() => onMode("view")}><Icon.Lock/> View</button>
            </div>
          ) : null}

          {hasData && mode === "view" ? (
            <span className="tbtn-group">
              <button className="tbtn" onClick={onExpandAll} title="Expand everything">expand all</button>
              <button className="tbtn" onClick={onCollapseAll} title="Collapse defaults">collapse</button>
            </span>
          ) : null}

          <button className="tbtn" onClick={onUploadClick} title="Replace session log">
            <Icon.Upload/> {hasData ? "replace" : "upload"}
          </button>
          {hasData ? (
            <button className="tbtn tbtn-primary" onClick={onExport} title="Export single-file HTML">
              <Icon.Download/> export
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Theme switcher
// ────────────────────────────────────────────────────────────────────────────
const THEMES = [
  { id: "letter",     label: "Letter",      desc: "Cream paper, marginalia comments" },
  { id: "atelier",    label: "Atelier",     desc: "Timeline gutter, numbered turns" },
  { id: "fieldnotes", label: "Field notes", desc: "Ledger ruled, dense + monospace" },
  { id: "twilight",   label: "Twilight",    desc: "Dark plum, cream ink" },
];

function ThemeSwitcher({ theme, onTheme }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);
  const current = THEMES.find(t => t.id === theme) || THEMES[0];
  return (
    <div className="theme-pick" ref={ref}>
      <button className="tbtn" onClick={() => setOpen(o => !o)} title="Visual theme">
        <span className={`theme-swatch swatch-${theme}`}></span>
        <span>{current.label}</span>
      </button>
      {open ? (
        <div className="theme-menu">
          {THEMES.map(t => (
            <button
              key={t.id}
              className={`theme-opt ${t.id === theme ? "on" : ""}`}
              onClick={() => { onTheme(t.id); setOpen(false); }}
            >
              <span className={`theme-swatch swatch-${t.id}`}></span>
              <span className="theme-opt-text">
                <span className="theme-opt-label">{t.label}</span>
                <span className="theme-opt-desc">{t.desc}</span>
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Export
// ────────────────────────────────────────────────────────────────────────────
Object.assign(window, {
  Icon, MD, Avatar, NodeRow, DeletedRun, ToolRun,
  CommentRail, CommentCard, ImportModal,
  ImportLanding, SessionHeader, Toolbar, THEMES,
});
