import React, { useState, useEffect } from 'react';
import { Save, Check, ShieldAlert } from 'lucide-react';
import { getSettings, saveSettings } from '../services/storage.ts';
import { AppSettings } from '../types.ts';

export const SettingsView: React.FC<{ onSave: () => void }> = ({ onSave }) => {
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
            <div className="absolute right-3 top-3.5 text-slate-600 text-xs">
                🔒
            </div>
          </div>
          <p className="mt-2 text-[10px] text-slate-500">
            Crie uma integração em <a href="https://www.notion.so/my-integrations" target="_blank" className="text-blue-400 hover:underline">notion.so/my-integrations</a> e compartilhe suas páginas com ela.
          </p>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-2">
            CORS Proxy URL
            <ShieldAlert size={12} className="text-yellow-600" title="Opcional. Usado apenas se não estiver rodando como extensão." />
          </label>
          <input
            type="text"
            value={settings.corsProxy}
            onChange={(e) => setSettings({...settings, corsProxy: e.target.value})}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-sm text-slate-300 focus:ring-2 focus:ring-blue-500 outline-none font-mono"
            placeholder="https://corsproxy.io/?"
          />
          <p className="mt-2 text-[10px] text-slate-500 leading-tight">
            Se deixado em branco, usaremos um proxy público padrão para o modo Web. Na extensão instalada, isso não é necessário.
          </p>
        </div>

        <button
          onClick={handleSave}
          className={`w-full py-3 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 ${
            status === 'saved' 
              ? 'bg-green-600 text-white' 
              : 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-900/20'
          }`}
        >
          {status === 'saved' ? (
            <>
              <Check size={18} /> Salvo!
            </>
          ) : (
            <>
              <Save size={18} /> Salvar Alterações
            </>
          )}
        </button>
      </div>
    </div>
  );
};