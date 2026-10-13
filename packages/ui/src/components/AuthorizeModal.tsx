import React, { useState } from 'react';
import { Shield, X, Key, Lock } from 'lucide-react';
import type { AuthConfig } from '../hooks/useSocketClient';

interface AuthorizeModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentAuth: AuthConfig;
  onSaveAuth: (cfg: AuthConfig) => void;
  theme: 'dark' | 'light';
  securitySpecs?: Array<{ name: string; type: string; in?: string; description?: string }>;
}

export const AuthorizeModal: React.FC<AuthorizeModalProps> = ({
  isOpen,
  onClose,
  currentAuth,
  onSaveAuth,
  theme,
  securitySpecs,
}) => {
  const [authType, setAuthType] = useState<AuthConfig['type']>(currentAuth.type);
  const [token, setToken] = useState(currentAuth.token || '');
  const [apiKey, setApiKey] = useState(currentAuth.apiKey || '');
  const [customJson, setCustomJson] = useState(currentAuth.customAuthJson || '{\n  \n}');
  const [queryKey, setQueryKey] = useState(currentAuth.queryParamKey || '');
  const [queryVal, setQueryVal] = useState(currentAuth.queryParamValue || '');

  if (!isOpen) return null;

  const handleSave = () => {
    onSaveAuth({
      type: authType,
      token: authType === 'bearer' ? token : undefined,
      apiKey: authType === 'apiKey' ? apiKey : undefined,
      customAuthJson: authType === 'custom' ? customJson : undefined,
      queryParamKey: queryKey || undefined,
      queryParamValue: queryVal || undefined,
    });
    onClose();
  };

  const handleReset = () => {
    setAuthType('none');
    setToken('');
    setApiKey('');
    setCustomJson('{\n  \n}');
    setQueryKey('');
    setQueryVal('');
    onSaveAuth({ type: 'none' });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
      <div
        className={`max-h-[90dvh] w-[calc(100vw-2rem)] max-w-md overflow-y-auto rounded-xl border shadow-2xl transition-colors ${
          theme === 'dark' ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-900'
        }`}
      >
        <div className={`flex items-center justify-between border-b p-4 sm:p-6 ${theme === 'dark' ? 'border-slate-800' : 'border-slate-100'}`}>
          <div className="flex min-w-0 items-center gap-3">
            <div className="p-2 bg-blue-500/10 text-blue-400 rounded-lg">
              <Shield size={20} />
            </div>
            <div className="min-w-0">
              <h3 className="truncate font-bold text-lg">Available Authorizations</h3>
              <p className={`text-xs ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                Configure credentials for WebSocket handshake authentication
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className={`p-1.5 rounded-lg transition-colors ${theme === 'dark' ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-6 p-4 sm:p-6">
          <div className={`p-3 rounded-lg text-xs leading-relaxed border ${
            theme === 'dark' ? 'bg-slate-950/60 border-slate-800 text-slate-400' : 'bg-blue-50/50 border-blue-100 text-slate-600'
          }`}>
            <span className="font-semibold text-blue-400">Notice: </span>
            Browsers cannot set custom HTTP headers during WebSocket upgrade requests. SocketDocs sends auth credentials
            via Socket.IO’s handshake <code>auth</code> payload or handshake query parameters.
          </div>

          {securitySpecs && securitySpecs.length > 0 && (
            <div className="space-y-2">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Declared Security Schemes</span>
              <div className="space-y-1">
                {securitySpecs.map((s, idx) => (
                  <div
                    key={idx}
                    className={`text-xs px-3 py-1.5 rounded border flex justify-between items-center ${
                      theme === 'dark' ? 'bg-slate-950 border-slate-800 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-700'
                    }`}
                  >
                    <span className="font-mono font-medium">{s.name} ({s.type})</span>
                    <span className="text-slate-400 text-[11px]">{s.in ? `in: ${s.in}` : ''} {s.description || ''}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Auth Mode</label>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {(['none', 'bearer', 'apiKey', 'custom'] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setAuthType(mode)}
                    className={`py-2 px-3 text-xs font-medium rounded-lg border capitalize transition-colors ${
                      authType === mode
                        ? 'border-blue-500 bg-blue-500/10 text-blue-400'
                        : theme === 'dark'
                        ? 'border-slate-800 bg-slate-950/50 text-slate-400 hover:bg-slate-800'
                        : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {mode === 'none' ? 'None' : mode === 'bearer' ? 'Bearer' : mode === 'apiKey' ? 'API Key' : 'Custom'}
                  </button>
                ))}
              </div>
            </div>

            {authType === 'bearer' && (
              <div className="space-y-2">
                <label className="block text-xs font-medium text-slate-300">Bearer Token</label>
                <div className="relative">
                  <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="password"
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6..."
                    className={`w-full border rounded-lg pl-9 pr-3 py-2 text-base font-mono sm:text-xs focus:outline-none focus:border-blue-500 ${
                      theme === 'dark' ? 'bg-slate-950 border-slate-800 text-slate-100' : 'bg-slate-50 border-slate-200 text-slate-900'
                    }`}
                  />
                </div>
              </div>
            )}

            {authType === 'apiKey' && (
              <div className="space-y-2">
                <label className="block text-xs font-medium text-slate-300">API Key</label>
                <div className="relative">
                  <Key size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="text"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="sk_test_..."
                    className={`w-full border rounded-lg pl-9 pr-3 py-2 text-base font-mono sm:text-xs focus:outline-none focus:border-blue-500 ${
                      theme === 'dark' ? 'bg-slate-950 border-slate-800 text-slate-100' : 'bg-slate-50 border-slate-200 text-slate-900'
                    }`}
                  />
                </div>
              </div>
            )}

            {authType === 'custom' && (
              <div className="space-y-2">
                <label className="block text-xs font-medium text-slate-300">Custom Handshake Auth (JSON payload)</label>
                <textarea
                  value={customJson}
                  onChange={(e) => setCustomJson(e.target.value)}
                  rows={4}
                  className={`w-full border rounded-lg p-3 text-base font-mono sm:text-xs focus:outline-none focus:border-blue-500 ${
                    theme === 'dark' ? 'bg-slate-950 border-slate-800 text-slate-100' : 'bg-slate-50 border-slate-200 text-slate-900'
                  }`}
                />
              </div>
            )}

            <div className="pt-2 border-t border-slate-800/40">
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Optional Query Parameter
              </label>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <input
                  type="text"
                  placeholder="Key (e.g. token)"
                  value={queryKey}
                  onChange={(e) => setQueryKey(e.target.value)}
                  className={`border rounded-lg px-3 py-1.5 text-base font-mono sm:text-xs focus:outline-none focus:border-blue-500 ${
                    theme === 'dark' ? 'bg-slate-950 border-slate-800 text-slate-100' : 'bg-slate-50 border-slate-200 text-slate-900'
                  }`}
                />
                <input
                  type="text"
                  placeholder="Value"
                  value={queryVal}
                  onChange={(e) => setQueryVal(e.target.value)}
                  className={`border rounded-lg px-3 py-1.5 text-base font-mono sm:text-xs focus:outline-none focus:border-blue-500 ${
                    theme === 'dark' ? 'bg-slate-950 border-slate-800 text-slate-100' : 'bg-slate-50 border-slate-200 text-slate-900'
                  }`}
                />
              </div>
            </div>
          </div>
        </div>

        <div className={`sticky bottom-0 p-4 border-t flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between ${theme === 'dark' ? 'bg-slate-950/95 border-slate-800' : 'bg-slate-50 border-slate-100'}`}>
          <button
            onClick={handleReset}
            className="text-xs text-red-400 hover:text-red-300 transition-colors font-medium px-3 py-1.5 self-start sm:self-auto"
          >
            Clear Authorization
          </button>
          {/* Stacked on mobile with Authorize on top; side-by-side from sm up */}
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <button
              onClick={onClose}
              className={`px-4 py-2 text-xs font-medium rounded-lg border transition-colors ${
                theme === 'dark' ? 'border-slate-800 text-slate-300 hover:bg-slate-800' : 'border-slate-200 text-slate-600 hover:bg-slate-100'
              }`}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-5 py-2 text-xs font-medium rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition-colors"
            >
              Authorize
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
