import React from 'react';
interface SchemaViewProps {
  title: string;
  schema?: Record<string, unknown>;
  theme: 'dark' | 'light';
  accent?: 'blue' | 'purple';
}

export const SchemaView: React.FC<SchemaViewProps> = ({ title, schema, theme, accent = 'blue' }) => {
  if (!schema) return null;

  return (
    <div className="space-y-2">
      <h4 className={`text-xs font-semibold uppercase tracking-wider ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
        {title}
      </h4>
      <pre
        className={`p-4 rounded-lg text-xs font-mono overflow-x-auto border transition-colors ${
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

