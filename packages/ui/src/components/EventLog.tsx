import React, { useState, useEffect, useRef } from 'react';
import {
  Terminal,
  Trash2,
  ArrowDownCircle,
  ArrowUpCircle,
  AlertCircle,
  Info,
  Filter,
} from 'lucide-react';
import type { LogEntry } from '../hooks/useSocketClient';

interface EventLogProps {
  logs: LogEntry[];
  onClear: () => void;
  theme: 'dark' | 'light';
  /** Override the panel height (e.g. `h-80 xl:h-[520px]` in the playground). */
  className?: string;
}

export const EventLog: React.FC<EventLogProps> = ({
  logs,
  onClear,
  theme,
  className,
}) => {
  const [filterEvent, setFilterEvent] = useState<string>('');
  const [autoScroll, setAutoScroll] = useState<boolean>(true);
  const [expandedLogIds, setExpandedLogIds] = useState<Record<string, boolean>>(
    {},
  );
  const logsEndRef = useRef<HTMLDivElement>(null);

  const filteredLogs = logs.filter((log) => {
    if (!filterEvent) return true;
    return (
      log.event.toLowerCase().includes(filterEvent.toLowerCase()) ||
      log.namespace.toLowerCase().includes(filterEvent.toLowerCase())
    );
  });

  useEffect(() => {
    // Only follow new entries — never jump the page on mount with an empty log
    if (autoScroll && logs.length > 0) {
      logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, autoScroll]);

  const toggleExpand = (id: string) => {
    setExpandedLogIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div
      className={`${
        className ?? 'h-[520px]'
      } flex flex-col rounded-xl border transition-colors ${
        theme === 'dark'
          ? 'bg-slate-900/60 border-slate-800'
          : 'bg-white border-slate-200 shadow-sm'
      }`}
    >
      <div
        className={`p-4 border-b flex flex-wrap items-center justify-between gap-3 ${
          theme === 'dark'
            ? 'border-slate-800 bg-slate-950/40'
            : 'border-slate-100 bg-slate-50'
        }`}
      >
        <div className="flex items-center gap-2">
          <Terminal size={16} className="text-blue-400" />
          <h3
            className={`font-bold text-sm ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}
          >
            Live Event Log
          </h3>
          <span className="text-xs font-mono text-slate-500">
            ({filteredLogs.length})
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-0 basis-full sm:basis-auto sm:flex-1">
            <Filter
              size={12}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500"
            />
            <input
              type="text"
              placeholder="Filter by event..."
              value={filterEvent}
              onChange={(e) => setFilterEvent(e.target.value)}
              className={`w-full min-w-0 rounded-lg border py-1 pl-7 pr-2 text-base focus:border-blue-500 focus:outline-none sm:text-xs ${
                theme === 'dark'
                  ? 'bg-slate-950 border-slate-800 text-slate-200'
                  : 'bg-white border-slate-200 text-slate-800'
              }`}
            />
          </div>

          <label className="flex items-center gap-1.5 text-xs text-slate-400 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={autoScroll}
              onChange={(e) => setAutoScroll(e.target.checked)}
              className="rounded border-slate-700 text-blue-600 focus:ring-0"
            />
            <span>Auto-scroll</span>
          </label>

          <button
            onClick={onClear}
            title="Clear logs"
            className="flex items-center gap-1 text-xs text-slate-400 hover:text-red-400 transition-colors p-1"
          >
            <Trash2 size={13} />
            <span>Clear</span>
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-2 font-mono text-xs">
        {filteredLogs.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-500">
            <Terminal size={32} className="mb-2 opacity-50" />
            <p>No socket events recorded yet.</p>
          </div>
        ) : (
          filteredLogs.map((log) => {
            const isExpanded = expandedLogIds[log.id] ?? true;
            return (
              <div
                key={log.id}
                className={`p-3 rounded-lg border transition-colors ${
                  theme === 'dark'
                    ? 'bg-slate-950/60 border-slate-800/80'
                    : 'bg-slate-50 border-slate-200/80'
                }`}
              >
                <div
                  className="flex items-center justify-between cursor-pointer select-none"
                  onClick={() => toggleExpand(log.id)}
                >
                  <div className="flex items-center gap-2">
                    {log.type === 'in' ? (
                      <ArrowDownCircle size={14} className="text-green-400" />
                    ) : log.type === 'out' ? (
                      <ArrowUpCircle size={14} className="text-blue-400" />
                    ) : log.type === 'error' ? (
                      <AlertCircle size={14} className="text-red-400" />
                    ) : (
                      <Info size={14} className="text-slate-400" />
                    )}

                    <span
                      className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                        log.type === 'in'
                          ? 'bg-green-500/10 text-green-400'
                          : log.type === 'out'
                            ? 'bg-blue-500/10 text-blue-400'
                            : log.type === 'error'
                              ? 'bg-red-500/10 text-red-400'
                              : 'bg-slate-500/10 text-slate-400'
                      }`}
                    >
                      {log.type}
                    </span>

                    <span className="font-semibold text-slate-200">
                      {log.event}
                    </span>
                    <span className="text-[10px] text-slate-500">
                      [{log.namespace}]
                    </span>
                  </div>

                  <span className="text-[10px] text-slate-500">
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </span>
                </div>

                {isExpanded && log.data !== undefined && (
                  <pre
                    className={`mt-2 p-2 rounded text-[11px] overflow-x-auto border ${
                      theme === 'dark'
                        ? 'bg-slate-900/90 border-slate-800 text-slate-300'
                        : 'bg-white border-slate-200 text-slate-800'
                    }`}
                  >
                    {typeof log.data === 'string'
                      ? log.data
                      : JSON.stringify(log.data, null, 2)}
                  </pre>
                )}
              </div>
            );
          })
        )}
        <div ref={logsEndRef} />
      </div>
    </div>
  );
};
