import { WebSocketServer, WebSocket } from "ws"
import { Contract } from "@socketdocs/core"

export interface WsAdapterOptions {
  contract: Contract
  wss: WebSocketServer
}

export function bindWsAdapter({ contract, wss }: WsAdapterOptions) {
  wss.on("connection", (socket: WebSocket) => {
    socket.on("message", (data: any) => {
      try {
        const message = JSON.parse(data.toString())
        const { event: eventName, payload, namespace: nsName = "default" } = message

        const ns = contract._namespaces.get(nsName)
        if (!ns) return

        const eventDef = ns.events.get(eventName)
        if (!eventDef) return

        if (eventDef.direction === "client_to_server" || eventDef.direction === "bidirectional") {
          if (eventDef.payload) {
            const result = eventDef.payload.safeParse(payload)
            if (!result.success) {
              console.error(`[SocketDocs] Validation failed for event "${eventName}":`, result.error.errors)
              socket.send(JSON.stringify({
                type: "error",
                message: "Validation failed",
                details: result.error.errors
              }))
              return
            }
          }
        }
      } catch (err) {
        console.error("[SocketDocs] Error parsing message:", err)
      }
    })
  })

  return {
    send: (socket: WebSocket, nsName: string, eventName: string, payload: any) => {
      const ns = contract._namespaces.get(nsName)
      if (!ns) throw new Error(`Namespace ${nsName} not found in contract`)

      const eventDef = ns.events.get(eventName)
      if (!eventDef) throw new Error(`Event ${eventName} not found in namespace ${nsName}`)

      if (eventDef.direction === "server_to_client" || eventDef.direction === "bidirectional") {
        if (eventDef.payload) {
          eventDef.payload.parse(payload)
        }
      }

      socket.send(JSON.stringify({
        namespace: nsName,
        event: eventName,
        payload
      }))
    }
  }
}
