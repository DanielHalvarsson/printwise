document.addEventListener('DOMContentLoaded', async () => {
  const pageTitle = document.getElementById('pageTitle');
  const extractBtn = document.getElementById('extractBtn');
  const mainStatus = document.getElementById('mainStatus');
  const fragmentdUrlInput = document.getElementById('fragmentdUrl');
  const fragmentdTokenInput = document.getElementById('fragmentdToken');
  const wikiVaultPathInput = document.getElementById('wikiVaultPath');
  const saveSettingsBtn = document.getElementById('saveSettingsBtn');
  const settingsStatus = document.getElementById('settingsStatus');

  const {
    fragmentd_url: fragmentdUrl = 'http://127.0.0.1:7331',
    fragmentd_token: fragmentdToken = '',
    wiki_vault_path: wikiVaultPath = '/home/server_lama/obsidian-vault',
  } = await chrome.storage.local.get([
    'fragmentd_url',
    'fragmentd_token',
    'wiki_vault_path',
  ]);

  fragmentdUrlInput.value = fragmentdUrl;
  fragmentdTokenInput.value = fragmentdToken;
  wikiVaultPathInput.value = wikiVaultPath;

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  pageTitle.textContent = tab?.title || 'Unknown page';

  saveSettingsBtn.addEventListener('click', async () => {
    settingsStatus.textContent = 'Saving…';
    settingsStatus.className = 'status';

    try {
      await chrome.storage.local.set({
        fragmentd_url: fragmentdUrlInput.value.trim() || 'http://127.0.0.1:7331',
        fragmentd_token: fragmentdTokenInput.value.trim(),
        wiki_vault_path: wikiVaultPathInput.value.trim() || '/home/server_lama/obsidian-vault',
      });
      settingsStatus.textContent = 'Settings saved';
    } catch (err) {
      settingsStatus.textContent = err.message || 'Failed to save settings';
      settingsStatus.className = 'status error';
    }
  });

  extractBtn.addEventListener('click', async () => {
    extractBtn.classList.add('processing');
    extractBtn.disabled = true;
    mainStatus.textContent = 'Extracting page content…';
    mainStatus.className = 'status';

    try {
      const [result] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: extractPageContent,
      });

      const pageContent = result.result;
      if (!pageContent || !pageContent.text) {
        throw new Error('Could not extract page content');
      }

      mainStatus.textContent = 'Claude is reading and cleaning…';

      const response = await chrome.runtime.sendMessage({
        action: 'processContent',
        data: {
          text: pageContent.text,
          url: pageContent.url,
          title: pageContent.title,
        },
      });

      if (response.error) {
        throw new Error(response.error);
      }

      mainStatus.textContent = 'Opening print view…';

      const readerUrl = chrome.runtime.getURL('reader.html');
      await chrome.storage.local.set({
        readerData: {
          content: response.content,
          markdown: response.markdown || '',
          title: response.title,
          author: response.author,
          date: response.date,
          source: pageContent.url,
          originalTitle: pageContent.title,
        },
      });

      chrome.tabs.create({ url: readerUrl });

    } catch (err) {
      mainStatus.textContent = err.message || 'Something went wrong';
      mainStatus.className = 'status error';
    } finally {
      extractBtn.classList.remove('processing');
      extractBtn.disabled = false;
    }
  });
});

// Runs in the context of the web page
function extractPageContent() {
  const url = window.location.href;
  const title = document.title;

  let container = document.querySelector('article')
    || document.querySelector('[role="main"]')
    || document.querySelector('main');

  if (url.includes('twitter.com') || url.includes('x.com')) {
    const tweets = document.querySelectorAll('[data-testid="tweetText"]');
    if (tweets.length > 0) {
      const tweetTexts = Array.from(tweets).map(t => t.innerText).join('\n\n---\n\n');
      const authors = document.querySelectorAll('[data-testid="User-Name"]');
      const authorName = authors.length > 0 ? authors[0].innerText.split('\n')[0] : '';
      return {
        text: `Author: ${authorName}\n\nThread:\n\n${tweetTexts}`,
        url,
        title: `Thread by ${authorName}`,
      };
    }
  }

  if (url.includes('substack.com')) {
    container = document.querySelector('.body.markup')
      || document.querySelector('.post-content')
      || container;
  }

  if (!container) {
    const selectors = [
      '.post-content', '.entry-content', '.article-content',
      '.post-body', '.story-body', '#article-body',
      '.content-body', '.article__body', '.post__content',
    ];
    for (const sel of selectors) {
      container = document.querySelector(sel);
      if (container) break;
    }
  }

  if (!container) container = document.body;

  const clone = container.cloneNode(true);

  const noiseSelectors = [
    'script', 'style', 'nav', 'footer', 'header',
    '.ad', '.ads', '.advertisement', '[class*="sidebar"]',
    '[class*="comment"]', '[class*="share"]', '[class*="social"]',
    '[class*="related"]', '[class*="newsletter"]', '[class*="subscribe"]',
    '[class*="popup"]', '[class*="modal"]', '[class*="banner"]',
    '[class*="cookie"]', '[class*="promo"]', '[class*="widget"]',
    '[role="complementary"]', '[role="banner"]', '[role="navigation"]',
    'iframe', 'form',
  ];

  noiseSelectors.forEach(sel => {
    clone.querySelectorAll(sel).forEach(el => el.remove());
  });

  const text = clone.innerText || clone.textContent || '';
  return { text: text.substring(0, 12000), url, title };
}
