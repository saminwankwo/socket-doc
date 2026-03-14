import React, { useState, useEffect, useRef } from 'react';
import { Layout, Search, Book, Activity, Terminal, Shield, Settings, Play, Send, Power, PowerOff, XCircle, CheckCircle2 } from 'lucide-react';
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

  // Playground state
  const [socketUrl, setSocketUrl] = useState('http://localhost:3000');
  const [isConnected, setIsConnected] = useState(false);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [logs, setLogs] = useState<{ type: 'in' | 'out' | 'info' | 'error', event: string, data: any, timestamp: number }[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<string | null>(null);
  const [payloadInput, setPayloadInput] = useState('{}');
  const logsEndRef = useRef<HTMLDivElement>(null);

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
    
    const newSocket = io(socketUrl, {
      path: selectedNamespace === 'default' ? '/socket.io' : `/${selectedNamespace}`
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
    <div className="flex min-h-screen bg-slate-950 text-slate-200">
      {/* Sidebar */}
      <aside className="w-64 border-r border-slate-800 bg-slate-900/50 backdrop-blur-xl">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <Activity size={20} className="text-white" />
            </div>
            <h1 className="font-bold text-xl tracking-tight">SocketDocs</h1>
          </div>

          <nav className="space-y-1">
            <button
              onClick={() => setActiveTab('docs')}
              className={`w-full flex items-center gap-3 px-4 py-2 rounded-lg transition-colors ${activeTab === 'docs' ? 'bg-blue-600/10 text-blue-400' : 'hover:bg-slate-800 text-slate-400'}`}
            >
              <Book size={18} />
              <span className="font-medium">Documentation</span>
            </button>
            <button
              onClick={() => setActiveTab('playground')}
              className={`w-full flex items-center gap-3 px-4 py-2 rounded-lg transition-colors ${activeTab === 'playground' ? 'bg-blue-600/10 text-blue-400' : 'hover:bg-slate-800 text-slate-400'}`}
            >
              <Terminal size={18} />
              <span className="font-medium">Playground</span>
            </button>
          </nav>

          <div className="mt-12">
            <h2 className="px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">Namespaces</h2>
            <div className="space-y-1">
              {Object.keys(spec.namespaces).map(ns => (
                <button
                  key={ns}
                  onClick={() => setSelectedNamespace(ns)}
                  className={`w-full text-left px-4 py-2 rounded-lg text-sm transition-colors ${selectedNamespace === ns ? 'bg-slate-800 text-white' : 'text-slate-500 hover:text-slate-300'}`}
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
        <header className="h-16 border-b border-slate-800 bg-slate-900/30 backdrop-blur-md flex items-center justify-between px-8 sticky top-0 z-10">
          <div className="flex items-center gap-4 text-sm">
            <span className="text-slate-400">{spec.info.name}</span>
            <span className="text-slate-600">/</span>
            <span className="text-slate-200 font-medium">{activeTab === 'docs' ? 'Documentation' : 'Playground'}</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-xs bg-slate-800 px-2 py-1 rounded text-slate-400 font-mono">v{spec.info.version}</span>
            <button className="p-2 text-slate-400 hover:text-white transition-colors">
              <Settings size={20} />
            </button>
          </div>
        </header>

        <div className="p-12 max-w-5xl mx-auto">
          {activeTab === 'docs' ? (
            <div className="space-y-12">
              <section>
                <h1 className="text-4xl font-bold text-white mb-4">{spec.info.name}</h1>
                <p className="text-xl text-slate-400 leading-relaxed">{spec.info.description}</p>
              </section>

              {selectedNamespace && (
                <div className="space-y-8">
                  <h2 className="text-2xl font-semibold text-blue-400 border-b border-slate-800 pb-4">
                    Namespace: <span className="text-white">{selectedNamespace}</span>
                  </h2>

                  <div className="grid gap-6">
                    {Object.entries(spec.namespaces[selectedNamespace].events).map(([name, event]: [string, any]) => (
                      <div key={name} className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
                        <div className="p-6 border-b border-slate-800 flex items-center justify-between">
                          <div>
                            <div className="flex items-center gap-3 mb-2">
                              <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded ${
                                event.direction === 'client_to_server' ? 'bg-green-500/10 text-green-400' :
                                event.direction === 'server_to_client' ? 'bg-purple-500/10 text-purple-400' :
                                'bg-blue-500/10 text-blue-400'
                              }`}>
                                {event.direction.replace(/_/g, ' ')}
                              </span>
                              <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded bg-slate-800 text-slate-400">
                                {event.type.replace(/_/g, ' ')}
                              </span>
                              {event.authRequired && (
                                <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded bg-amber-500/10 text-amber-400">
                                  <Shield size={10} />
                                  Auth Required
                                </span>
                              )}
                            </div>
                            <h3 className="text-xl font-bold text-white">{name}</h3>
                          </div>
                          <button className="text-sm text-blue-400 hover:text-blue-300 font-medium">
                            Copy Link
                          </button>
                        </div>
                        <div className="p-6 space-y-6">
                          <p className="text-slate-400">{event.summary || event.description || 'No description available.'}</p>

                          <div className="grid md:grid-cols-2 gap-8">
                            {event.payloadSchema && (
                              <div className="space-y-3">
                                <h4 className="text-sm font-semibold text-slate-300">Payload</h4>
                                <pre className="bg-slate-950 p-4 rounded-lg text-xs font-mono text-blue-300 overflow-x-auto border border-slate-800">
                                  {JSON.stringify(event.payloadSchema, null, 2)}
                                </pre>
                              </div>
                            )}
                            {event.responseSchema && (
                              <div className="space-y-3">
                                <h4 className="text-sm font-semibold text-slate-300">Response</h4>
                                <pre className="bg-slate-950 p-4 rounded-lg text-xs font-mono text-purple-300 overflow-x-auto border border-slate-800">
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
                <div className="bg-slate-900/50 border border-slate-800 p-6 rounded-xl">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                      <Settings size={18} className="text-blue-400" />
                      Connection
                    </h3>
                    {isConnected ? (
                      <span className="flex items-center gap-2 text-xs font-bold text-green-400">
                        <CheckCircle2 size={14} /> Connected
                      </span>
                    ) : (
                      <span className="flex items-center gap-2 text-xs font-bold text-slate-500">
                        <XCircle size={14} /> Disconnected
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={socketUrl}
                      onChange={(e) => setSocketUrl(e.target.value)}
                      className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-blue-500 transition-colors"
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
                </div>

                <div className="bg-slate-900/50 border border-slate-800 rounded-xl flex-1 flex flex-col overflow-hidden">
                  <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                    <h3 className="font-bold text-white">Event Playground</h3>
                    <div className="flex items-center gap-2">
                      <select
                        value={selectedNamespace || ''}
                        onChange={(e) => setSelectedNamespace(e.target.value)}
                        className="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs text-slate-300 focus:outline-none"
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
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
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
                        className="w-full flex-1 bg-slate-950 border border-slate-800 rounded-lg p-4 font-mono text-sm text-blue-300 focus:outline-none focus:border-blue-500 resize-none"
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
              <div className="bg-slate-950 border border-slate-800 rounded-xl flex flex-col overflow-hidden shadow-2xl">
                <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/50">
                  <div className="flex items-center gap-2">
                    <Terminal size={16} className="text-slate-400" />
                    <h3 className="font-bold text-sm text-white">Event Log</h3>
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
                    <div className="h-full flex items-center justify-center text-slate-700 italic">
                      No activity yet. Connect and send an event to see logs.
                    </div>
                  )}
                  {logs.map((log, i) => (
                    <div key={i} className={`p-3 rounded-lg border ${
                      log.type === 'in' ? 'bg-green-500/5 border-green-500/10' :
                      log.type === 'out' ? 'bg-blue-500/5 border-blue-500/10' :
                      log.type === 'error' ? 'bg-red-500/5 border-red-500/10' :
                      'bg-slate-800/30 border-slate-800'
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
                      <div className="text-slate-200 font-bold mb-1">{log.event}</div>
                      <pre className="text-slate-400 whitespace-pre-wrap">
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
