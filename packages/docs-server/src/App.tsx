import { useState, useEffect, useRef } from 'react';
import { Book, Activity, Terminal, Shield, Settings, Send, Power, PowerOff, XCircle, CheckCircle2, Search, Moon, Sun } from 'lucide-react';
import { io, Socket } from 'socket.io-client';

interface Spec {
  specVersion: string;
  info: {
    name: string;
    version: string;
    description: string;
  };
  namespaces: Record<string, {
    name: string;
    events: Record<string, any>;
  }>;
}

const App = () => {
  const [spec, setSpec] = useState<Spec | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'docs' | 'playground'>('docs');
  const [selectedNamespace, setSelectedNamespace] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  // Playground state
  const [socketUrl, setSocketUrl] = useState('http://localhost:3000');
  const [authType, setAuthType] = useState<'none' | 'bearer' | 'apiKey'>('none');
  const [authToken, setAuthToken] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [logs, setLogs] = useState<{ type: 'in' | 'out' | 'info' | 'error', event: string, data: any, timestamp: number }[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<string | null>(null);
  const [payloadInput, setPayloadInput] = useState('{}');
  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  useEffect(() => {
    // In production this would fetch from the CLI served /api/spec
    fetch('http://localhost:4000/api/spec')
      .then(res => res.json())
      .then(data => {
        setSpec(data);
        if (Object.keys(data.namespaces).length > 0) {
          const firstNs = Object.keys(data.namespaces)[0];
          setSelectedNamespace(firstNs);
          const firstEvent = Object.keys(data.namespaces[firstNs].events)[0];
          setSelectedEvent(firstEvent);
        }
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to fetch spec:', err);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const connect = () => {
    if (socket) socket.disconnect();
    
    const auth: any = {};
    if (authType === 'bearer' && authToken) {
      auth.token = `Bearer ${authToken}`;
    } else if (authType === 'apiKey' && authToken) {
      auth.apiKey = authToken;
    }

    const newSocket = io(socketUrl, {
      path: selectedNamespace === 'default' ? '/socket.io' : `/${selectedNamespace}`,
      auth
    });

    newSocket.on('connect', () => {
      setIsConnected(true);
      addLog('info', 'System', `Connected to ${socketUrl}`);
    });

    newSocket.on('disconnect', () => {
      setIsConnected(false);
      addLog('info', 'System', 'Disconnected');
    });

    newSocket.on('connect_error', (err) => {
      addLog('error', 'Error', err.message);
    });

    // Listen to all events if possible, or specifically those in spec
    if (spec && selectedNamespace) {
      Object.keys(spec.namespaces[selectedNamespace].events).forEach(evt => {
        newSocket.on(evt, (data) => {
          addLog('in', evt, data);
        });
      });
    }

    setSocket(newSocket);
  };

  const disconnect = () => {
    if (socket) {
      socket.disconnect();
      setSocket(null);
      setIsConnected(false);
    }
  };

  const addLog = (type: 'in' | 'out' | 'info' | 'error', event: string, data: any) => {
    setLogs(prev => [...prev, { type, event, data, timestamp: Date.now() }]);
  };

  const sendEvent = () => {
    if (!socket || !selectedEvent) return;
    try {
      const payload = JSON.parse(payloadInput);
      socket.emit(selectedEvent, payload, (res: any) => {
        if (res) addLog('in', `${selectedEvent} (ack)`, res);
      });
      addLog('out', selectedEvent, payload);
    } catch (e: any) {
      addLog('error', 'Input Error', e.message);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-900 text-white">
        <div className="animate-pulse flex flex-col items-center">
          <div className="w-12 h-12 bg-blue-500 rounded-full mb-4"></div>
          <p className="text-lg font-medium">Loading SocketDocs Spec...</p>
        </div>
      </div>
    );
  }

  if (!spec) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-900 text-white">
        <div className="text-center p-8 bg-slate-800 rounded-xl shadow-xl border border-slate-700">
          <h1 className="text-2xl font-bold text-red-400 mb-2">Spec Not Found</h1>
          <p className="text-slate-400">Ensure your documentation server is running and provides a valid spec.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex min-h-screen transition-colors duration-300 ${theme === 'dark' ? 'bg-slate-950 text-slate-200' : 'bg-slate-50 text-slate-900'}`}>
      {/* Sidebar */}
      <aside className={`w-64 border-r transition-colors duration-300 ${theme === 'dark' ? 'border-slate-800 bg-slate-900/50' : 'border-slate-200 bg-white'} backdrop-blur-xl`}>
        <div className="p-6">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <Activity size={20} className="text-white" />
            </div>
            <h1 className={`font-bold text-xl tracking-tight ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>SocketDocs</h1>
          </div>

          <nav className="space-y-1">
            <button
              onClick={() => setActiveTab('docs')}
              className={`w-full flex items-center gap-3 px-4 py-2 rounded-lg transition-colors ${
                activeTab === 'docs' 
                  ? (theme === 'dark' ? 'bg-blue-600/10 text-blue-400' : 'bg-blue-50 text-blue-600') 
                  : (theme === 'dark' ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-600')
              }`}
            >
              <Book size={18} />
              <span className="font-medium">Documentation</span>
            </button>
            <button
              onClick={() => setActiveTab('playground')}
              className={`w-full flex items-center gap-3 px-4 py-2 rounded-lg transition-colors ${
                activeTab === 'playground' 
                  ? (theme === 'dark' ? 'bg-blue-600/10 text-blue-400' : 'bg-blue-50 text-blue-600') 
                  : (theme === 'dark' ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-600')
              }`}
            >
              <Terminal size={18} />
              <span className="font-medium">Playground</span>
            </button>
          </nav>

          <div className="mt-8">
            <div className="relative px-4 mb-6">
              <Search className="absolute left-7 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search events..."
                className={`w-full border rounded-lg pl-9 pr-3 py-2 text-xs transition-colors focus:outline-none focus:border-blue-500 ${
                  theme === 'dark' ? 'bg-slate-950/50 border-slate-800 text-slate-300' : 'bg-slate-100 border-slate-200 text-slate-700'
                }`}
              />
            </div>
            
            <h2 className="px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">Namespaces</h2>
            <div className="space-y-1">
              {Object.keys(spec.namespaces)
                .filter(ns => {
                  if (!searchQuery) return true;
                  const query = searchQuery.toLowerCase();
                  if (ns.toLowerCase().includes(query)) return true;
                  // Check if any event in this namespace matches
                  return Object.entries(spec.namespaces[ns].events).some(([name, event]: [string, any]) => 
                    name.toLowerCase().includes(query) || 
                    (event.summary && event.summary.toLowerCase().includes(query)) ||
                    (event.description && event.description.toLowerCase().includes(query))
                  );
                })
                .map(ns => (
                <button
                  key={ns}
                  onClick={() => setSelectedNamespace(ns)}
                  className={`w-full text-left px-4 py-2 rounded-lg text-sm transition-colors ${
                    selectedNamespace === ns 
                      ? (theme === 'dark' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-900 font-semibold') 
                      : (theme === 'dark' ? 'text-slate-500 hover:text-slate-300' : 'text-slate-500 hover:text-slate-900')
                  }`}
                >
                  {ns}
                </button>
              ))}
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <header className={`h-16 border-b transition-colors duration-300 ${
          theme === 'dark' ? 'border-slate-800 bg-slate-900/30' : 'border-slate-200 bg-white/80'
        } backdrop-blur-md flex items-center justify-between px-8 sticky top-0 z-10`}>
          <div className="flex items-center gap-4 text-sm">
            <span className="text-slate-400">{spec.info.name}</span>
            <span className="text-slate-600">/</span>
            <span className={`font-medium ${theme === 'dark' ? 'text-slate-200' : 'text-slate-700'}`}>
              {activeTab === 'docs' ? 'Documentation' : 'Playground'}
            </span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-xs bg-slate-800 dark:bg-slate-800 bg-slate-200 px-2 py-1 rounded text-slate-500 dark:text-slate-400 font-mono">v{spec.info.version}</span>
            <button 
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="p-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
            >
              {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
            </button>
            <button className="p-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors">
              <Settings size={20} />
            </button>
          </div>
        </header>

        <div className="p-12 max-w-5xl mx-auto">
          {activeTab === 'docs' ? (
            <div className="space-y-12">
              <section>
                <h1 className={`text-4xl font-bold mb-4 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{spec.info.name}</h1>
                <p className={`text-xl leading-relaxed ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>{spec.info.description}</p>
              </section>

              {selectedNamespace && (
                <div className="space-y-8">
                  <h2 className={`text-2xl font-semibold border-b pb-4 ${theme === 'dark' ? 'text-blue-400 border-slate-800' : 'text-blue-600 border-slate-200'}`}>
                    Namespace: <span className={theme === 'dark' ? 'text-white' : 'text-slate-900'}>{selectedNamespace}</span>
                  </h2>

                  <div className="grid gap-6">
                    {Object.entries(spec.namespaces[selectedNamespace].events)
                      .filter(([name, event]: [string, any]) => {
                        if (!searchQuery) return true;
                        const query = searchQuery.toLowerCase();
                        return name.toLowerCase().includes(query) || 
                               (event.summary && event.summary.toLowerCase().includes(query)) ||
                               (event.description && event.description.toLowerCase().includes(query));
                      })
                      .map(([name, event]: [string, any]) => (
                      <div key={name} className={`border rounded-xl overflow-hidden transition-colors ${
                        theme === 'dark' ? 'bg-slate-900/50 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
                      }`}>
                        <div className={`p-6 border-b flex items-center justify-between ${theme === 'dark' ? 'border-slate-800' : 'border-slate-100'}`}>
                          <div>
                            <div className="flex items-center gap-3 mb-2">
                              <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded ${
                                event.direction === 'client_to_server' ? 'bg-green-500/10 text-green-400' :
                                event.direction === 'server_to_client' ? 'bg-purple-500/10 text-purple-400' :
                                'bg-blue-500/10 text-blue-400'
                              }`}>
                                {event.direction.replace(/_/g, ' ')}
                              </span>
                              <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded ${
                                theme === 'dark' ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500'
                              }`}>
                                {event.type.replace(/_/g, ' ')}
                              </span>
                              {event.authRequired && (
                                <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded bg-amber-500/10 text-amber-400">
                                  <Shield size={10} />
                                  Auth Required
                                </span>
                              )}
                            </div>
                            <h3 className={`text-xl font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{name}</h3>
                          </div>
                          <button className="text-sm text-blue-400 hover:text-blue-300 font-medium">
                            Copy Link
                          </button>
                        </div>
                        <div className="p-6 space-y-6">
                          <p className={theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}>{event.summary || event.description || 'No description available.'}</p>

                          {event.errors && event.errors.length > 0 && (
                            <div className="space-y-3">
                              <h4 className={`text-sm font-semibold ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>Possible Errors</h4>
                              <div className="grid gap-2">
                                {event.errors.map((err: any, idx: number) => (
                                  <div key={idx} className={`flex items-center gap-3 px-3 py-2 border rounded-lg ${
                                    theme === 'dark' ? 'bg-red-500/5 border-red-500/10' : 'bg-red-50 border-red-100'
                                  }`}>
                                    <span className="font-mono text-xs font-bold text-red-400">{err.code}</span>
                                    <span className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>{err.description}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          <div className="grid md:grid-cols-2 gap-8">
                            {event.payloadSchema && (
                              <div className="space-y-3">
                                <h4 className={`text-sm font-semibold ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>Payload</h4>
                                <pre className={`p-4 rounded-lg text-xs font-mono overflow-x-auto border ${
                                  theme === 'dark' ? 'bg-slate-950 text-blue-300 border-slate-800' : 'bg-slate-50 text-blue-700 border-slate-200'
                                }`}>
                                  {JSON.stringify(event.payloadSchema, null, 2)}
                                </pre>
                              </div>
                            )}
                            {event.responseSchema && (
                              <div className="space-y-3">
                                <h4 className={`text-sm font-semibold ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>Response</h4>
                                <pre className={`p-4 rounded-lg text-xs font-mono overflow-x-auto border ${
                                  theme === 'dark' ? 'bg-slate-950 text-purple-300 border-slate-800' : 'bg-slate-50 text-purple-700 border-slate-200'
                                }`}>
                                  {JSON.stringify(event.responseSchema, null, 2)}
                                </pre>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 h-[calc(100vh-12rem)]">
              {/* Left Column: Controls & Events */}
              <div className="space-y-6 flex flex-col">
                <div className={`border p-6 rounded-xl transition-colors ${
                  theme === 'dark' ? 'bg-slate-900/50 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
                }`}>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className={`text-lg font-bold flex items-center gap-2 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                      <Settings size={18} className="text-blue-400" />
                      Connection
                    </h3>
                    {isConnected ? (
                      <span className="flex items-center gap-2 text-xs font-bold text-green-400">
                        <CheckCircle2 size={14} /> Connected
                      </span>
                    ) : (
                      <span className={`flex items-center gap-2 text-xs font-bold ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>
                        <XCircle size={14} /> Disconnected
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={socketUrl}
                      onChange={(e) => setSocketUrl(e.target.value)}
                      className={`flex-1 border rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-blue-500 transition-colors ${
                        theme === 'dark' ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-100 border-slate-200 text-slate-900'
                      }`}
                      placeholder="ws://localhost:3000"
                    />
                    {isConnected ? (
                      <button
                        onClick={disconnect}
                        className="bg-red-500/10 hover:bg-red-500/20 text-red-400 px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                      >
                        <PowerOff size={16} /> Disconnect
                      </button>
                    ) : (
                      <button
                        onClick={connect}
                        className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                      >
                        <Power size={16} /> Connect
                      </button>
                    )}
                  </div>

                  <div className="mt-6 pt-6 border-t border-slate-800 flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Authentication</label>
                      <select
                        value={authType}
                        onChange={(e) => setAuthType(e.target.value as any)}
                        className={`text-xs border rounded px-2 py-1 focus:outline-none ${
                          theme === 'dark' ? 'bg-slate-950 border-slate-800 text-slate-300' : 'bg-slate-100 border-slate-200 text-slate-700'
                        }`}
                      >
                        <option value="none">None</option>
                        <option value="bearer">Bearer Token</option>
                        <option value="apiKey">API Key</option>
                      </select>
                    </div>
                    {authType !== 'none' && (
                      <div className="relative">
                        <Shield className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
                        <input
                          type="text"
                          value={authToken}
                          onChange={(e) => setAuthToken(e.target.value)}
                          placeholder={authType === 'bearer' ? 'JWT Token' : 'API Key'}
                          className={`w-full border rounded-lg pl-9 pr-3 py-2 text-xs transition-colors focus:outline-none focus:border-blue-500 ${
                            theme === 'dark' ? 'bg-slate-950 border-slate-800 text-slate-300' : 'bg-slate-100 border-slate-200 text-slate-700'
                          }`}
                        />
                      </div>
                    )}
                  </div>
                </div>

                <div className={`border rounded-xl flex-1 flex flex-col overflow-hidden transition-colors ${
                  theme === 'dark' ? 'bg-slate-900/50 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
                }`}>
                  <div className={`p-4 border-b flex items-center justify-between ${theme === 'dark' ? 'border-slate-800' : 'border-slate-100'}`}>
                    <h3 className={`font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Event Playground</h3>
                    <div className="flex items-center gap-2">
                      <select
                        value={selectedNamespace || ''}
                        onChange={(e) => setSelectedNamespace(e.target.value)}
                        className={`border rounded px-2 py-1 text-xs focus:outline-none ${
                          theme === 'dark' ? 'bg-slate-950 border-slate-800 text-slate-300' : 'bg-slate-100 border-slate-200 text-slate-700'
                        }`}
                      >
                        {Object.keys(spec.namespaces).map(ns => (
                          <option key={ns} value={ns}>{ns}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  
                  <div className="p-6 space-y-4 flex-1 overflow-auto">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Select Event</label>
                      <select
                        value={selectedEvent || ''}
                        onChange={(e) => setSelectedEvent(e.target.value)}
                        className={`w-full border rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-blue-500 ${
                          theme === 'dark' ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-100 border-slate-200 text-slate-900'
                        }`}
                      >
                        {selectedNamespace && Object.keys(spec.namespaces[selectedNamespace].events)
                          .filter(evt => spec.namespaces[selectedNamespace].events[evt].direction !== 'server_to_client')
                          .map(evt => (
                            <option key={evt} value={evt}>{evt}</option>
                          ))
                        }
                      </select>
                    </div>

                    <div className="flex-1 flex flex-col">
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Payload (JSON)</label>
                      <textarea
                        value={payloadInput}
                        onChange={(e) => setPayloadInput(e.target.value)}
                        className={`w-full flex-1 border rounded-lg p-4 font-mono text-sm focus:outline-none focus:border-blue-500 resize-none ${
                          theme === 'dark' ? 'bg-slate-950 border-slate-800 text-blue-300' : 'bg-slate-50 border-slate-200 text-blue-700'
                        }`}
                        spellCheck={false}
                      />
                    </div>

                    <button
                      onClick={sendEvent}
                      disabled={!isConnected || !selectedEvent}
                      className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-600 text-white py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2"
                    >
                      <Send size={18} />
                      Send Event
                    </button>
                  </div>
                </div>
              </div>

              {/* Right Column: Console Output */}
              <div className={`border rounded-xl flex flex-col overflow-hidden shadow-2xl transition-colors ${
                theme === 'dark' ? 'bg-slate-950 border-slate-800' : 'bg-white border-slate-200'
              }`}>
                <div className={`p-4 border-b flex items-center justify-between ${
                  theme === 'dark' ? 'bg-slate-900/50 border-slate-800' : 'bg-slate-50 border-slate-100'
                }`}>
                  <div className="flex items-center gap-2">
                    <Terminal size={16} className="text-slate-400" />
                    <h3 className={`font-bold text-sm ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Event Log</h3>
                  </div>
                  <button
                    onClick={() => setLogs([])}
                    className="text-[10px] font-bold text-slate-500 hover:text-slate-300 uppercase tracking-widest"
                  >
                    Clear Log
                  </button>
                </div>
                
                <div className="flex-1 overflow-auto p-4 space-y-2 font-mono text-[11px]">
                  {logs.length === 0 && (
                    <div className={`h-full flex items-center justify-center italic ${theme === 'dark' ? 'text-slate-700' : 'text-slate-300'}`}>
                      No activity yet. Connect and send an event to see logs.
                    </div>
                  )}
                  {logs.map((log, i) => (
                    <div key={i} className={`p-3 rounded-lg border ${
                      log.type === 'in' ? (theme === 'dark' ? 'bg-green-500/5 border-green-500/10' : 'bg-green-50 border-green-100') :
                      log.type === 'out' ? (theme === 'dark' ? 'bg-blue-500/5 border-blue-500/10' : 'bg-blue-50 border-blue-100') :
                      log.type === 'error' ? (theme === 'dark' ? 'bg-red-500/5 border-red-500/10' : 'bg-red-50 border-red-100') :
                      (theme === 'dark' ? 'bg-slate-800/30 border-slate-800' : 'bg-slate-100 border-slate-200')
                    }`}>
                      <div className="flex items-center justify-between mb-1">
                        <span className={`font-bold uppercase tracking-widest text-[9px] ${
                          log.type === 'in' ? 'text-green-400' :
                          log.type === 'out' ? 'text-blue-400' :
                          log.type === 'error' ? 'text-red-400' :
                          'text-slate-500'
                        }`}>
                          {log.type === 'in' ? '← Received' :
                           log.type === 'out' ? '→ Sent' :
                           log.type === 'error' ? '!! Error' :
                           'Info'}
                        </span>
                        <span className="text-slate-600">{new Date(log.timestamp).toLocaleTimeString()}</span>
                      </div>
                      <div className={`font-bold mb-1 ${theme === 'dark' ? 'text-slate-200' : 'text-slate-800'}`}>{log.event}</div>
                      <pre className={`whitespace-pre-wrap ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
                        {typeof log.data === 'string' ? log.data : JSON.stringify(log.data, null, 2)}
                      </pre>
                    </div>
                  ))}
                  <div ref={logsEndRef} />
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default App;
