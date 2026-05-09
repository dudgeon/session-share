// ---------------------------------------------------------------------------
// parser.jsx — Claude Code .jsonl → node array
// Pure functions, no React. Exposed on window for other scripts.
// ---------------------------------------------------------------------------

(function () {
  // ────────────────────────────────────────────────────────────────────────
  //  PARSE
  // ────────────────────────────────────────────────────────────────────────

  function parseSessionJSONL(text) {
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const records = [];
    for (const line of lines) {
      try { records.push(JSON.parse(line)); } catch (e) { /* skip malformed */ }
    }
    if (records.length === 0) {
      throw new Error("No valid JSON lines found. Are you sure this is a Claude Code transcript?");
    }

    // Index tool_results by tool_use_id so we can pair them with tool_use blocks
    const toolResults = {};
    for (const r of records) {
      if (r.type === "user" && r.message && Array.isArray(r.message.content)) {
        for (const part of r.message.content) {
          if (part && part.type === "tool_result") {
            toolResults[part.tool_use_id] = part;
          }
        }
      }
    }

    const nodes = [];
    let counter = 0;
    const mkId = () => `n${counter++}`;

    let session = {
      id: null, cwd: null, version: null, gitBranch: null,
      firstTimestamp: null, lastTimestamp: null,
      messageCount: 0, toolCount: 0,
    };

    for (const r of records) {
      if (!r || !r.type) continue;
      if (r.type === "queue-operation") continue;
      if (r.type === "last-prompt") continue;
      if (r.type === "summary") continue;

      // capture session metadata
      if (r.sessionId && !session.id) session.id = r.sessionId;
      if (r.cwd && !session.cwd) session.cwd = r.cwd;
      if (r.version && !session.version) session.version = r.version;
      if (r.gitBranch && !session.gitBranch) session.gitBranch = r.gitBranch;
      if (r.timestamp) {
        if (!session.firstTimestamp) session.firstTimestamp = r.timestamp;
        session.lastTimestamp = r.timestamp;
      }

      if (r.type === "attachment") continue; // tool listings, mcp instructions, auto_mode reminders — discard

      if (r.type === "user") {
        const c = r.message && r.message.content;
        if (typeof c === "string") {
          if (!c.trim()) continue;
          // Filter Claude Code's auto-injected system reminders
          if (c.startsWith("<system-reminder>") || c.startsWith("[Request interrupted")) continue;
          nodes.push({
            id: mkId(),
            kind: "user-prompt",
            text: c,
            timestamp: r.timestamp,
            uuid: r.uuid,
          });
          session.messageCount++;
        }
        // Array-form content is tool_result; handled by pairing below.
      } else if (r.type === "assistant") {
        const content = (r.message && r.message.content) || [];
        const model = r.message && r.message.model;
        for (const part of content) {
          if (!part || !part.type) continue;
          if (part.type === "thinking") {
            const txt = (part.thinking || "").trim();
            if (txt.length < 4) continue; // empty/signature-only thinking
            nodes.push({
              id: mkId(), kind: "thinking", text: txt,
              timestamp: r.timestamp, uuid: r.uuid, model,
            });
          } else if (part.type === "text") {
            const txt = (part.text || "").trim();
            if (!txt) continue;
            nodes.push({
              id: mkId(), kind: "assistant-text", text: txt,
              timestamp: r.timestamp, uuid: r.uuid, model,
            });
            session.messageCount++;
          } else if (part.type === "tool_use") {
            const result = toolResults[part.id];
            nodes.push({
              id: mkId(),
              kind: "tool-call",
              toolName: part.name || "Tool",
              input: part.input || {},
              result: result ? extractToolResultText(result) : null,
              isError: !!(result && result.is_error),
              resultMeta: result ? extractToolResultMeta(result) : null,
              timestamp: r.timestamp, uuid: r.uuid, model,
            });
            session.toolCount++;
          }
        }
      }
    }

    // De-dupe identical adjacent assistant messages (the JSONL sometimes has
    // the same assistant message split across two records — once for thinking,
    // once for tool_use — with identical content arrays).
    const dedup = [];
    const seenUuid = new Set();
    for (const n of nodes) {
      const key = `${n.uuid}:${n.kind}:${n.toolName || ""}:${(n.text || "").slice(0, 40)}`;
      if (seenUuid.has(key)) continue;
      seenUuid.add(key);
      dedup.push(n);
    }

    return { nodes: dedup, session };
  }

  function extractToolResultText(part) {
    if (!part) return "";
    if (typeof part.content === "string") return part.content;
    if (Array.isArray(part.content)) {
      return part.content.map(c => {
        if (!c) return "";
        if (c.type === "text") return c.text || "";
        if (c.type === "tool_reference") return `→ ${c.tool_name}`;
        if (c.type === "image") return "[image]";
        return JSON.stringify(c);
      }).join("\n");
    }
    return "";
  }

  function extractToolResultMeta(part) {
    // Try to pull a useful one-line summary from the structured result.
    const r = part && part.toolUseResult;
    if (!r) return null;
    if (typeof r === "string") return r.split("\n")[0].slice(0, 120);
    if (r.stdout) return r.stdout.split("\n")[0].slice(0, 120);
    if (typeof r.bytes === "number") return `${formatBytes(r.bytes)}${r.code ? ` · ${r.code}` : ""}`;
    if (Array.isArray(r.matches)) return `${r.matches.length} match${r.matches.length === 1 ? "" : "es"}`;
    return null;
  }

  function formatBytes(n) {
    if (n < 1024) return n + " B";
    if (n < 1024 * 1024) return (n / 1024).toFixed(1) + " KB";
    return (n / 1024 / 1024).toFixed(1) + " MB";
  }

  // ────────────────────────────────────────────────────────────────────────
  //  TOOL CALL SUMMARIZER (collapsed-state label)
  // ────────────────────────────────────────────────────────────────────────

  function summarizeToolCall(node) {
    const name = node.toolName;
    const i = node.input || {};
    switch (name) {
      case "Bash":
        return { verb: "Run", target: i.description || truncate(i.command || "", 80), mono: true };
      case "Read":
        return { verb: "Read", target: shortPath(i.file_path || i.path || "") };
      case "Write":
        return { verb: "Write", target: shortPath(i.file_path || i.path || "") };
      case "Edit":
      case "MultiEdit":
        return { verb: "Edit", target: shortPath(i.file_path || i.path || "") };
      case "Glob":
        return { verb: "Glob", target: i.pattern || "" , mono: true};
      case "Grep":
        return { verb: "Grep", target: `“${truncate(i.pattern || "", 60)}”${i.path ? ` in ${shortPath(i.path)}` : ""}`, mono: true };
      case "WebFetch":
        return { verb: "Fetch", target: shortUrl(i.url || "") };
      case "WebSearch":
        return { verb: "Search web", target: `“${truncate(i.query || "", 60)}”` };
      case "TodoWrite": {
        const todos = i.todos || [];
        return { verb: "Update todos", target: `${todos.length} item${todos.length === 1 ? "" : "s"}` };
      }
      case "Task":
        return { verb: "Subagent", target: i.description || i.subagent_type || "" };
      case "ToolSearch":
        return { verb: "Search tools", target: `“${truncate(i.query || "", 60)}”` };
      case "NotebookEdit":
        return { verb: "Edit notebook", target: shortPath(i.notebook_path || "") };
      case "AskUserQuestion":
        return { verb: "Ask user", target: truncate((i.questions && i.questions[0] && i.questions[0].question) || "", 80) };
      case "ExitPlanMode":
        return { verb: "Exit plan mode", target: "" };
      case "EnterPlanMode":
        return { verb: "Enter plan mode", target: "" };
      default: {
        // Generic: pick the first string-valued key
        let target = "";
        for (const k of Object.keys(i)) {
          const v = i[k];
          if (typeof v === "string") { target = truncate(v, 80); break; }
          if (typeof v === "number") { target = String(v); break; }
        }
        return { verb: humanizeToolName(name), target };
      }
    }
  }

  function humanizeToolName(name) {
    if (!name) return "Tool";
    // mcp__server__action → "action"
    const mcp = name.match(/^mcp__[^_]+__(.+)$/);
    if (mcp) return mcp[1].replace(/[-_]/g, " ");
    return name;
  }

  function shortPath(p) {
    if (!p) return "";
    return p.replace(/^.*\/(?=[^/]+\/[^/]+$)/, ".../");
  }

  function shortUrl(u) {
    try {
      const parsed = new URL(u);
      return parsed.host + truncate(parsed.pathname, 40);
    } catch { return truncate(u, 60); }
  }

  function truncate(s, n) {
    if (!s) return "";
    s = String(s).replace(/\s+/g, " ").trim();
    return s.length > n ? s.slice(0, n - 1) + "…" : s;
  }

  // ────────────────────────────────────────────────────────────────────────
  //  DEFAULT COLLAPSE RULES (regex / type driven, per user spec)
  // ────────────────────────────────────────────────────────────────────────

  function defaultCollapsed(node) {
    if (node.kind === "tool-call") return true;
    if (node.kind === "thinking") return true;
    // Long file contents are inside tool-call results (already collapsed). Nothing to do here.
    return false;
  }

  function isShortAck(node) {
    if (node.kind !== "user-prompt") return false;
    const t = (node.text || "").trim();
    return t.length < 24 && /^(ok|okay|continue|go|yes|y|thanks|thx|good|next|do it|proceed)\.?!?$/i.test(t);
  }

  // ────────────────────────────────────────────────────────────────────────
  //  EXPORT
  // ────────────────────────────────────────────────────────────────────────

  window.SessionParser = {
    parseSessionJSONL,
    summarizeToolCall,
    defaultCollapsed,
    isShortAck,
    truncate,
    shortPath,
  };
})();
