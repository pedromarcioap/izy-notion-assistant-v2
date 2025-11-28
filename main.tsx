import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { 
  Plus, Search, Mic, Star, FileText, Database, StickyNote, 
  Clock, ExternalLink, Sparkles, Loader2, ArrowRight, AlertCircle, 
  Home, PenTool, Layout, Settings, RefreshCcw, Save, Check, ShieldAlert 
} from 'lucide-react';
import { GoogleGenAI } from "@google/genai";

// --- TYPES ---

export enum PageType {
  DATABASE = 'DATABASE',
  PAGE = 'PAGE',
  NOTE = 'NOTE'
}

export interface PageData {
  id: string;
  title: string;
  type: PageType;
  lastEdited: string; // ISO String
  url: string;
  content?: string; // Content snippet or properties summary
  tags: string[];
  icon: string;
}

export enum TabView {
  DASHBOARD = 'DASHBOARD',
  SEARCH = 'SEARCH',
  NOTES = 'NOTES',
  SETTINGS = 'SETTINGS'
}

export interface AppSettings {
  notionToken: string;
  geminiApiKey: string; // Added Gemini API Key
  corsProxy: string;
  userName: string;
}

export const DEFAULT_SETTINGS: AppSettings = {
  notionToken: '',
  geminiApiKey: '',
  corsProxy: '', 
  userName: 'User'
};

// --- SERVICES: STORAGE ---

const STORAGE_KEY = 'izy_notion_settings';
const FAVORITES_KEY = 'izy_notion_favorites';

export const saveSettings = (settings: AppSettings): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch (e) {
    console.error("Error saving settings", e);
  }
};

export const getSettings = (): AppSettings => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? { ...DEFAULT_SETTINGS, ...JSON.parse(stored) } : DEFAULT_SETTINGS;
  } catch (e) {
    return DEFAULT_SETTINGS;
  }
};

export const toggleFavorite = (pageId: string): void => {
  const favs = getFavorites();
  if (favs.includes(pageId)) {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(favs.filter(id => id !== pageId)));
  } else {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify([...favs, pageId]));
  }
};

export const getFavorites = (): string[] => {
  try {
    const stored = localStorage.getItem(FAVORITES_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (e) {
    return [];
  }
};

export const isPageFavorite = (pageId: string): boolean => {
  return getFavorites().includes(pageId);
};

// --- SERVICES: NOTION ---

declare const chrome: any;

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

  const isExtensionContext = typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage;
  const isSandbox = window.parent !== window;

  try {
    let rawData;

    if (isSandbox) {
        rawData = await sendSandboxMessage({ 
            type: 'NOTION_SEARCH', 
            payload: { token: settings.notionToken, query } 
        });
    } else if (isExtensionContext) {
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

// --- SERVICES: GEMINI ---

export const askGeminiAboutData = async (query: string, contextData: PageData[], apiKey: string): Promise<string> => {
  if (!apiKey) {
      return "Por favor, configure sua chave de API do Gemini nas configurações para usar a inteligência.";
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    
    const contextString = JSON.stringify(contextData.slice(0, 15).map(p => ({
      title: p.title,
      type: p.type,
      tags: p.tags,
      meta_content: p.content,
      lastEdited: p.lastEdited
    })));

    const prompt = `
      Você é o Izy, um assistente inteligente especialista em Notion.
      
      Contexto (Documentos recentes do usuário):
      ${contextString}
      
      Pergunta do usuário: "${query}"
      
      Instruções:
      1. Responda em Português, de forma amigável.
      2. Use o contexto para responder.
      3. Se a pergunta for vaga, sugira documentos baseados no título ou data.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    return response.text || "Não consegui processar uma resposta.";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Erro ao processar com Gemini. Verifique sua chave de API.";
  }
};

// --- COMPONENT: QUICK ACTIONS ---

interface QuickActionsProps {
  onAction: (action: string) => void;
}

const QuickActions: React.FC<QuickActionsProps> = ({ onAction }) => {
  const actions = [
    { id: 'new_page', icon: <Plus size={18} />, label: 'Nova Pag', color: 'bg-blue-600 hover:bg-blue-700' },
    { id: 'search', icon: <Search size={18} />, label: 'Buscar', color: 'bg-slate-700 hover:bg-slate-600' },
    { id: 'favorites', icon: <Star size={18} />, label: 'Favoritos', color: 'bg-amber-600 hover:bg-amber-700' },
  ];

  return (
    <div className="flex gap-2 mb-6 overflow-x-auto pb-2 scrollbar-hide">
      {actions.map((action) => (
        <button
          key={action.id}
          onClick={() => onAction(action.id)}
          className={`${action.color} flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-white transition-all transform active:scale-95 shadow-lg shadow-black/20`}
        >
          {action.icon}
          <span>{action.label}</span>
        </button>
      ))}
    </div>
  );
};

// --- COMPONENT: PAGE LIST ---

interface PageListProps {
  title: string;
  pages: PageData[];
  compact?: boolean;
  onRefresh?: () => void;
}

const PageList: React.FC<PageListProps> = ({ title, pages, compact = false, onRefresh }) => {
  const getIcon = (type: PageType) => {
    switch (type) {
      case PageType.DATABASE: return <Database size={14} className="text-purple-400" />;
      case PageType.NOTE: return <StickyNote size={14} className="text-yellow-400" />;
      default: return <FileText size={14} className="text-blue-400" />;
    }
  };

  const formatDate = (isoString: string) => {
    const date = new Date(isoString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    if (diff < 1000 * 60 * 60 * 24) {
      if (diff < 1000 * 60 * 60) {
        return `${Math.floor(diff / (1000 * 60))}m atrás`;
      }
      return `${Math.floor(diff / (1000 * 60 * 60))}h atrás`;
    }
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
  };

  const handleFavorite = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    toggleFavorite(id);
    if(onRefresh) onRefresh();
  };

  if (pages.length === 0) return null;

  return (
    <div className="mb-6">
      <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 px-1">{title}</h3>
      <div className="flex flex-col gap-2">
        {pages.map((page) => {
          const isFav = isPageFavorite(page.id);
          return (
            <div 
              key={page.id} 
              onClick={() => window.open(page.url, '_blank')}
              className="group relative flex items-center gap-3 p-3 bg-slate-800/50 hover:bg-slate-800 border border-slate-700/50 hover:border-slate-600 rounded-xl transition-all cursor-pointer"
            >
              <div className="w-8 h-8 flex items-center justify-center bg-slate-700/50 rounded-lg text-lg">
                {page.icon || '📄'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-medium text-slate-100 truncate group-hover:text-blue-300 transition-colors">
                    {page.title}
                  </h4>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                  <span className="flex items-center gap-1 bg-slate-700/30 px-1.5 py-0.5 rounded">
                    {getIcon(page.type)}
                    {page.type === PageType.DATABASE ? 'DB' : 'Página'}
                  </span>
                  {!compact && (
                    <>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <Clock size={10} />
                        {formatDate(page.lastEdited)}
                      </span>
                    </>
                  )}
                </div>
              </div>
              
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button 
                  onClick={(e) => handleFavorite(e, page.id)}
                  className={`p-1.5 rounded-lg hover:bg-slate-700 ${isFav ? 'text-amber-400 opacity-100' : 'text-slate-400'}`}
                >
                  <Star size={14} fill={isFav ? "currentColor" : "none"} />
                </button>
                <ExternalLink size={14} className="text-slate-400" />
              </div>
              {isFav && compact && (
                  <div className="absolute right-2 top-2 text-amber-500 opacity-100 sm:hidden">
                      <Star size={10} fill="currentColor" />
                  </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

// --- COMPONENT: AI SEARCH ---

const AISearch: React.FC = () => {
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<'FILTER' | 'AI'>('FILTER');
  const [loading, setLoading] = useState(false);
  const [aiResponse, setAiResponse] = useState<string | null>(null);
  const [results, setResults] = useState<PageData[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [debouncedQuery, setDebouncedQuery] = useState(query);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 500);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    const performSearch = async () => {
      const settings = getSettings();
      if (!settings.notionToken) {
        setError("Token do Notion não configurado.");
        return;
      }
      
      setLoading(true);
      setError(null);
      try {
        const data = await fetchNotionSearch(settings, debouncedQuery);
        setResults(data);
      } catch (err: any) {
        setError(err.message || "Erro ao buscar no Notion.");
      } finally {
        setLoading(false);
      }
    };

    if (mode === 'FILTER') {
      performSearch();
    }
  }, [debouncedQuery, mode]);

  const handleAskAI = async () => {
    if (!query.trim()) return;
    const settings = getSettings();
    
    if(!settings.geminiApiKey) {
        setAiResponse("Configure a chave da API Gemini nas configurações.");
        setMode('AI');
        return;
    }

    setMode('AI');
    setLoading(true);
    setAiResponse(null);
    setError(null);
    
    try {
      if (results.length === 0) {
          setAiResponse("Não encontrei documentos na busca atual para analisar.");
      } else {
          const response = await askGeminiAboutData(query, results, settings.geminiApiKey);
          setAiResponse(response);
      }
    } catch (e) {
      setAiResponse("Erro ao conectar com a inteligência Izy.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="relative mb-4">
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
          {mode === 'AI' ? <Sparkles size={18} className="text-purple-400 animate-pulse" /> : <Search size={18} />}
        </div>
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (mode === 'AI' && e.target.value === '') setMode('FILTER');
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && e.ctrlKey) handleAskAI();
          }}
          placeholder={mode === 'AI' ? "Faça uma pergunta aos seus documentos..." : "Pesquise no seu Notion..."}
          className="w-full bg-slate-800 border-none outline-none ring-1 ring-slate-700 focus:ring-2 focus:ring-blue-500 rounded-xl py-3 pl-10 pr-12 text-sm text-white placeholder-slate-500 transition-all"
        />
        {query.length > 0 && mode === 'FILTER' && (
           <button 
             onClick={handleAskAI}
             className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-slate-700 hover:bg-purple-600 rounded-lg text-slate-300 hover:text-white transition-colors"
             title="Perguntar à IA (Izy)"
           >
             <Sparkles size={14} />
           </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar">
        {error && mode !== 'AI' && (
            <div className="p-4 bg-red-900/20 border border-red-800 rounded-xl text-red-200 text-sm flex gap-2 items-start">
                <AlertCircle size={16} className="mt-0.5" />
                <div>
                    <p className="font-bold">Erro de Conexão</p>
                    <p className="opacity-80">{error}</p>
                    {error.includes("CORS") && <p className="text-xs mt-2">Verifique as configurações de Proxy.</p>}
                </div>
            </div>
        )}

        {mode === 'AI' ? (
          <div className="space-y-4">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-12 text-slate-500">
                <Loader2 size={32} className="animate-spin mb-4 text-purple-500" />
                <p className="text-sm">Izy está analisando seus dados...</p>
              </div>
            ) : (
              <div className="bg-slate-800/50 border border-purple-500/30 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3 text-purple-300 text-xs font-bold uppercase tracking-wider">
                  <Sparkles size={12} />
                  Resposta Izy
                </div>
                <div className="text-sm text-slate-200 leading-relaxed whitespace-pre-line">
                  {aiResponse}
                </div>
                <button 
                  onClick={() => setMode('FILTER')}
                  className="mt-4 text-xs text-slate-500 hover:text-slate-300 flex items-center gap-1"
                >
                  <ArrowRight size={12} className="rotate-180" /> Voltar para lista
                </button>
              </div>
            )}
          </div>
        ) : (
          <>
             {loading && results.length === 0 ? (
                 <div className="flex justify-center py-8"><Loader2 className="animate-spin text-slate-600" /></div>
             ) : (
                 <PageList title={query ? "Resultados da Busca" : "Recentes no Notion"} pages={results} />
             )}
            
            {!loading && results.length === 0 && !error && (
              <div className="text-center py-10 text-slate-600">
                <p>Nenhuma página encontrada.</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

// --- COMPONENT: SETTINGS ---

const SettingsView: React.FC<{ onSave: () => void }> = ({ onSave }) => {
  const [settings, setSettings] = useState<AppSettings>(getSettings());
  const [status, setStatus] = useState<'idle' | 'saved'>('idle');

  const handleSave = () => {
    saveSettings(settings);
    setStatus('saved');
    setTimeout(() => {
      setStatus('idle');
      onSave();
    }, 1500);
  };

  return (
    <div className="p-4 animate-in fade-in slide-in-from-right-8 duration-300">
      <h2 className="text-xl font-light text-slate-100 mb-6">Configurações</h2>
      
      <div className="space-y-6">
        <div>
          <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
            Nome de Usuário
          </label>
          <input
            type="text"
            value={settings.userName}
            onChange={(e) => setSettings({...settings, userName: e.target.value})}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-sm text-white focus:ring-2 focus:ring-blue-500 outline-none"
            placeholder="Como devemos te chamar?"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
            Notion Integration Token
          </label>
          <div className="relative">
            <input
              type="password"
              value={settings.notionToken}
              onChange={(e) => setSettings({...settings, notionToken: e.target.value})}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-sm text-white focus:ring-2 focus:ring-blue-500 outline-none pr-10"
              placeholder="secret_..."
            />
            <div className="absolute right-3 top-3.5 text-slate-600 text-xs">🔒</div>
          </div>
          <p className="mt-2 text-[10px] text-slate-500">
            Acesse <a href="https://www.notion.so/my-integrations" target="_blank" className="text-blue-400 hover:underline">notion.so/my-integrations</a>.
          </p>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
            Gemini API Key
          </label>
          <div className="relative">
            <input
              type="password"
              value={settings.geminiApiKey}
              onChange={(e) => setSettings({...settings, geminiApiKey: e.target.value})}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-sm text-white focus:ring-2 focus:ring-blue-500 outline-none pr-10"
              placeholder="AIzaSy..."
            />
            <div className="absolute right-3 top-3.5 text-slate-600 text-xs">✨</div>
          </div>
          <p className="mt-2 text-[10px] text-slate-500">
            Necessário para o Izy responder perguntas. Obtenha no Google AI Studio.
          </p>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-2">
            CORS Proxy URL (Opcional)
            <ShieldAlert size={12} className="text-yellow-600" />
          </label>
          <input
            type="text"
            value={settings.corsProxy}
            onChange={(e) => setSettings({...settings, corsProxy: e.target.value})}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-sm text-slate-300 focus:ring-2 focus:ring-blue-500 outline-none font-mono"
            placeholder="https://corsproxy.io/?"
          />
        </div>

        <button
          onClick={handleSave}
          className={`w-full py-3 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 ${
            status === 'saved' 
              ? 'bg-green-600 text-white' 
              : 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-900/20'
          }`}
        >
          {status === 'saved' ? <><Check size={18} /> Salvo!</> : <><Save size={18} /> Salvar Alterações</>}
        </button>
      </div>
    </div>
  );
};

// --- MAIN APP ---

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<TabView>(TabView.DASHBOARD);
  const [favorites, setFavorites] = useState<PageData[]>([]);
  const [recent, setRecent] = useState<PageData[]>([]);
  const [loading, setLoading] = useState(false);
  const [userName, setUserName] = useState('User');
  const [hasToken, setHasToken] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    const loadData = async () => {
      const settings = getSettings();
      setUserName(settings.userName || 'User');
      
      if (!settings.notionToken) {
        setHasToken(false);
        return;
      }

      setHasToken(true);
      setLoading(true);

      try {
        const allPages = await fetchNotionSearch(settings, '');
        const favPages = allPages.filter(p => isPageFavorite(p.id));
        setFavorites(favPages);
        setRecent(allPages.slice(0, 7));
      } catch (error) {
        console.error("Failed to load dashboard data", error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [currentView, refreshTrigger]);

  const handleQuickAction = (actionId: string) => {
    if (actionId === 'search') setCurrentView(TabView.SEARCH);
    if (actionId === 'new_page') window.open('https://notion.new', '_blank');
  };

  const NavItem = ({ view, icon, label }: { view: TabView, icon: React.ReactNode, label: string }) => (
    <button
      onClick={() => setCurrentView(view)}
      className={`flex flex-col items-center justify-center gap-1 w-full py-3 transition-colors ${
        currentView === view ? 'text-blue-400' : 'text-slate-500 hover:text-slate-300'
      }`}
    >
      {icon}
      <span className="text-[10px] font-medium">{label}</span>
    </button>
  );

  return (
    <div className="w-full h-full min-h-screen bg-slate-950 flex flex-col overflow-hidden relative">
        <header className="px-6 pt-6 pb-4 bg-gradient-to-b from-slate-900 to-slate-900/95 z-10 shrink-0">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-600 to-purple-600 flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-blue-900/20">
                Izy
              </div>
              <h1 className="text-lg font-bold text-white tracking-tight">Notion Assistant</h1>
            </div>
            <div className="flex items-center gap-1">
              {hasToken && (
                <button 
                  onClick={() => setRefreshTrigger(p => p + 1)}
                  className="p-2 text-slate-500 hover:text-blue-400 transition-colors rounded-full hover:bg-slate-800"
                  title="Atualizar dados"
                >
                  <RefreshCcw size={16} className={loading ? 'animate-spin' : ''} />
                </button>
              )}
              <button 
                onClick={() => setCurrentView(TabView.SETTINGS)}
                className={`p-2 transition-colors rounded-full hover:bg-slate-800 ${currentView === TabView.SETTINGS ? 'text-blue-400' : 'text-slate-500 hover:text-slate-300'}`}
              >
                <Settings size={18} />
              </button>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto px-6 pb-4 scrollbar-hide">
          {currentView === TabView.DASHBOARD && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
              <div className="mb-6">
                <h2 className="text-2xl font-light text-slate-100 mb-1">Olá, <span className="font-semibold text-blue-400">{userName}</span>.</h2>
                <p className="text-xs text-slate-500">
                   {hasToken ? "Seu Notion está sincronizado." : "Conecte seu Notion para começar."}
                </p>
              </div>

              {!hasToken ? (
                <div className="p-6 bg-slate-800/50 rounded-xl border border-dashed border-slate-700 text-center">
                  <p className="text-slate-400 text-sm mb-4">Configure seu token para ver seus dados.</p>
                  <button 
                    onClick={() => setCurrentView(TabView.SETTINGS)}
                    className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold py-2 px-4 rounded-lg"
                  >
                    Configurar Agora
                  </button>
                </div>
              ) : (
                <>
                  <QuickActions onAction={handleQuickAction} />
                  {loading ? (
                     <div className="flex justify-center py-10"><Loader2 className="animate-spin text-blue-500" /></div>
                  ) : (
                    <>
                      {favorites.length > 0 && (
                        <PageList 
                            title="Favoritos (Local)" 
                            pages={favorites} 
                            compact 
                            onRefresh={() => setRefreshTrigger(p => p + 1)} 
                        />
                      )}
                      <PageList 
                        title="Editado Recentemente" 
                        pages={recent} 
                        onRefresh={() => setRefreshTrigger(p => p + 1)}
                      />
                    </>
                  )}
                </>
              )}
            </div>
          )}

          {currentView === TabView.SEARCH && (
            <div className="h-full animate-in fade-in zoom-in-95 duration-200">
              <AISearch />
            </div>
          )}

          {currentView === TabView.NOTES && (
            <div className="h-full flex flex-col animate-in fade-in slide-in-from-right-4 duration-300">
              <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3">Rascunho Rápido</h3>
              <textarea 
                className="flex-1 bg-slate-800/50 border border-slate-700 rounded-xl p-4 text-sm text-slate-200 resize-none focus:outline-none focus:ring-2 focus:ring-yellow-500/50 placeholder-slate-600"
                placeholder="Digite sua ideia aqui..."
                onChange={(e) => localStorage.setItem('izy_draft_note', e.target.value)}
                defaultValue={localStorage.getItem('izy_draft_note') || ""}
              />
            </div>
          )}

          {currentView === TabView.SETTINGS && (
            <SettingsView onSave={() => {
                setRefreshTrigger(p => p + 1);
                setCurrentView(TabView.DASHBOARD);
            }} />
          )}
        </main>

        <nav className="border-t border-slate-800 bg-slate-900/95 backdrop-blur-sm grid grid-cols-3 px-2 pb-1 shrink-0">
          <NavItem view={TabView.DASHBOARD} icon={<Layout size={20} />} label="Início" />
          <NavItem view={TabView.SEARCH} icon={<Search size={20} />} label="Buscar" />
          <NavItem view={TabView.NOTES} icon={<PenTool size={20} />} label="Notas" />
        </nav>
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-amber-500 opacity-80 z-20"></div>
    </div>
  );
};

const rootElement = document.getElementById('root');
if (rootElement) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}