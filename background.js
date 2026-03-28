const HOST_NAME = 'com.printwise.native_host';

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'processContent') {
    handleProcessContent(message.data).then(sendResponse);
    return true; // Keep message channel open for async response
  }
});

async function handleProcessContent(data) {
  return new Promise((resolve) => {
    chrome.runtime.sendNativeMessage(HOST_NAME, data, (response) => {
      if (chrome.runtime.lastError) {
        const msg = chrome.runtime.lastError.message || '';
        if (msg.includes('not found') || msg.includes('Specified native messaging host not found')) {
          resolve({
            error: 'Native host not installed. Run native-host/install.sh first.',
          });
        } else {
          resolve({ error: msg });
        }
        return;
      }
      resolve(response || { error: 'Empty response from native host' });
    });
  });
}
