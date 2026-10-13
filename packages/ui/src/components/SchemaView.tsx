import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';

interface SchemaViewProps {
  title: string;
  schema?: Record<string, unknown>;
  theme: 'dark' | 'light';
  accent?: 'blue' | 'purple';
}

export const SchemaView: React.FC<SchemaViewProps> = ({ title, schema, theme, accent = 'blue' }) => {
  const [copied, setCopied] = useState(false);

  if (!schema) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(schema, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard unavailable (e.g. insecure context); ignore quietly
    }
  };

  return (
    <div className="min-w-0 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h4 className={`text-xs font-semibold uppercase tracking-wider ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
          {title}
        </h4>
        <button
          type="button"
          onClick={handleCopy}
          title="Copy schema"
          className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium transition-colors ${
            copied
              ? 'text-green-400'
              : theme === 'dark'
              ? 'text-slate-500 hover:bg-slate-800/60 hover:text-slate-300'
              : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600'
          }`}
        >
          {copied ? <Check size={11} /> : <Copy size={11} />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre
        className={`max-h-80 overflow-y-auto overflow-x-auto rounded-lg border p-4 font-mono text-xs transition-colors ${
          theme === 'dark'
            ? accent === 'blue'
              ? 'bg-slate-950 text-blue-300 border-slate-800'
              : 'bg-slate-950 text-purple-300 border-slate-800'
            : accent === 'blue'
            ? 'bg-slate-50 text-blue-700 border-slate-200'
            : 'bg-slate-50 text-purple-700 border-slate-200'
        }`}
      >
        {JSON.stringify(schema, null, 2)}
      </pre>
    </div>
  );
};
