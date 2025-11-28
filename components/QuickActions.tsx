import React from 'react';
import { Plus, Search, Mic, Star } from 'lucide-react';

interface QuickActionsProps {
  onAction: (action: string) => void;
}

export const QuickActions: React.FC<QuickActionsProps> = ({ onAction }) => {
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
