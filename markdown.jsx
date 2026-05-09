// ---------------------------------------------------------------------------
// markdown.jsx — minimal safe markdown renderer for comments + assistant text
// Returns DOM strings (escaped) with: links, **bold**, *italic*, `code`,
// ```fenced```, headings, lists, blockquotes, paragraphs.
// Exposed as window.renderMarkdown(text)
// ---------------------------------------------------------------------------

(function () {
  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function inline(s) {
    let out = escapeHtml(s);
    // code spans (do first, then protect)
    const codeSpans = [];
    out = out.replace(/`([^`\n]+)`/g, (_, c) => {
      codeSpans.push(c);
      return `\u0000CODE${codeSpans.length - 1}\u0000`;
    });
    // bold + italic
    out = out.replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>");
    out = out.replace(/(^|[\s(])\*([^*\n]+)\*/g, "$1<em>$2</em>");
    out = out.replace(/(^|[\s(])_([^_\n]+)_/g, "$1<em>$2</em>");
    // links [text](url)
    out = out.replace(
      /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
      (_, t, u) => `<a href="${u}" target="_blank" rel="noopener noreferrer">${t}</a>`
    );
    // bare urls
    out = out.replace(
      /(^|[\s(])(https?:\/\/[^\s<)]+[^\s<).,;:!?])/g,
      (_, p, u) => `${p}<a href="${u}" target="_blank" rel="noopener noreferrer">${u}</a>`
    );
    // restore code spans
    out = out.replace(/\u0000CODE(\d+)\u0000/g, (_, i) => `<code>${escapeHtml(codeSpans[+i])}</code>`);
    return out;
  }

  function renderMarkdown(text) {
    if (!text) return "";
    const lines = String(text).replace(/\r\n/g, "\n").split("\n");
    const blocks = [];
    let i = 0;
    while (i < lines.length) {
      const line = lines[i];
      // fenced code
      const fence = line.match(/^```(\w*)\s*$/);
      if (fence) {
        const lang = fence[1] || "";
        const buf = [];
        i++;
        while (i < lines.length && !/^```\s*$/.test(lines[i])) {
          buf.push(lines[i]); i++;
        }
        i++; // skip closing fence
        blocks.push(`<pre class="md-pre"${lang ? ` data-lang="${lang}"` : ""}><code>${escapeHtml(buf.join("\n"))}</code></pre>`);
        continue;
      }
      // headings
      const h = line.match(/^(#{1,4})\s+(.+)$/);
      if (h) {
        blocks.push(`<h${h[1].length} class="md-h">${inline(h[2])}</h${h[1].length}>`);
        i++; continue;
      }
      // list
      if (/^\s*[-*]\s+/.test(line)) {
        const items = [];
        while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
          items.push(`<li>${inline(lines[i].replace(/^\s*[-*]\s+/, ""))}</li>`);
          i++;
        }
        blocks.push(`<ul class="md-ul">${items.join("")}</ul>`);
        continue;
      }
      // ordered list
      if (/^\s*\d+\.\s+/.test(line)) {
        const items = [];
        while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
          items.push(`<li>${inline(lines[i].replace(/^\s*\d+\.\s+/, ""))}</li>`);
          i++;
        }
        blocks.push(`<ol class="md-ol">${items.join("")}</ol>`);
        continue;
      }
      // blockquote
      if (/^>\s?/.test(line)) {
        const buf = [];
        while (i < lines.length && /^>\s?/.test(lines[i])) {
          buf.push(lines[i].replace(/^>\s?/, ""));
          i++;
        }
        blocks.push(`<blockquote class="md-q">${inline(buf.join(" "))}</blockquote>`);
        continue;
      }
      // blank → paragraph break
      if (!line.trim()) { i++; continue; }
      // paragraph (consume until blank or block-level start)
      const buf = [];
      while (
        i < lines.length &&
        lines[i].trim() &&
        !/^(```|#{1,4}\s|>\s?|\s*[-*]\s+|\s*\d+\.\s+)/.test(lines[i])
      ) {
        buf.push(lines[i]); i++;
      }
      blocks.push(`<p class="md-p">${inline(buf.join(" "))}</p>`);
    }
    return blocks.join("");
  }

  window.renderMarkdown = renderMarkdown;
})();
