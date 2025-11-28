// Service Worker para Izy Notion Assistant
// Gerencia chamadas de API para evitar problemas de CORS e garantir segurança

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'NOTION_SEARCH') {
    handleNotionSearch(request.payload)
      .then(data => sendResponse({ success: true, data }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    
    // Retorna true para indicar resposta assíncrona
    return true;
  }
});

async function handleNotionSearch(payload) {
  const { token, query } = payload;
  
  // Chamada direta à API do Notion (Permitida devido a host_permissions no manifest.json)
  try {
    const response = await fetch('https://api.notion.com/v1/search', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Notion-Version': '2022-06-28',
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
      try {
          const jsonErr = JSON.parse(errText);
          throw new Error(jsonErr.message || `Notion API Error (${response.status})`);
      } catch (e) {
          throw new Error(`Notion API Error (${response.status}): ${errText}`);
      }
    }

    const data = await response.json();
    return data;
  } catch (error) {
    throw error;
  }
}

// Evento de instalação (opcional)
chrome.runtime.onInstalled.addListener(() => {
  console.log("Izy Notion Assistant instalado e pronto.");
});