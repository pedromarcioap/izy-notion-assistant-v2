import React, { useState, useEffect } from 'react';
import { Search, Sparkles, Loader2, ArrowRight, AlertCircle } from 'lucide-react';
import { PageData, AppSettings } from '../types.ts';
import { PageList } from './PageList.tsx';
import { askGeminiAboutData as apiAsk } from '../services/geminiService.ts';
import { fetchNotionSearch } from '../services/notionService.ts';
import { getSettings } from '../services/storage.ts';

export const AISearch: React.FC = () => {
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<'FILTER' | 'AI'>('FILTER');
  const [loading, setLoading] = useState(false);
  const [aiResponse, setAiResponse] = useState<string | null>(null);
  const [results, setResults] = useState<PageData[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [debouncedQuery, setDebouncedQuery] = useState(query);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 500);
    return () => clearTimeout(timer);
  }, [query]);

  // Execute Notion Search
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
        // Notion API search logic
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
    setMode('AI');
    setLoading(true);
    setAiResponse(null);
    setError(null);
    
    try {
      // Use the currently fetched results as context for the AI
      // If result set is small, we might want to fetch more or use the existing list
      if (results.length === 0) {
          setAiResponse("Não encontrei documentos na busca atual para analisar.");
      } else {
          const response = await apiAsk(query, results);
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
            else if (e.key === 'Enter') {
                // Trigger immediate search if needed, though effect handles it
            }
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