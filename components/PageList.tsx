import React from 'react';
import { PageData, PageType } from '../types.ts';
import { FileText, Database, StickyNote, Clock, ExternalLink, Star } from 'lucide-react';
import { isPageFavorite, toggleFavorite } from '../services/storage.ts';

interface PageListProps {
  title: string;
  pages: PageData[];
  compact?: boolean;
  onRefresh?: () => void;
}

export const PageList: React.FC<PageListProps> = ({ title, pages, compact = false, onRefresh }) => {
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
              {/* Force visible favorite if compact/already faved */}
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