import { PageData, PageType, AppSettings } from '../types';

// Declare chrome type for TypeScript environment
declare const chrome: any;

// Helper to map Notion API response to our PageData interface
const mapNotionResultToPage = (item: any): PageData => {
  let title = "Sem Título";
  
  if (item.properties) {
    const titleKey = Object.keys(item.properties).find(key => item.properties[key].type === 'title');
    if (titleKey && item.properties[titleKey].title && item.properties[titleKey].title.length > 0) {
      title = item.properties[titleKey].title[0].plain_text;
    }
  }
  
  if (title === "Sem Título" && item.title && Array.isArray(item.title) && item.title.length > 0) {
    title = item.title[0].plain_text;
  }
  
  if (title === "Sem Título" && item.icon?.emoji) {
      title = item.icon.emoji;
  }

  const icon = item.icon?.emoji || (item.object === 'database' ? '📊' : '📄');
  
  const tags: string[] = [];
  if (item.properties?.Tags?.multi_select && Array.isArray(item.properties.Tags.multi_select)) {
    tags.push(...item.properties.Tags.multi_select.map((t: any) => t.name));
  } else if (item.properties?.Status?.select?.name) {
    tags.push(item.properties.Status.select.name);
  }

  const propertyKeys = Object.keys(item.properties || {});
  const metaContent = propertyKeys.map(key => {
    const prop = item.properties[key];
    if (!prop) return '';

    try {
        if (prop.type === 'select' && prop.select?.name) return `${key}: ${prop.select.name}`;
        
        if (prop.type === 'multi_select' && Array.isArray(prop.multi_select)) {
            return `${key}: ${prop.multi_select.map((m: any) => m.name).join(', ')}`;
        }

        if (prop.type === 'rich_text' && Array.isArray(prop.rich_text)) {
            const text = prop.rich_text.map((t: any) => t.plain_text).join(' ');
            if (text) return `${key}: ${text}`;
        }
    } catch (e) {
        return '';
    }
    return '';
  }).filter(Boolean).join('. ');

  return {
    id: item.id,
    title: title,
    type: item.object === 'database' ? PageType.DATABASE : PageType.PAGE,
    lastEdited: item.last_edited_time,
    url: item.url,
    content: metaContent,
    tags: tags,
    icon: icon
  };
};

// Helper for PostMessage communication from Sandbox to Parent
const sendSandboxMessage = (message: any): Promise<any> => {
    return new Promise((resolve, reject) => {
        const requestId = Math.random().toString(36).substring(7);
        
        const handler = (event: MessageEvent) => {
            if (event.data && event.data.requestId === requestId) {
                window.removeEventListener('message', handler);
                if (event.data.success) {
                    resolve(event.data.data);
                } else {
                    reject(new Error(event.data.error));
                }
            }
        };
        
        window.addEventListener('message', handler);
        window.parent.postMessage({ ...message, requestId }, '*');
        
        // Timeout safety
        setTimeout(() => {
            window.removeEventListener('message', handler);
            reject(new Error("Timeout waiting for background response"));
        }, 10000);
    });
};

export const fetchNotionSearch = async (settings: AppSettings, query: string = ''): Promise<PageData[]> => {
  if (!settings.notionToken) {
    throw new Error("Token do Notion não configurado.");
  }

  // Detect environment
  const isExtensionContext = typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage;
  // If we are in an iframe (Sandbox), window.parent is different from window
  const isSandbox = window.parent !== window;

  try {
    let rawData;

    if (isSandbox) {
        // We are in the Sandboxed Iframe -> Talk to popup.js (parent)
        rawData = await sendSandboxMessage({ 
            type: 'NOTION_SEARCH', 
            payload: { token: settings.notionToken, query } 
        });
    } else if (isExtensionContext) {
        // We are in a normal extension page (unlikely with this architecture, but fallback)
        rawData = await new Promise((resolve, reject) => {
            chrome.runtime.sendMessage(
                { type: 'NOTION_SEARCH', payload: { token: settings.notionToken, query } },
                (response: any) => {
                    if (chrome.runtime.lastError) return reject(new Error("Erro extensão"));
                    if (response?.success) resolve(response.data);
                    else reject(new Error(response?.error));
                }
            );
        });
    } else {
      // Fallback: Web Dev Mode
      const endpoint = 'https://api.notion.com/v1/search';
      let url = settings.corsProxy ? `${settings.corsProxy}${endpoint}` : `https://corsproxy.io/?${encodeURIComponent(endpoint)}`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${settings.notionToken}`,
          'Notion-Version': '2022-06-28',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          query: query,
          sort: { direction: 'descending', timestamp: 'last_edited_time' },
          page_size: 20
        })
      });

      if (!response.ok) throw new Error("Erro ao buscar dados (Web Mode)");
      rawData = await response.json();
    }

    if (!rawData || !rawData.results) return [];
    
    return rawData.results.map((item: any) => {
        try { return mapNotionResultToPage(item); } catch (e) { return null; }
    }).filter((item: any) => item !== null) as PageData[];

  } catch (error: any) {
    console.error("Notion API Error:", error);
    throw error;
  }
};