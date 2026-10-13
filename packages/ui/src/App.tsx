import { useState, useEffect } from 'react';
import { Book, RefreshCw, Sun, Moon, Shield, Menu } from 'lucide-react';
import { useSocketClient } from './hooks/useSocketClient';
import { Sidebar } from './components/Sidebar';
import { EventCard } from './components/EventCard';
import { ConnectionBar } from './components/ConnectionBar';
import { EventLog } from './components/EventLog';
import { AuthorizeModal } from './components/AuthorizeModal';
import { Footer } from './components/Footer';
import type { SocketDocsSpec } from '@socketdocs/core';

export const App = () => {
  const [spec, setSpec] = useState<SocketDocsSpec | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'docs' | 'playground'>('docs');
  const [selectedNamespace, setSelectedNamespace] = useState<string>('/');
  const [searchQuery, setSearchQuery] = useState('');
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Connection URL defaults to window.location.origin
  const [socketUrl, setSocketUrl] = useState(() => {
    return typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
  });

  const {
    authConfig,
    setAuthConfig,
    isConnected,
    logs,
    clearLogs,
    connectNamespace,
    disconnectAll,
    emitEvent,
    toggleListen,
    listenedEvents,
  } = useSocketClient(socketUrl, spec?.socketPath ?? '/socket.io');

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  // Mobile drawer: Esc closes it, body scroll is locked while it is open
  useEffect(() => {
    if (!isSidebarOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsSidebarOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [isSidebarOpen]);

  const loadSpec = () => {
    setLoading(true);
    fetch('./spec.json')
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data: SocketDocsSpec) => {
        setSpec(data);
        if (data.namespaces && Object.keys(data.namespaces).length > 0) {
          const firstNs = Object.keys(data.namespaces)[0];
          setSelectedNamespace(firstNs);
        }
        if (data.servers && data.servers.length > 0 && (!socketUrl || socketUrl === 'http://localhost:3000')) {
          setSocketUrl(data.servers[0].url);
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to fetch spec:', err);
        setLoading(false);
      });
  };

  useEffect(() => {
    loadSpec();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-dvh bg-slate-900 text-white">
        <div className="animate-pulse flex flex-col items-center">
          <div className="w-12 h-12 bg-blue-500 rounded-full mb-4"></div>
          <p className="text-lg font-medium">Loading SocketDocs Spec...</p>
        </div>
      </div>
    );
  }

  if (!spec) {
    return (
      <div className="flex items-center justify-center min-h-dvh bg-slate-900 text-white">
        <div className="text-center p-8 bg-slate-800 rounded-xl shadow-xl border border-slate-700 max-w-md">
          <h1 className="text-2xl font-bold text-red-400 mb-2">Spec Not Found</h1>
          <p className="text-slate-400 text-sm mb-4">
            Ensure your documentation server is running and serves <code>./spec.json</code>.
          </p>
          <button
            onClick={loadSpec}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const namespaces = spec.namespaces || {};
  const currentNamespaceSpec = namespaces[selectedNamespace] || { name: selectedNamespace, events: {} };
  const currentEvents = currentNamespaceSpec.events || {};

  const totalEventCount = Object.values(namespaces).reduce(
    (acc, ns) => acc + Object.keys(ns.events || {}).length,
    0
  );

  const filteredEvents = Object.entries(currentEvents).filter(([name, event]: [string, any]) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      name.toLowerCase().includes(q) ||
      (event.summary && event.summary.toLowerCase().includes(q)) ||
      (event.description && event.description.toLowerCase().includes(q)) ||
      (event.tags && event.tags.some((t: string) => t.toLowerCase().includes(q)))
    );
  });

  const hasAuthorized = authConfig.type !== 'none';

  // Closing helpers: selecting a tab/namespace also closes the mobile drawer
  const selectTab = (tab: 'docs' | 'playground') => {
    setActiveTab(tab);
    setIsSidebarOpen(false);
  };
  const selectNamespace = (ns: string) => {
    setSelectedNamespace(ns);
    setIsSidebarOpen(false);
  };

  const namespaceHasEvents = Object.keys(currentEvents).length > 0;

  const emptyNamespaceState = (
    <div
      className={`text-center py-12 px-6 rounded-xl border-2 border-dashed ${
        theme === 'dark' ? 'border-slate-800 bg-slate-900/30' : 'border-slate-200 bg-slate-50'
      }`}
    >
      <Book size={40} className={`mx-auto mb-4 ${theme === 'dark' ? 'text-slate-600' : 'text-slate-300'}`} />
      <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
        No events in <code className="text-blue-400">{selectedNamespace}</code> yet. Connect a client or declare
        events with <code className="text-blue-400">docs.event()</code>.
      </p>
    </div>
  );

  return (
    <div
      className={`flex min-h-dvh w-full transition-colors duration-300 ${
        theme === 'dark' ? 'bg-slate-950 text-slate-200' : 'bg-slate-50 text-slate-900'
      }`}
    >
      <Sidebar
        title={spec.info.title}
        namespaces={namespaces}
        selectedNamespace={selectedNamespace}
        onSelectNamespace={selectNamespace}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        activeTab={activeTab}
        setActiveTab={selectTab}
        theme={theme}
        isOpen={isSidebarOpen}
      />

      {/* Backdrop for the mobile drawer (below lg) */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 backdrop-blur-sm lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      <main className="flex min-h-dvh w-full min-w-0 flex-1 flex-col">
        <header
          className={`h-16 border-b transition-colors duration-300 ${
            theme === 'dark' ? 'border-slate-800 bg-slate-900/30' : 'border-slate-200 bg-white/80'
          } backdrop-blur-md flex items-center justify-between gap-3 px-4 sm:px-8 sticky top-0 z-10`}
        >
          <div className="flex min-w-0 items-center gap-3 sm:gap-4">
            <button
              onClick={() => setIsSidebarOpen((open) => !open)}
              aria-label="Open menu"
              aria-expanded={isSidebarOpen}
              className={`flex min-h-10 min-w-10 items-center justify-center rounded-lg transition-colors lg:hidden ${
                theme === 'dark' ? 'text-slate-400 hover:text-white hover:bg-slate-800/50' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Menu size={18} />
            </button>

            <div className="flex min-w-0 items-center gap-2 text-sm sm:gap-4">
              <span className="hidden truncate text-slate-400 font-medium sm:inline">{spec.info.title}</span>
              <span className="hidden text-slate-600 sm:inline">/</span>
              <span className={`truncate font-semibold ${theme === 'dark' ? 'text-slate-200' : 'text-slate-700'}`}>
                {activeTab === 'docs' ? 'Documentation' : 'Playground'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <span className="hidden text-xs bg-slate-800/80 px-2.5 py-1 rounded-md text-slate-400 font-mono sm:inline-block">
              v{spec.info.version}
            </span>

            {/* Swagger-style Authorize button */}
            <button
              onClick={() => setIsAuthModalOpen(true)}
              aria-label={hasAuthorized ? 'Authorized' : 'Authorize'}
              className={`flex min-h-10 min-w-10 items-center justify-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold border transition-all sm:px-3 ${
                hasAuthorized
                  ? 'bg-green-500/10 text-green-400 border-green-500/30 hover:bg-green-500/20'
                  : 'bg-blue-600 hover:bg-blue-500 text-white border-blue-600'
              }`}
            >
              <Shield size={13} />
              <span className="hidden sm:inline">{hasAuthorized ? 'Authorized' : 'Authorize'}</span>
            </button>

            <button
              onClick={loadSpec}
              title="Refresh spec"
              aria-label="Refresh spec"
              className="flex min-h-10 min-w-10 items-center justify-center text-slate-400 hover:text-white transition-colors rounded-lg hover:bg-slate-800/50"
            >
              <RefreshCw size={17} className={loading ? 'animate-spin' : ''} />
            </button>

            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
              className="flex min-h-10 min-w-10 items-center justify-center text-slate-400 hover:text-white transition-colors rounded-lg hover:bg-slate-800/50"
            >
              {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
            </button>
          </div>
        </header>

        <div className="p-4 sm:p-8 mx-auto w-full max-w-5xl flex-1">
          {/* Connection Bar for Playground & Interactive calls */}
          <ConnectionBar
            socketUrl={socketUrl}
            setSocketUrl={setSocketUrl}
            serverOptions={spec.servers}
            namespaces={Object.keys(namespaces)}
            selectedNamespace={selectedNamespace}
            setSelectedNamespace={selectNamespace}
            isConnected={isConnected}
            onConnect={() => connectNamespace(selectedNamespace)}
            onDisconnect={disconnectAll}
            theme={theme}
          />

          {activeTab === 'docs' ? (
            <div className="space-y-8">
              <section className="mb-6">
                <h1 className={`text-3xl font-bold mb-2 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                  {spec.info.title}
                </h1>
                <p className={`text-base leading-relaxed ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
                  {spec.info.description || 'Socket.IO Realtime API Documentation'}
                </p>
              </section>

              {totalEventCount === 0 ? (
                <div
                  className={`text-center py-16 px-6 rounded-xl border-2 border-dashed ${
                    theme === 'dark' ? 'border-slate-800 bg-slate-900/30' : 'border-slate-200 bg-slate-50'
                  }`}
                >
                  <Book size={44} className={`mx-auto mb-4 ${theme === 'dark' ? 'text-slate-600' : 'text-slate-300'}`} />
                  <h3 className={`text-base font-semibold mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>
                    No events discovered yet
                  </h3>
                  <p className={`text-xs max-w-md mx-auto mb-6 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                    Events appear here after the first client connects to your server, or you can declare them with{' '}
                    <code className="text-blue-400">docs.event(...)</code>.
                  </p>
                  <button
                    onClick={loadSpec}
                    className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold transition-colors"
                  >
                    Refresh Spec
                  </button>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="flex items-center justify-between gap-3 border-b pb-3 border-slate-800">
                    <h2
                      className={`min-w-0 truncate text-xl font-bold ${
                        theme === 'dark' ? 'text-blue-400' : 'text-blue-600'
                      }`}
                    >
                      Namespace: <span className={theme === 'dark' ? 'text-white' : 'text-slate-900'}>{selectedNamespace}</span>
                    </h2>
                    <span className="shrink-0 text-xs text-slate-500 font-mono">
                      {filteredEvents.length} {filteredEvents.length === 1 ? 'event' : 'events'}
                    </span>
                  </div>

                  {!namespaceHasEvents ? (
                    emptyNamespaceState
                  ) : filteredEvents.length === 0 ? (
                    <div className={`text-center py-12 text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
                      No events match your search.
                    </div>
                  ) : (
                    <div className="grid gap-5">
                      {filteredEvents.map(([name, event]: [string, any]) => (
                        <EventCard
                          key={name}
                          name={name}
                          namespace={selectedNamespace}
                          event={event}
                          theme={theme}
                          isListening={listenedEvents[`${selectedNamespace}::${name}`] ?? false}
                          onToggleListen={(shouldListen) => toggleListen(selectedNamespace, name, shouldListen)}
                          onExecute={(payload, onAck) => emitEvent(selectedNamespace, name, payload, onAck)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Event Log drawer in Docs tab for convenience */}
              <div className="mt-12">
                <EventLog logs={logs} onClear={clearLogs} theme={theme} />
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <section className="mb-2">
                <h2 className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                  Socket Playground
                </h2>
                <p className={`text-xs ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                  Inspect live events, test subscriptions, and monitor payloads in real time.
                </p>
              </section>

              <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                <div className="min-w-0 space-y-4">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Interactive Events ({selectedNamespace})
                  </h3>
                  {!namespaceHasEvents ? (
                    emptyNamespaceState
                  ) : filteredEvents.length === 0 ? (
                    <div className={`text-center py-12 text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
                      No events match your search.
                    </div>
                  ) : (
                    <div className="space-y-4 max-h-[600px] overflow-y-auto pr-1">
                      {filteredEvents.map(([name, event]: [string, any]) => (
                        <EventCard
                          key={name}
                          name={name}
                          namespace={selectedNamespace}
                          event={event}
                          theme={theme}
                          isListening={listenedEvents[`${selectedNamespace}::${name}`] ?? false}
                          onToggleListen={(shouldListen) => toggleListen(selectedNamespace, name, shouldListen)}
                          onExecute={(payload, onAck) => emitEvent(selectedNamespace, name, payload, onAck)}
                        />
                      ))}
                    </div>
                  )}
                </div>

                <div className="min-w-0">
                  <EventLog logs={logs} onClear={clearLogs} theme={theme} className="h-80 xl:h-[520px]" />
                </div>
              </div>
            </div>
          )}
        </div>

        <Footer theme={theme} />
      </main>

      <AuthorizeModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        currentAuth={authConfig}
        onSaveAuth={setAuthConfig}
        theme={theme}
        securitySpecs={spec.security}
      />
    </div>
  );
};

export default App;
