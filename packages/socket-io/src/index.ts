import { Server, Socket, Namespace as SocketioNamespace } from "socket.io"
import { Contract, createValidator } from "@socketdocs/core"

export interface SocketioAdapterOptions {
  onAuth?: (socket: Socket) => Promise<{ userId?: string; roles?: string[] } | null>
  logger?: (msg: string) => void
}

export function bindSocketioAdapter(io: Server | SocketioNamespace, contract: Contract, handlers: any, opts?: SocketioAdapterOptions) {
  // Bind namespaces from the contract to Socket.IO
  for (const [nsName, ns] of contract._namespaces) {
    const isServer = "of" in io
    const socketioNs = nsName === "default" || nsName === "/" ? io : (isServer ? (io as Server).of(nsName) : io)

    socketioNs.on("connection", async (socket: Socket) => {
      let authCtx: any = null
      if (opts?.onAuth) {
        try {
          authCtx = await opts.onAuth(socket)
        } catch (err) {
          socket.disconnect(true)
          return
        }
      }

      // For each event in the contract namespace
      for (const [eventName, eventDef] of ns.events) {
        if (eventDef.direction === "client_to_server" || eventDef.direction === "bidirectional") {
          const validator = createValidator(eventDef)

          socket.on(eventName, async (payload: any, ack?: any) => {
            // Validate payload
            const result = validator.validate(payload)
            if (!result.success) {
              console.error(`[SocketDocs] Validation failed for event "${eventName}":`, result.error)
              return ack?.({ status: "error", code: 400, message: "Invalid payload", details: result.error })
            }
            payload = result.data

            // Auth check
            if (eventDef.authRequired && !authCtx) {
              return ack?.({ status: "error", code: 401, message: "Unauthorized" })
            }
            if (eventDef.roles && eventDef.roles.length > 0) {
              const ok = eventDef.roles.some((r: string) => authCtx?.roles?.includes(r))
              if (!ok) return ack?.({ status: "error", code: 403, message: "Forbidden" })
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
              if (eventDef.response) {
                const rsp = eventDef.response.safeParse(result)
                if (!rsp.success) {
                  return ack?.({ status: "error", code: 500, message: "Invalid response shape" })
                }
                return ack?.(rsp.data)
              } else {
                return ack?.(result)
              }
            } catch (err: any) {
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
          eventDef.payload.parse(payload)
        }
      }

      socket.emit(eventName, payload)
    }
  }
}
