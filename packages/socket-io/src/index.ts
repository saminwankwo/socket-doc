import { Server, Socket, Namespace as SocketioNamespace } from "socket.io"
import { Contract } from "@socketdocs/core"

export interface SocketioAdapterOptions {
  contract: Contract
  io: Server | SocketioNamespace
}

export function bindSocketioAdapter({ contract, io }: SocketioAdapterOptions) {
  // Bind namespaces from the contract to Socket.IO
  for (const [nsName, ns] of contract._namespaces) {
    const isServer = "of" in io
    const socketioNs = nsName === "default" || nsName === "/" ? io : (isServer ? (io as Server).of(nsName) : io)

    socketioNs.on("connection", (socket: Socket) => {
      // For each event in the contract namespace
      for (const [eventName, eventDef] of ns.events) {
        if (eventDef.direction === "client_to_server" || eventDef.direction === "bidirectional") {
          socket.on(eventName, (payload: any, callback?: (response: any) => void) => {
            // Validate payload if schema exists
            if (eventDef.payload) {
              const result = eventDef.payload.safeParse(payload)
              if (!result.success) {
                console.error(`[SocketDocs] Validation failed for event "${eventName}":`, result.error.errors)
                if (callback) {
                  callback({ error: "Validation failed", details: result.error.errors })
                }
                return
              }
              // Replace payload with parsed data (handles defaults, transformations)
              payload = result.data
            }

            // Notify plugins
            contract.plugins.notifyEvent(eventName, payload, nsName)

            // The actual logic should be handled by the user
            // We'll emit a "contract:event" so the user can listen to it if they want
            // but normally the user would just use socket.on as usual.
            // This adapter primarily adds validation.
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
