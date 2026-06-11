import { Server, Socket, Namespace as SocketioNamespace } from "socket.io";
import { Contract, createValidator } from "@socketdocs/core";

export interface SocketioAdapterOptions {
  onAuth?: (socket: Socket) => Promise<{ userId?: string; roles?: string[] } | null>;
  logger?: (msg: string) => void;
}

export interface HandlerContext<T = any, _U = any> {
  payload: T;
  socket: Socket;
  auth: { userId?: string; roles?: string[] } | null;
}

export type EventHandler<T = any, U = any> = (
  ctx: HandlerContext<T, U>
) => Promise<U> | U;

export type NamespaceHandlers = Record<string, EventHandler>;

export type AdapterHandlers = Record<string, NamespaceHandlers>;

export function bindSocketioAdapter(
  io: Server | SocketioNamespace,
  contract: Contract,
  handlers: AdapterHandlers,
  opts?: SocketioAdapterOptions
) {
  // Bind namespaces from the contract to Socket.IO
  for (const [nsName, ns] of contract._namespaces) {
    const isServer = "of" in io
    const socketioNs = nsName === "default" || nsName === "/" ? io : (isServer ? (io as Server).of(nsName) : io)

    socketioNs.on("connection", async (socket: Socket) => {
      let authCtx: any = null
      if (opts?.onAuth) {
        try {
          authCtx = await opts.onAuth(socket)
        } catch (_err) {
          socket.disconnect(true)
          return
        }
      }

      // For each event in the contract namespace
      for (const [eventName, eventDef] of ns.events) {
        if (eventDef.direction === "client_to_server" || eventDef.direction === "bidirectional") {
          const validator = createValidator(eventDef)
          const responseValidator = createValidator(eventDef, 'response')

          socket.on(eventName, async (payload: any, ack?: any) => {
            // Validate payload
            const result = validator.validate(payload)
            if (!result.success) {
              console.error(`[SocketDocs] Validation failed for event "${eventName}":`, result.error)
              contract.plugins.notifyError(eventName, { type: 'validation', error: result.error }, nsName)
              return ack?.({ status: "error", code: 400, message: "Invalid payload", details: result.error })
            }
            payload = result.data

            // Auth check
            if (eventDef.authRequired && !authCtx) {
              contract.plugins.notifyError(eventName, { type: 'auth', message: 'Unauthorized' }, nsName)
              return ack?.({ status: "error", code: 401, message: "Unauthorized" })
            }
            if (eventDef.roles && eventDef.roles.length > 0) {
              const ok = eventDef.roles.some((r: string) => authCtx?.roles?.includes(r))
              if (!ok) {
                contract.plugins.notifyError(eventName, { type: 'auth', message: 'Forbidden' }, nsName)
                return ack?.({ status: "error", code: 403, message: "Forbidden" })
              }
            }

            // Notify plugins
            contract.plugins.notifyEvent(eventName, payload, nsName)

            // Get the handler for this event
            const handler = handlers?.[nsName]?.[eventName]
            if (!handler) {
              // If no handler provided in handlers map, we don't return 404
              // as the user might be using standard socket.on()
              return
            }

            try {
              const result = await handler({ payload, socket, auth: authCtx })
              const responseResult = responseValidator.validate(result)
              
              if (!responseResult.success) {
                contract.plugins.notifyError(eventName, { type: 'response_validation', error: responseResult.error }, nsName)
                return ack?.({ status: "error", code: 500, message: "Invalid response shape" })
              }
              
              contract.plugins.notifyResponse(eventName, responseResult.data, nsName)
              return ack?.(responseResult.data)
            } catch (err: any) {
              contract.plugins.notifyError(eventName, { type: 'handler_error', error: err.message || err }, nsName)
              return ack?.({ status: "error", code: 500, message: err.message || "Internal error" })
            }
          })
        }
      }
    })
  }

  return {
    // Helper to emit events with validation (server-to-client)
    emit: <T = any>(socket: Socket | Server | SocketioNamespace, nsName: string, eventName: string, payload: T) => {
      const ns = contract._namespaces.get(nsName)
      if (!ns) throw new Error(`Namespace ${nsName} not found in contract`)

      const eventDef = ns.events.get(eventName)
      if (!eventDef) throw new Error(`Event ${eventName} not found in namespace ${nsName}`)

      if (eventDef.direction === "server_to_client" || eventDef.direction === "bidirectional") {
        if (eventDef.payload) {
          const result = eventDef.payload.safeParse(payload)
          if (!result.success) {
            contract.plugins.notifyError(eventName, { type: 'payload_validation', error: result.error.issues }, nsName)
            throw new Error(`Invalid payload for event ${eventName}: ${result.error.message}`)
          }
          payload = result.data as T
        }
      }

      socket.emit(eventName, payload)
    }
  }
}
