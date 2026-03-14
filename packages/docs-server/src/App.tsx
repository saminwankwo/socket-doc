import React, { useState, useEffect } from 'react';
import { Layout, Search, Book, Activity, Terminal, Shield, Settings } from 'lucide-react';

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

  useEffect(() => {
    // In production this would fetch from the CLI served /api/spec
    fetch('http://localhost:4000/api/spec')
      .then(res => res.json())
      .then(data => {
        setSpec(data);
        if (Object.keys(data.namespaces).length > 0) {
          setSelectedNamespace(Object.keys(data.namespaces)[0]);
        }
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to fetch spec:', err);
        setLoading(false);
      });
  }, []);

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
            <div className="space-y-8">
              <div className="bg-blue-600/10 border border-blue-500/20 p-6 rounded-xl">
                <h2 className="text-xl font-bold text-blue-400 mb-2">Interactive Playground</h2>
                <p className="text-slate-400">Connect to your socket server and test events in real-time. Coming soon!</p>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default App;
