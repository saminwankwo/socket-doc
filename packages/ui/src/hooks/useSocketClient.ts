import { useState, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { buildHandshake, type AuthConfig } from '../utils/handshake';

export type { AuthConfig } from '../utils/handshake';

export interface LogEntry {
  id: string;
  type: 'in' | 'out' | 'info' | 'error';
  event: string;
  namespace: string;
  data: any;
  timestamp: number;
}

const STORAGE_KEY = 'socketdocs_auth_config';

function getStoredAuth(): AuthConfig {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // sessionStorage might be restricted or throw
  }
  return { type: 'none' };
}

function saveStoredAuth(cfg: AuthConfig) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
  } catch {
    // Ignore error
  }
}

export function useSocketClient(serverUrl: string, socketPath = '/socket.io') {
  const [authConfig, setAuthConfigState] = useState<AuthConfig>(getStoredAuth);
  const [activeNamespace, setActiveNamespace] = useState<string>('/');
  const [sockets, setSockets] = useState<Record<string, Socket>>({});
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [listenedEvents, setListenedEvents] = useState<Record<string, boolean>>({});

  const socketsRef = useRef<Record<string, Socket>>({});
  socketsRef.current = sockets;

  const authConfigRef = useRef<AuthConfig>(authConfig);
  authConfigRef.current = authConfig;

  const addLog = useCallback((type: 'in' | 'out' | 'info' | 'error', event: string, namespace: string, data: any) => {
    const entry: LogEntry = {
      id: Math.random().toString(36).substring(2, 9) + Date.now().toString(36),
      type,
      event,
      namespace,
      data,
      timestamp: Date.now(),
    };
    setLogs((prev) => [...prev, entry]);
  }, []);

  const clearLogs = useCallback(() => {
    setLogs([]);
  }, []);

  // Connect or retrieve socket for a specific namespace
  const getOrCreateSocket = useCallback(
    (ns: string) => {
      const normalizedNs = ns.startsWith('/') ? ns : `/${ns}`;
      if (socketsRef.current[normalizedNs]) {
        return socketsRef.current[normalizedNs];
      }

      const { authPayload, queryParams } = buildHandshake(authConfigRef.current);

      const nsUrl = normalizedNs === '/' ? serverUrl : `${serverUrl.replace(/\/+$/, '')}${normalizedNs}`;
      const newSocket = io(nsUrl, {
        path: socketPath,
        auth: authPayload,
        query: queryParams,
        transports: ['websocket', 'polling'],
      });

      newSocket.on('connect', () => {
        setIsConnected(true);
        addLog('info', 'System', normalizedNs, `Connected to ${nsUrl}`);
      });

      newSocket.on('disconnect', () => {
        // Only set disconnected if all sockets are disconnected
        const anyActive = Object.values(socketsRef.current).some((s) => s.connected && s !== newSocket);
        setIsConnected(anyActive);
        addLog('info', 'System', normalizedNs, 'Disconnected');
      });

      newSocket.on('connect_error', (err) => {
        addLog('error', 'Connect Error', normalizedNs, err.message);
      });

      setSockets((prev) => ({ ...prev, [normalizedNs]: newSocket }));
      return newSocket;
    },
    [serverUrl, socketPath, addLog]
  );

  const setAuthConfig = useCallback(
    (newConfig: AuthConfig) => {
      setAuthConfigState(newConfig);
      saveStoredAuth(newConfig);

      // Disconnect existing sockets so next interaction uses new auth
      for (const s of Object.values(socketsRef.current)) {
        s.disconnect();
      }
      setSockets({});
      setIsConnected(false);
      addLog('info', 'System', '/', 'Auth credentials updated. Existing connections closed.');
    },
    [addLog]
  );

  const connectNamespace = useCallback(
    (ns = activeNamespace) => {
      return getOrCreateSocket(ns);
    },
    [activeNamespace, getOrCreateSocket]
  );

  const disconnectAll = useCallback(() => {
    for (const s of Object.values(socketsRef.current)) {
      s.disconnect();
    }
    setSockets({});
    setIsConnected(false);
    addLog('info', 'System', '/', 'All connections closed');
  }, [addLog]);

  const emitEvent = useCallback(
    (ns: string, eventName: string, payload: any, onAck?: (response: any) => void) => {
      const s = getOrCreateSocket(ns);
      addLog('out', eventName, ns, payload);

      if (onAck) {
        s.emit(eventName, payload, (ackRes: any) => {
          addLog('in', `${eventName} (ack)`, ns, ackRes);
          onAck(ackRes);
        });
      } else {
        s.emit(eventName, payload);
      }
    },
    [getOrCreateSocket, addLog]
  );

  const toggleListen = useCallback(
    (ns: string, eventName: string, shouldListen: boolean) => {
      const key = `${ns}::${eventName}`;
      const s = getOrCreateSocket(ns);

      if (shouldListen) {
        const handler = (data: any) => {
          addLog('in', eventName, ns, data);
        };
        (s as any)[`__handler_${eventName}`] = handler;
        s.on(eventName, handler);
        setListenedEvents((prev) => ({ ...prev, [key]: true }));
        addLog('info', 'System', ns, `Listening for "${eventName}"`);
      } else {
        const handler = (s as any)[`__handler_${eventName}`];
        if (handler) {
          s.off(eventName, handler);
          delete (s as any)[`__handler_${eventName}`];
        }
        setListenedEvents((prev) => ({ ...prev, [key]: false }));
        addLog('info', 'System', ns, `Stopped listening for "${eventName}"`);
      }
    },
    [getOrCreateSocket, addLog]
  );

  return {
    authConfig,
    setAuthConfig,
    activeNamespace,
    setActiveNamespace,
    isConnected,
    logs,
    clearLogs,
    connectNamespace,
    disconnectAll,
    emitEvent,
    toggleListen,
    listenedEvents,
  };
}
