import React from 'react';
import { Activity, Book, Search, Terminal } from 'lucide-react';

interface SidebarProps {
  title: string;
  namespaces: Record<string, { name: string; events: Record<string, any> }>;
  selectedNamespace: string;
  onSelectNamespace: (ns: string) => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  activeTab: 'docs' | 'playground';
  setActiveTab: (tab: 'docs' | 'playground') => void;
  theme: 'dark' | 'light';
}

export const Sidebar: React.FC<SidebarProps> = ({
  title,
  namespaces,
  selectedNamespace,
  onSelectNamespace,
  searchQuery,
  setSearchQuery,
  activeTab,
  setActiveTab,
  theme,
}) => {
  const filteredNamespaces = Object.keys(namespaces).filter((ns) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    if (ns.toLowerCase().includes(q)) return true;
    const nsObj = namespaces[ns];
    if (!nsObj?.events) return false;
    return Object.entries(nsObj.events).some(([name, event]: [string, any]) => {
      return (
        name.toLowerCase().includes(q) ||
        (event.summary && event.summary.toLowerCase().includes(q)) ||
        (event.description && event.description.toLowerCase().includes(q)) ||
        (event.tags && event.tags.some((t: string) => t.toLowerCase().includes(q)))
      );
    });
  });

  return (
    <aside
      className={`w-64 border-r transition-colors duration-300 ${
        theme === 'dark' ? 'border-slate-800 bg-slate-900/50' : 'border-slate-200 bg-white'
      } backdrop-blur-xl flex flex-col`}
    >
      <div className="p-6 flex-1 flex flex-col">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <Activity size={20} className="text-white" />
          </div>
          <div>
            <h1 className={`font-bold text-lg tracking-tight ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
              {title || 'SocketDocs'}
            </h1>
          </div>
        </div>

        <nav className="space-y-1 mb-6">
          <button
            onClick={() => setActiveTab('docs')}
            className={`w-full flex items-center gap-3 px-4 py-2 rounded-lg transition-colors text-sm ${
              activeTab === 'docs'
                ? theme === 'dark'
                  ? 'bg-blue-600/10 text-blue-400 font-semibold'
                  : 'bg-blue-50 text-blue-600 font-semibold'
                : theme === 'dark'
                ? 'hover:bg-slate-800 text-slate-400'
                : 'hover:bg-slate-100 text-slate-600'
            }`}
          >
            <Book size={18} />
            <span>Documentation</span>
          </button>
          <button
            onClick={() => setActiveTab('playground')}
            className={`w-full flex items-center gap-3 px-4 py-2 rounded-lg transition-colors text-sm ${
              activeTab === 'playground'
                ? theme === 'dark'
                  ? 'bg-blue-600/10 text-blue-400 font-semibold'
                  : 'bg-blue-50 text-blue-600 font-semibold'
                : theme === 'dark'
                ? 'hover:bg-slate-800 text-slate-400'
                : 'hover:bg-slate-100 text-slate-600'
            }`}
          >
            <Terminal size={18} />
            <span>Playground</span>
          </button>
        </nav>

        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search events, tags..."
            className={`w-full border rounded-lg pl-9 pr-3 py-2 text-xs transition-colors focus:outline-none focus:border-blue-500 ${
              theme === 'dark'
                ? 'bg-slate-950/50 border-slate-800 text-slate-300'
                : 'bg-slate-100 border-slate-200 text-slate-700'
            }`}
          />
        </div>

        <div className="flex-1 overflow-y-auto">
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Namespaces</h2>
          <div className="space-y-1">
            {filteredNamespaces.map((ns) => {
              const count = Object.keys(namespaces[ns]?.events || {}).length;
              return (
                <button
                  key={ns}
                  onClick={() => onSelectNamespace(ns)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-colors flex items-center justify-between ${
                    selectedNamespace === ns
                      ? theme === 'dark'
                        ? 'bg-slate-800 text-white font-medium'
                        : 'bg-slate-100 text-slate-900 font-semibold'
                      : theme === 'dark'
                      ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                      : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <span className="truncate">{ns}</span>
                  <span className="text-[10px] text-slate-500 bg-slate-800/30 px-1.5 py-0.5 rounded">
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </aside>
  );
};
