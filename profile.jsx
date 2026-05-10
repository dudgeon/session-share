// ---------------------------------------------------------------------------
// profile.jsx — home/profile view: list of shared sessions + new-session CTA
// ---------------------------------------------------------------------------

const { useState: PU, useRef: PR } = React;

function ProfileView({ profile, sessions, onNew, onOpen, onRename, onDelete, onProfileEdit, mode }) {
  const editable = mode !== "view";
  const list = (sessions || []).slice().sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

  return (
    <div className="profile-page">
      <header className="profile-head">
        <div className="profile-id">
          <div className="profile-avatar">
            <img src="assets/person.png" alt="" />
          </div>
          <div className="profile-id-text">
            {editable ? (
              <input
                className="profile-name"
                value={profile.name || ""}
                placeholder="Your name"
                onChange={(e) => onProfileEdit({ ...profile, name: e.target.value })}
              />
            ) : (
              <div className="profile-name profile-name-static">{profile.name || "Anonymous"}</div>
            )}
            <div className="profile-meta">
              <span>{list.length} {list.length === 1 ? "session" : "sessions"} shared</span>
              {profile.handle ? <><span className="dot">·</span><span className="mono">{profile.handle}</span></> : null}
            </div>
            {editable ? (
              <input
                className="profile-bio"
                value={profile.bio || ""}
                placeholder="A short bio — what do you build with Claude Code?"
                onChange={(e) => onProfileEdit({ ...profile, bio: e.target.value })}
              />
            ) : profile.bio ? (
              <p className="profile-bio profile-bio-static">{profile.bio}</p>
            ) : null}
          </div>
        </div>
      </header>

      <div className="profile-divider" />

      <section className="profile-sessions">
        <div className="profile-sessions-head">
          <h2 className="profile-section-title">Sessions</h2>
          {editable ? (
            <button className="tbtn tbtn-primary" onClick={onNew} title="Share a new session">
              <Icon.Plus/> share new session
            </button>
          ) : null}
        </div>

        {list.length === 0 ? (
          <EmptyShelf onNew={editable ? onNew : null} />
        ) : (
          <ul className="session-shelf">
            {list.map((s) => (
              <SessionCard
                key={s.id}
                session={s}
                editable={editable}
                onOpen={() => onOpen(s.id)}
                onRename={(title) => onRename(s.id, title)}
                onDelete={() => onDelete(s.id)}
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function EmptyShelf({ onNew }) {
  return (
    <div className="shelf-empty">
      <div className="shelf-empty-rule" />
      <div className="shelf-empty-body">
        <p className="shelf-empty-title">Nothing on the shelf yet.</p>
        <p className="shelf-empty-sub">Drop a Claude Code <code>.jsonl</code> log to render it as a readable, annotated artifact you can share with your team.</p>
        {onNew ? (
          <button className="tbtn tbtn-primary" onClick={onNew}>
            <Icon.Plus/> share your first session
          </button>
        ) : null}
      </div>
    </div>
  );
}

function SessionCard({ session, editable, onOpen, onRename, onDelete }) {
  const [confirm, setConfirm] = PU(false);
  const m = session.meta || {};
  const info = session.sessionInfo || {};
  const title = m.title || "Untitled session";
  const desc = (m.description || "").trim();
  const snippet = desc ? truncate(desc, 180) : firstPromptSnippet(session) || "No description.";
  const updated = session.updatedAt ? new Date(session.updatedAt) : null;
  const dateLabel = updated ? formatRelative(updated) : "";

  return (
    <li className={`session-card ${confirm ? "is-confirm" : ""}`}>
      <button className="session-card-hit" onClick={onOpen} aria-label={`Open ${title}`}>
        <div className="session-card-row1">
          <h3 className="session-card-title">{title}</h3>
          {dateLabel ? <span className="session-card-date">{dateLabel}</span> : null}
        </div>
        <p className="session-card-snippet">{snippet}</p>
        <div className="session-card-meta">
          {info.cwd ? <span className="scm-chip mono">{shortenCwdLite(info.cwd)}</span> : null}
          {info.gitBranch ? <span className="scm-chip mono">{info.gitBranch}</span> : null}
          {typeof info.messageCount === "number" ? <span className="scm-chip">{info.messageCount} msgs</span> : null}
          {typeof info.toolCount === "number" ? <span className="scm-chip">{info.toolCount} tools</span> : null}
          {info.duration ? <span className="scm-chip">{info.duration}</span> : null}
          {m.author ? <span className="scm-chip scm-author">{m.author}</span> : null}
        </div>
      </button>
      {editable ? (
        <div className="session-card-actions">
          {confirm ? (
            <>
              <span className="confirm-label">delete?</span>
              <button className="hbtn hbtn-danger" onClick={(e) => { e.stopPropagation(); onDelete(); }}>yes</button>
              <button className="hbtn" onClick={(e) => { e.stopPropagation(); setConfirm(false); }}>no</button>
            </>
          ) : (
            <button className="hbtn hbtn-icon" title="Delete session" onClick={(e) => { e.stopPropagation(); setConfirm(true); }}>
              <Icon.Trash/>
            </button>
          )}
        </div>
      ) : null}
    </li>
  );
}

function truncate(s, n) {
  s = (s || "").replace(/\s+/g, " ").trim();
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

function firstPromptSnippet(session) {
  if (!session.firstPrompt) return "";
  return truncate(session.firstPrompt, 180);
}

function shortenCwdLite(p) {
  if (!p) return "";
  const s = p.replace(/^\/Users\/[^/]+/, "~").replace(/^\/home\/[^/]+/, "~");
  const parts = s.split("/");
  if (parts.length > 3) return ".../" + parts.slice(-2).join("/");
  return s;
}

function formatRelative(d) {
  const ms = Date.now() - d.getTime();
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return min + "m ago";
  const hr = Math.floor(min / 60);
  if (hr < 24) return hr + "h ago";
  const days = Math.floor(hr / 24);
  if (days < 7) return days + "d ago";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: d.getFullYear() === new Date().getFullYear() ? undefined : "numeric" });
}

window.ProfileView = ProfileView;
