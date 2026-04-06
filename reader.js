document.addEventListener('DOMContentLoaded', async () => {
  const page = document.getElementById('page');
  const sourceLink = document.getElementById('sourceLink');
  const printBtn = document.getElementById('printBtn');
  const copyBtn = document.getElementById('copyBtn');
  const saveToWikiBtn = document.getElementById('saveToWikiBtn');
  let wikiContent = null;

  try {
    const { readerData } = await chrome.storage.local.get('readerData');

    if (!readerData) {
      throw new Error('No content available');
    }

    wikiContent = {
      title: readerData.title || readerData.originalTitle || 'Untitled',
      sourceUrl: readerData.source || '',
      markdown: readerData.markdown || htmlToMarkdown(readerData.content || ''),
    };

    // Set source link
    if (readerData.source) {
      sourceLink.textContent = new URL(readerData.source).hostname;
      sourceLink.href = readerData.source;
    }

    // Build the article
    const metaParts = [];
    if (readerData.author) metaParts.push(`<span class="author">${readerData.author}</span>`);
    if (readerData.date) metaParts.push(`<span>${readerData.date}</span>`);
    if (readerData.source) {
      const domain = new URL(readerData.source).hostname.replace('www.', '');
      metaParts.push(`<span>${domain}</span>`);
    }

    const html = `
      <article>
        <header class="article-header">
          <h1 class="article-title">${escapeHtml(readerData.title || readerData.originalTitle || 'Untitled')}</h1>
          ${metaParts.length > 0 ? `<div class="article-meta">${metaParts.join('<span class="separator">·</span>')}</div>` : ''}
        </header>
        <div class="article-body" id="articleBody">
          ${readerData.content}
        </div>
        <footer class="reader-footer">
          <span>Prepared by PrintWise</span>
          <span>${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
        </footer>
      </article>
    `;

    page.innerHTML = html;

  } catch (err) {
    page.innerHTML = `
      <div class="error-view">
        <h2>Nothing to display</h2>
        <p>Use the PrintWise extension on any page to extract and format its content.</p>
      </div>
    `;
  }

  // Print button
  printBtn.addEventListener('click', () => {
    window.print();
  });

  // Copy button
  copyBtn.addEventListener('click', async () => {
    const body = document.getElementById('articleBody');
    if (body) {
      try {
        await navigator.clipboard.writeText(body.innerText);
        copyBtn.innerHTML = `
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg>
          Copied
        `;
        setTimeout(() => {
          copyBtn.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
            Copy
          `;
        }, 1500);
      } catch {}
    }
  });

  saveToWikiBtn.addEventListener('click', async () => {
    const originalMarkup = saveToWikiBtn.innerHTML;

    try {
      if (!wikiContent?.markdown || !wikiContent?.sourceUrl) {
        throw new Error('No extracted content available to save');
      }

      const {
        fragmentd_url: fragmentdUrl = 'http://127.0.0.1:7331',
        fragmentd_token: fragmentdToken = '',
        wiki_vault_path: wikiVaultPath = '/home/server_lama/obsidian-vault',
      } = await chrome.storage.local.get([
        'fragmentd_url',
        'fragmentd_token',
        'wiki_vault_path',
      ]);

      if (!fragmentdToken) {
        throw new Error('fragmentd token not configured in PrintWise settings');
      }

      saveToWikiBtn.disabled = true;
      saveToWikiBtn.textContent = 'Saving...';

      const response = await fetch(`${fragmentdUrl.replace(/\/$/, '')}/v1/ingest/clipping`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Fragmentd-Token': fragmentdToken,
        },
        body: JSON.stringify({
          title: wikiContent.title,
          source_url: wikiContent.sourceUrl,
          content: wikiContent.markdown,
          vault_path: wikiVaultPath,
        }),
      });

      if (!response.ok) {
        let message = `Server returned ${response.status}`;
        try {
          const errorPayload = await response.json();
          if (errorPayload?.detail) {
            message = typeof errorPayload.detail === 'string'
              ? errorPayload.detail
              : JSON.stringify(errorPayload.detail);
          }
        } catch {}
        throw new Error(message);
      }

      saveToWikiBtn.textContent = 'Saved';
      setTimeout(() => {
        saveToWikiBtn.disabled = false;
        saveToWikiBtn.innerHTML = originalMarkup;
      }, 2000);
    } catch (err) {
      console.error('Wiki save failed:', err);
      saveToWikiBtn.textContent = 'Failed';
      setTimeout(() => {
        saveToWikiBtn.disabled = false;
        saveToWikiBtn.innerHTML = originalMarkup;
      }, 2500);
    }
  });

  // Keyboard shortcut
  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'p') {
      e.preventDefault();
      window.print();
    }
  });
});

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function htmlToMarkdown(html) {
  const container = document.createElement('div');
  container.innerHTML = html;
  const markdown = Array.from(container.childNodes)
    .map((node) => blockNodeToMarkdown(node))
    .join('\n\n');

  return markdown.replace(/\n{3,}/g, '\n\n').trim();
}

function blockNodeToMarkdown(node) {
  if (node.nodeType === Node.TEXT_NODE) {
    return normalizeWhitespace(node.textContent || '');
  }

  if (node.nodeType !== Node.ELEMENT_NODE) {
    return '';
  }

  const tag = node.tagName.toLowerCase();

  if (tag === 'h1') return `# ${inlineChildrenToMarkdown(node)}`;
  if (tag === 'h2') return `## ${inlineChildrenToMarkdown(node)}`;
  if (tag === 'h3') return `### ${inlineChildrenToMarkdown(node)}`;
  if (tag === 'p') return inlineChildrenToMarkdown(node);
  if (tag === 'blockquote') {
    return Array.from(node.childNodes)
      .map((child) => blockNodeToMarkdown(child) || inlineNodeToMarkdown(child))
      .filter(Boolean)
      .join('\n')
      .split('\n')
      .map((line) => `> ${line}`)
      .join('\n');
  }
  if (tag === 'ul') return listToMarkdown(node, '-');
  if (tag === 'ol') return listToMarkdown(node, '1.');
  if (tag === 'hr') return '---';
  if (tag === 'figure') {
    return Array.from(node.childNodes)
      .map((child) => blockNodeToMarkdown(child) || inlineNodeToMarkdown(child))
      .filter(Boolean)
      .join('\n\n');
  }
  if (tag === 'figcaption') return `_${inlineChildrenToMarkdown(node)}_`;

  return inlineChildrenToMarkdown(node);
}

function listToMarkdown(listNode, marker) {
  const items = Array.from(listNode.children)
    .filter((child) => child.tagName && child.tagName.toLowerCase() === 'li')
    .map((child, index) => {
      const prefix = marker === '1.' ? `${index + 1}.` : marker;
      return `${prefix} ${inlineChildrenToMarkdown(child)}`;
    });

  return items.join('\n');
}

function inlineChildrenToMarkdown(node) {
  return Array.from(node.childNodes)
    .map((child) => inlineNodeToMarkdown(child))
    .join('')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

function inlineNodeToMarkdown(node) {
  if (node.nodeType === Node.TEXT_NODE) {
    return normalizeWhitespace(node.textContent || '');
  }

  if (node.nodeType !== Node.ELEMENT_NODE) {
    return '';
  }

  const tag = node.tagName.toLowerCase();
  const text = Array.from(node.childNodes).map((child) => inlineNodeToMarkdown(child)).join('');

  if (tag === 'strong' || tag === 'b') return `**${text.trim()}**`;
  if (tag === 'em' || tag === 'i') return `*${text.trim()}*`;
  if (tag === 'a') {
    const href = node.getAttribute('href') || '';
    return href ? `[${text.trim() || href}](${href})` : text;
  }
  if (tag === 'br') return '\n';

  return text;
}

function normalizeWhitespace(text) {
  return text.replace(/\s+/g, ' ');
}
