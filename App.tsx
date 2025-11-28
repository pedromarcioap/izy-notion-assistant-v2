import React, { useState, useEffect } from 'react';
import { TabView, PageData, DEFAULT_SETTINGS } from './types.ts';
import { QuickActions } from './components/QuickActions.tsx';
import { PageList } from './components/PageList.tsx';
import { AISearch } from './components/AISearch.tsx';
import { SettingsView } from './components/SettingsView.tsx';
import { Home, Search, PenTool, Layout, Settings, Loader2, RefreshCcw } from 'lucide-react';
import { getSettings, isPageFavorite } from './services/storage.ts';
import { fetchNotionSearch } from './services/notionService.ts';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<TabView>(TabView.DASHBOARD);
  const [favorites, setFavorites] = useState<PageData[]>([]);
  const [recent, setRecent] = useState<PageData[]>([]);
  const [loading, setLoading] = useState(false);
  const [userName, setUserName] = useState('User');
  const [hasToken, setHasToken] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Load Data
  useEffect(() => {
    const loadData = async () => {
      const settings = getSettings();
      setUserName(settings.userName || 'User');
      
      if (!settings.notionToken) {
        setHasToken(false);
        if (currentView === TabView.DASHBOARD) {
            // Optional: Redirect to settings or show prompt
        }
        return;
      }

      setHasToken(true);
      setLoading(true);

      try {
        const allPages = await fetchNotionSearch(settings, '');
        
        // Filter Favorites based on LocalStorage IDs
        const favPages = allPages.filter(p => isPageFavorite(p.id));
        setFavorites(favPages);
        
        // Recent is just the raw list (API returns sorted by last edited)
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
        
        {/* Header */}
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

        {/* Main Content Area */}
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
                  <p className="text-slate-400 text-sm mb-4">Configure seu token de integração para ver seus dados.</p>
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
                     <div className="flex justify-center py-10">
                        <Loader2 className="animate-spin text-blue-500" />
                     </div>
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
                placeholder="Digite sua ideia aqui... (Iremos salvar localmente por enquanto)"
                onChange={(e) => localStorage.setItem('izy_draft_note', e.target.value)}
                defaultValue={localStorage.getItem('izy_draft_note') || ""}
              />
              <div className="mt-2 flex justify-between items-center">
                 <span className="text-[10px] text-slate-600">Salvo no armazenamento local</span>
                 <button 
                   onClick={() => window.open('https://notion.new', '_blank')}
                   className="text-xs text-blue-400 hover:text-blue-300 font-medium"
                 >
                   Criar página no Notion
                 </button>
              </div>
            </div>
          )}

          {currentView === TabView.SETTINGS && (
            <SettingsView onSave={() => {
                setRefreshTrigger(p => p + 1);
                setCurrentView(TabView.DASHBOARD);
            }} />
          )}
        </main>

        {/* Bottom Navigation */}
        <nav className="border-t border-slate-800 bg-slate-900/95 backdrop-blur-sm grid grid-cols-3 px-2 pb-1 shrink-0">
          <NavItem view={TabView.DASHBOARD} icon={<Layout size={20} />} label="Início" />
          <NavItem view={TabView.SEARCH} icon={<Search size={20} />} label="Buscar" />
          <NavItem view={TabView.NOTES} icon={<PenTool size={20} />} label="Notas" />
        </nav>

        {/* Decorative elements */}
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-amber-500 opacity-80 z-20"></div>
    </div>
  );
};

export default App;