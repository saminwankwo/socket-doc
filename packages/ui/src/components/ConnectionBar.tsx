import React from 'react';
import { Power, PowerOff, CheckCircle2, XCircle, Globe } from 'lucide-react';

interface ConnectionBarProps {
  socketUrl: string;
  setSocketUrl: (url: string) => void;
  serverOptions?: Array<{ url: string; label?: string }>;
  namespaces: string[];
  selectedNamespace: string;
  setSelectedNamespace: (ns: string) => void;
  isConnected: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
  theme: 'dark' | 'light';
}

export const ConnectionBar: React.FC<ConnectionBarProps> = ({
  socketUrl,
  setSocketUrl,
  serverOptions,
  namespaces,
  selectedNamespace,
  setSelectedNamespace,
  isConnected,
  onConnect,
  onDisconnect,
  theme,
}) => {
  return (
    <div
      className={`border p-4 rounded-xl mb-6 transition-colors ${
        theme === 'dark' ? 'bg-slate-900/40 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-1 min-w-[300px]">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
            <Globe size={14} className="text-blue-400" />
            <span>Server</span>
          </div>

          <div className="flex-1 flex gap-2">
            <input
              type="text"
              value={socketUrl}
              onChange={(e) => setSocketUrl(e.target.value)}
              placeholder="http://localhost:3000"
              className={`flex-1 border rounded-lg px-3 py-1.5 text-xs font-mono transition-colors focus:outline-none focus:border-blue-500 ${
                theme === 'dark'
                  ? 'bg-slate-950/60 border-slate-800 text-slate-200'
                  : 'bg-slate-50 border-slate-200 text-slate-800'
              }`}
            />

            {serverOptions && serverOptions.length > 0 && (
              <select
                onChange={(e) => {
                  if (e.target.value) setSocketUrl(e.target.value);
                }}
                className={`border rounded-lg px-2 py-1.5 text-xs focus:outline-none ${
                  theme === 'dark'
                    ? 'bg-slate-950 border-slate-800 text-slate-300'
                    : 'bg-slate-50 border-slate-200 text-slate-700'
                }`}
              >
                <option value="">Servers...</option>
                {serverOptions.map((srv, idx) => (
                  <option key={idx} value={srv.url}>
                    {srv.label ? `${srv.label} (${srv.url})` : srv.url}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {namespaces.length > 1 && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 font-medium">Namespace:</span>
              <select
                value={selectedNamespace}
                onChange={(e) => setSelectedNamespace(e.target.value)}
                className={`border rounded-lg px-3 py-1.5 text-xs focus:outline-none ${
                  theme === 'dark'
                    ? 'bg-slate-950 border-slate-800 text-slate-300'
                    : 'bg-slate-50 border-slate-200 text-slate-700'
                }`}
              >
                {namespaces.map((ns) => (
                  <option key={ns} value={ns}>
                    {ns}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex items-center gap-2">
            {isConnected ? (
              <span className="flex items-center gap-1.5 text-xs font-semibold text-green-400 bg-green-500/10 px-2.5 py-1 rounded-lg">
                <CheckCircle2 size={13} />
                Connected
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 bg-slate-500/10 px-2.5 py-1 rounded-lg">
                <XCircle size={13} />
                Disconnected
              </span>
            )}

            {isConnected ? (
              <button
                onClick={onDisconnect}
                className="flex items-center gap-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
              >
                <PowerOff size={13} />
                Disconnect
              </button>
            ) : (
              <button
                onClick={onConnect}
                className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
              >
                <Power size={13} />
                Connect
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

