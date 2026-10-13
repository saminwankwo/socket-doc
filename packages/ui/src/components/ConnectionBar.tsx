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
        theme === 'dark'
          ? 'bg-slate-900/40 border-slate-800'
          : 'bg-white border-slate-200 shadow-sm'
      }`}
    >
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <div className="flex min-w-0 w-full items-center gap-2 sm:w-auto sm:flex-1">
          <div className="hidden items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400 sm:flex">
            <Globe size={14} className="text-blue-400" />
            <span>Server</span>
          </div>

          <div className="flex min-w-0 flex-1 flex-wrap gap-2">
            <input
              type="text"
              value={socketUrl}
              onChange={(e) => setSocketUrl(e.target.value)}
              placeholder="http://localhost:3000"
              className={`min-w-0 basis-full rounded-lg border px-3 py-1.5 font-mono text-base transition-colors focus:border-blue-500 focus:outline-none sm:basis-64 sm:flex-1 sm:text-xs ${
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
                className={`min-w-0 basis-full flex-1 rounded-lg border px-2 py-1.5 text-base focus:outline-none sm:basis-auto sm:flex-none sm:text-xs ${
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

        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3 sm:flex-none">
          {namespaces.length > 1 && (
            <div className="flex min-w-0 flex-1 items-center gap-2 sm:flex-none">
              <span className="hidden text-xs font-medium text-slate-400 sm:inline">
                Namespace:
              </span>
              <select
                value={selectedNamespace}
                onChange={(e) => setSelectedNamespace(e.target.value)}
                className={`min-w-0 flex-1 rounded-lg border px-3 py-1.5 text-base focus:outline-none sm:flex-none sm:text-xs ${
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

          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:flex-nowrap">
            {isConnected ? (
              <span className="flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-green-500/10 px-2.5 py-1 text-xs font-semibold text-green-400">
                <CheckCircle2 size={13} />
                Connected
              </span>
            ) : (
              <span className="flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-slate-500/10 px-2.5 py-1 text-xs font-semibold text-slate-400">
                <XCircle size={13} />
                Disconnected
              </span>
            )}

            {isConnected ? (
              <button
                onClick={onDisconnect}
                className="flex min-h-10 basis-full items-center justify-center gap-1.5 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-400 transition-colors hover:bg-red-500/20 sm:basis-auto sm:flex-none"
              >
                <PowerOff size={13} />
                Disconnect
              </button>
            ) : (
              <button
                onClick={onConnect}
                className="flex min-h-10 basis-full items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-blue-500 sm:basis-auto sm:flex-none"
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
