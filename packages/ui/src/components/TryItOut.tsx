import React, { useState } from 'react';
import { Clock, CheckCircle2, AlertCircle, Play } from 'lucide-react';
import { sampleFromSchema } from '../utils/sampleFromSchema';

interface TryItOutProps {
  namespace: string;
  eventName: string;
  kind?: 'fire_and_forget' | 'request_response';
  payloadSchema?: Record<string, unknown>;
  responseSchema?: Record<string, unknown>;
  examples?: unknown[];
  theme: 'dark' | 'light';
  onExecute: (payload: any, onAck?: (response: any) => void) => void;
}

export const TryItOut: React.FC<TryItOutProps> = ({
  kind,
  payloadSchema,
  examples,
  theme,
  onExecute,
}) => {
  const getInitialPayload = () => {
    if (examples && examples.length > 0) {
      return JSON.stringify(examples[0], null, 2);
    }
    if (payloadSchema) {
      const sampled = sampleFromSchema(payloadSchema);
      return JSON.stringify(sampled, null, 2);
    }
    return '{\n  \n}';
  };

  const [inputJson, setInputJson] = useState<string>(getInitialPayload);
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [executing, setExecuting] = useState<boolean>(false);
  const [ackResponse, setAckResponse] = useState<any>(null);
  const [ackTimeout, setAckTimeout] = useState<boolean>(false);

  const handleExecute = () => {
    setJsonError(null);
    let parsed: any;
    try {
      parsed = inputJson.trim() === '' ? {} : JSON.parse(inputJson);
    } catch (e: any) {
      setJsonError(`Invalid JSON: ${e.message}`);
      return;
    }

    setExecuting(true);
    setAckResponse(null);
    setAckTimeout(false);

    let ackTimer: ReturnType<typeof setTimeout> | null = null;

    // Wait for ack if request_response or unknown
    const expectsAck = kind === 'request_response' || !kind;

    if (expectsAck) {
      ackTimer = setTimeout(() => {
        setExecuting(false);
        setAckTimeout(true);
      }, 10000); // 10s timeout per spec
    } else {
      setTimeout(() => setExecuting(false), 200);
    }

    onExecute(parsed, (res: any) => {
      if (ackTimer) clearTimeout(ackTimer);
      setExecuting(false);
      setAckTimeout(false);
      setAckResponse(res);
    });
  };

  return (
    <div className={`mt-4 pt-4 border-t ${theme === 'dark' ? 'border-slate-800' : 'border-slate-100'}`}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold text-blue-400 uppercase tracking-wider">Try it out</span>
        <button
          onClick={handleExecute}
          disabled={executing}
          className={`flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold rounded-lg shadow-sm transition-all ${
            executing
              ? 'bg-blue-600/50 text-white cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-500 text-white hover:shadow-blue-500/20 active:scale-95'
          }`}
        >
          {executing ? (
            <>
              <Clock size={13} className="animate-spin" />
              <span>Executing...</span>
            </>
          ) : (
            <>
              <Play size={13} fill="currentColor" />
              <span>Execute</span>
            </>
          )}
        </button>
      </div>

      <div className="space-y-3">
        <div>
          <label className="block text-[11px] font-medium text-slate-400 mb-1">Parameters (JSON Payload)</label>
          <textarea
            value={inputJson}
            onChange={(e) => {
              setInputJson(e.target.value);
              if (jsonError) setJsonError(null);
            }}
            rows={4}
            className={`w-full rounded-lg border p-3 font-mono text-base transition-colors focus:border-blue-500 focus:outline-none sm:text-xs ${
              theme === 'dark'
                ? 'bg-slate-950/70 border-slate-800 text-slate-200'
                : 'bg-slate-50 border-slate-200 text-slate-800'
            }`}
          />
          {jsonError && (
            <div className="flex items-center gap-1.5 text-xs text-red-400 mt-1">
              <AlertCircle size={13} />
              <span>{jsonError}</span>
            </div>
          )}
        </div>

        {ackTimeout && (
          <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg flex items-center gap-2 text-xs text-amber-400">
            <Clock size={14} />
            <span>Acknowledgment timed out after 10 seconds. The server did not respond with an ack callback.</span>
          </div>
        )}

        {ackResponse !== null && (
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-green-400">
              <CheckCircle2 size={13} />
              <span>Acknowledgment Response</span>
            </div>
            <pre
              className={`max-h-80 overflow-y-auto overflow-x-auto rounded-lg border p-3 font-mono text-xs ${
                theme === 'dark'
                  ? 'bg-slate-950 border-slate-800 text-green-400'
                  : 'bg-green-50/50 border-green-200 text-green-700'
              }`}
            >
              {JSON.stringify(ackResponse, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
};
