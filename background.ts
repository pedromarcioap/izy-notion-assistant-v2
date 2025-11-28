// Declare chrome type for TypeScript environment
declare const chrome: any;

// Listen for messages from the Popup (React App)
chrome.runtime.onMessage.addListener((request: any, sender: any, sendResponse: any) => {
  if (request.type === 'NOTION_SEARCH') {
    handleNotionSearch(request.payload)
      .then(data => sendResponse({ success: true, data }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    
    // Return true to indicate we wish to send a response asynchronously
    return true;
  }
});

async function handleNotionSearch(payload: { token: string; query: string }) {
  const { token, query } = payload;
  
  // Direct call to Notion API (Allowed because of host_permissions in manifest.json)
  const response = await fetch('https://api.notion.com/v1/search', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Notion-Version': '2022-06-28', // Updated to latest stable
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      query: query,
      sort: {
        direction: 'descending',
        timestamp: 'last_edited_time'
      },
      page_size: 20
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    // Parse error if possible to give better message
    try {
        const jsonErr = JSON.parse(errText);
        throw new Error(jsonErr.message || `Notion API Error (${response.status})`);
    } catch (e) {
        throw new Error(`Notion API Error (${response.status}): ${errText}`);
    }
  }

  const data = await response.json();
  return data;
}

// Optional: Handle installation events
chrome.runtime.onInstalled.addListener(() => {
  console.log("Izy Notion Assistant installed.");
});