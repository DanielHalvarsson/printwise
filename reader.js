document.addEventListener('DOMContentLoaded', async () => {
  const page = document.getElementById('page');
  const loadingView = document.getElementById('loadingView');
  const sourceLink = document.getElementById('sourceLink');
  const printBtn = document.getElementById('printBtn');
  const copyBtn = document.getElementById('copyBtn');

  try {
    const { readerData } = await chrome.storage.local.get('readerData');

    if (!readerData) {
      throw new Error('No content available');
    }

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
