import { escapeHtml } from './utils.js';

function mdInline(text) {
  return text
    .replace(/`([^`]+)`/g, '<code class="md-code">$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
}

export function renderMarkdown(src) {
  // 归一化换行：\r\n 与孤立 \r 统一为 \n（GitHub 有时返回 \r\n 或混合换行）
  const normalized = String(src || '').replace(/\r\n?/g, '\n');
  const escaped = escapeHtml(normalized);
  const lines = escaped.split('\n');
  const out = [];
  let inFence = false;
  let fenceBuf = [];
  let listType = null;
  let listBuf = [];

  function flushList() {
    if (listType) {
      out.push('<' + listType + '>' + listBuf.join('') + '</' + listType + '>');
      listType = null;
      listBuf = [];
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (/^\s*```/.test(line)) {
      if (inFence) {
        out.push('<pre class="md-pre"><code>' + fenceBuf.join('\n') + '</code></pre>');
        fenceBuf = [];
        inFence = false;
      } else {
        flushList();
        inFence = true;
      }
      continue;
    }

    if (inFence) { fenceBuf.push(line); continue; }

    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      flushList();
      const level = h[1].length;
      out.push('<h' + level + '>' + mdInline(h[2]) + '</h' + level + '>');
      continue;
    }

    const ul = line.match(/^\s*[-*+]\s+(.*)$/);
    if (ul) {
      if (listType !== 'ul') { flushList(); listType = 'ul'; }
      listBuf.push('<li>' + mdInline(ul[1]) + '</li>');
      continue;
    }

    const ol = line.match(/^\s*\d+[.)]\s+(.*)$/);
    if (ol) {
      if (listType !== 'ol') { flushList(); listType = 'ol'; }
      listBuf.push('<li>' + mdInline(ol[1]) + '</li>');
      continue;
    }

    flushList();

    if (/^\s*(---+|\*\*\*+|___+)\s*$/.test(line)) { out.push('<hr>'); continue; }
    if (!line.trim()) { continue; }

    out.push('<p>' + mdInline(line) + '</p>');
  }

  flushList();
  if (inFence && fenceBuf.length) {
    out.push('<pre class="md-pre"><code>' + fenceBuf.join('\n') + '</code></pre>');
  }
  return out.join('\n');
}
