import React, { useState } from 'react';
import { Shield, ChevronDown, ChevronUp, Volume2, VolumeX } from 'lucide-react';
import { SchemaView } from './SchemaView';
import { TryItOut } from './TryItOut';

interface EventCardProps {
  name: string;
  namespace: string;
  event: any;
  theme: 'dark' | 'light';
  isListening?: boolean;
  onToggleListen?: (shouldListen: boolean) => void;
  onExecute: (payload: any, onAck?: (response: any) => void) => void;
}

export const EventCard: React.FC<EventCardProps> = ({
  name,
  namespace,
  event,
  theme,
  isListening = false,
  onToggleListen,
  onExecute,
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(true);
  const [showTryIt, setShowTryIt] = useState<boolean>(false);

  const canListen = event.direction === 'server_to_client' || event.direction === 'bidirectional';

  return (
    <div
      className={`border rounded-xl overflow-hidden transition-colors ${
        theme === 'dark' ? 'bg-slate-900/50 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
      }`}
    >
      <div
        className={`flex flex-wrap items-start justify-between gap-2 border-b p-5 cursor-pointer select-none transition-colors ${
          theme === 'dark' ? 'border-slate-800 hover:bg-slate-800/40' : 'border-slate-100 hover:bg-slate-50'
        }`}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="min-w-0 flex-1 basis-60">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span
              className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded ${
                event.direction === 'client_to_server'
                  ? 'bg-green-500/10 text-green-400'
                  : event.direction === 'server_to_client'
                  ? 'bg-purple-500/10 text-purple-400'
                  : 'bg-blue-500/10 text-blue-400'
              }`}
            >
              {(event.direction || 'client_to_server').replace(/_/g, ' ')}
            </span>

            <span
              className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded ${
                theme === 'dark' ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500'
              }`}
            >
              {event.kind ? event.kind.replace(/_/g, ' ') : 'event'}
            </span>

            {event.authRequired && (
              <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded bg-amber-500/10 text-amber-400">
                <Shield size={10} />
                Auth Required
              </span>
            )}

            {event.source && (
              <span
                className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded ${
                  event.source === 'declared' || event.source === 'decorator'
                    ? 'bg-teal-500/10 text-teal-400'
                    : 'bg-slate-500/10 text-slate-400'
                }`}
              >
                {event.source === 'sniffed' ? 'auto-discovered' : 'documented'}
              </span>
            )}

            {event.deprecated && (
              <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded bg-red-500/10 text-red-400">
                Deprecated
              </span>
            )}
          </div>

          <h3 className={`truncate text-lg font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{name}</h3>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {canListen && onToggleListen && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleListen(!isListening);
              }}
              title={isListening ? 'Stop listening for this event' : 'Listen for server emissions'}
              className={`flex min-h-10 items-center gap-1.5 rounded-lg border px-3 py-1 text-xs font-medium transition-colors ${
                isListening
                  ? 'bg-purple-600/20 text-purple-300 border-purple-500/40 animate-pulse'
                  : theme === 'dark'
                  ? 'bg-slate-800/80 text-slate-400 border-slate-700 hover:text-slate-200'
                  : 'bg-slate-100 text-slate-600 border-slate-200 hover:text-slate-800'
              }`}
            >
              {isListening ? <Volume2 size={13} /> : <VolumeX size={13} />}
              <span>{isListening ? 'Listening' : 'Listen'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setShowTryIt(!showTryIt);
              if (!isExpanded) setIsExpanded(true);
            }}
            className={`min-h-10 basis-full rounded-lg border px-3 py-1 text-xs font-semibold transition-colors sm:basis-auto ${
              showTryIt
                ? 'bg-blue-600/10 border-blue-500/40 text-blue-400'
                : theme === 'dark'
                ? 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
            }`}
          >
            {showTryIt ? 'Cancel Try It' : 'Try it out'}
          </button>

          <div className="text-slate-400">
            {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </div>
        </div>
      </div>

      {isExpanded && (
        <div className="p-6 space-y-6">
          <p className={`break-words text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
            {event.summary || event.description || 'No description available.'}
          </p>

          {event.errors && event.errors.length > 0 && (
            <div className="space-y-2">
              <h4 className={`text-xs font-semibold uppercase tracking-wider ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
                Possible Errors
              </h4>
              <div className="grid gap-2">
                {event.errors.map((err: any, idx: number) => (
                  <div
                    key={idx}
                    className={`flex items-center gap-3 px-3 py-2 border rounded-lg ${
                      theme === 'dark' ? 'bg-red-500/5 border-red-500/10' : 'bg-red-50 border-red-100'
                    }`}
                  >
                    <span className="font-mono text-xs font-bold text-red-400">{err.code}</span>
                    <span className={`text-xs ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>{err.description}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <SchemaView title="Payload Schema" schema={event.payloadSchema} theme={theme} accent="blue" />
            <SchemaView title="Response Schema (Ack)" schema={event.responseSchema} theme={theme} accent="purple" />
          </div>

          {showTryIt && (
            <TryItOut
              namespace={namespace}
              eventName={name}
              kind={event.kind}
              payloadSchema={event.payloadSchema}
              responseSchema={event.responseSchema}
              examples={event.examples}
              theme={theme}
              onExecute={onExecute}
            />
          )}
        </div>
      )}
    </div>
  );
};
