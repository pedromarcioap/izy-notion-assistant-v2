import { PageData, PageType, AppSettings } from '../types';

// Declare chrome type for TypeScript environment
declare const chrome: any;

// Helper to map Notion API response to our PageData interface
const mapNotionResultToPage = (item: any): PageData => {
  // Robust Title Extraction:
  // 1. Try to find a property of type "title" in properties
  // 2. Fallback to direct title array (common in database objects)
  // 3. Fallback to icon
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
  
  // Extract tags if available
  const tags: string[] = [];
  if (item.properties?.Tags?.multi_select && Array.isArray(item.properties.Tags.multi_select)) {
    tags.push(...item.properties.Tags.multi_select.map((t: any) => t.name));
  } else if (item.properties?.Status?.select?.name) {
    tags.push(item.properties.Status.select.name);
  }

  // Construct a pseudo-content string from properties for the AI to analyze
  const propertyKeys = Object.keys(item.properties || {});
  const metaContent = propertyKeys.map(key => {
    const prop = item.properties[key];
    if (!prop) return '';

    try {
        if (prop.type === 'select' && prop.select?.name) return `${key}: ${prop.select.name}`;
        
        // Fix: Check isArray before mapping because Databases return schema object, not value array
        if (prop.type === 'multi_select' && Array.isArray(prop.multi_select)) {
            return `${key}: ${prop.multi_select.map((m: any) => m.name).join(', ')}`;
        }

        // Add Rich Text content for better AI context
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

export const fetchNotionSearch = async (settings: AppSettings, query: string = ''): Promise<PageData[]> => {
  if (!settings.notionToken) {
    throw new Error("Token do Notion não configurado.");
  }

  // CHECK: Are we running as a Chrome Extension?
  // Robust check: chrome must be defined, runtime must be defined, and id must be present (indicating extension context)
  const isExtension = typeof chrome !== 'undefined' && 
                      chrome.runtime && 
                      chrome.runtime.sendMessage && 
                      chrome.runtime.id;

  try {
    let rawData;

    if (isExtension) {
      // METHOD A: Extension Message Passing (No CORS Proxy needed)
      // We ask background.js to do the fetch
      rawData = await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(
          { 
            type: 'NOTION_SEARCH', 
            payload: { token: settings.notionToken, query } 
          },
          (response: any) => {
            if (chrome.runtime.lastError) {
              // Usually implies extension context is invalidated or message failed
              console.warn("Extension message failed, falling back to web fetch:", chrome.runtime.lastError);
              reject(new Error("Erro de comunicação com a extensão."));
              return;
            }
            if (response && response.success) {
              resolve(response.data);
            } else {
              reject(new Error(response?.error || "Erro desconhecido na extensão."));
            }
          }
        );
      });

    } else {
      // METHOD B: Web Browser Fallback (Requires Proxy)
      const endpoint = 'https://api.notion.com/v1/search';
      
      // If user provided a proxy, use it. Otherwise, fallback to a public one for development/demo.
      // Direct calls to api.notion.com from browser will ALWAYS fail CORS.
      let url = endpoint;
      if (settings.corsProxy) {
        url = `${settings.corsProxy}${endpoint}`;
      } else {
        // Fallback Proxy for demo purposes to prevent "Failed to fetch" immediately
        url = `https://corsproxy.io/?${encodeURIComponent(endpoint)}`;
      }

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${settings.notionToken}`,
          'Notion-Version': '2022-06-28', // Latest stable version
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
        const errText = await response.text().catch(() => '');
        if (response.status === 401) throw new Error("Token inválido. Verifique suas credenciais.");
        if (response.status === 403) throw new Error("Acesso negado. Verifique se a integração foi adicionada à página.");
        if (response.status === 0 || response.status === 400 && errText.includes("CORS")) {
             throw new Error("Bloqueio de CORS detectado. Use a extensão oficial ou configure um proxy.");
        }
        throw new Error(`Erro API (${response.status}): ${errText}`);
      }
      rawData = await response.json();
    }

    // Process results
    if (!rawData || !rawData.results) return [];
    
    // Safely map results, filtering out any that fail mapping
    return rawData.results.map((item: any) => {
        try {
            return mapNotionResultToPage(item);
        } catch (e) {
            console.warn("Failed to map item:", item.id, e);
            return null;
        }
    }).filter((item: any) => item !== null) as PageData[];

  } catch (error: any) {
    console.error("Notion API Error:", error);
    // Nice error message formatting
    if (error.name === 'TypeError' && error.message === 'Failed to fetch') {
      throw new Error("Falha na conexão. Verifique sua internet ou configurações de Proxy.");
    }
    throw error;
  }
};