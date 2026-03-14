import { WebSocketServer, WebSocket } from "ws"
import { Contract, createValidator } from "@socketdocs/core"

export interface WsAdapterOptions {
  onAuth?: (socket: WebSocket, request: any) => Promise<{ userId?: string; roles?: string[] } | null>
  logger?: (msg: string) => void
}

export function bindWsAdapter(wss: WebSocketServer, contract: Contract, handlers: any, opts?: WsAdapterOptions) {
  wss.on("connection", async (socket: WebSocket, request: any) => {
    let authCtx: any = null
    if (opts?.onAuth) {
      try {
        authCtx = await opts.onAuth(socket, request)
      } catch (err) {
        socket.close(1008, "Unauthorized")
        return
      }
    }

    socket.on("message", async (data: any) => {
      try {
        const message = JSON.parse(data.toString())
        let { event: eventName, payload, namespace: nsName = "default", id: messageId } = message

        const ns = contract._namespaces.get(nsName)
        if (!ns) return

        const eventDef = ns.events.get(eventName)
        if (!eventDef) return

        if (eventDef.direction === "client_to_server" || eventDef.direction === "bidirectional") {
          const validator = createValidator(eventDef)
          // Validation
          const result = validator.validate(payload)
          if (!result.success) {
            console.error(`[SocketDocs] Validation failed for event "${eventName}":`, result.error)
            socket.send(JSON.stringify({
              type: "error",
              id: messageId,
              message: "Validation failed",
              details: result.error
            }))
            return
          }
          payload = result.data

          // Auth check
          if (eventDef.authRequired && !authCtx) {
            socket.send(JSON.stringify({ type: "error", id: messageId, code: 401, message: "Unauthorized" }))
            return
          }
          if (eventDef.roles && eventDef.roles.length > 0) {
            const ok = eventDef.roles.some((r: string) => authCtx?.roles?.includes(r))
            if (!ok) {
              socket.send(JSON.stringify({ type: "error", id: messageId, code: 403, message: "Forbidden" }))
              return
            }
          }

          // Notify plugins
          contract.plugins.notifyEvent(eventName, payload, nsName)

          // Handler
          const handler = handlers?.[nsName]?.[eventName]
          if (handler) {
            try {
              const result = await handler({ payload, socket, auth: authCtx })
              if (messageId) {
                // If this was a request-response, send the response back
                if (eventDef.response) {
                  const rsp = eventDef.response.safeParse(result)
                  if (!rsp.success) {
                    socket.send(JSON.stringify({ type: "error", id: messageId, code: 500, message: "Invalid response shape" }))
                    return
                  }
                  socket.send(JSON.stringify({ type: "response", id: messageId, payload: rsp.data }))
                } else {
                  socket.send(JSON.stringify({ type: "response", id: messageId, payload: result }))
                }
              }
            } catch (err: any) {
              if (messageId) {
                socket.send(JSON.stringify({ type: "error", id: messageId, code: 500, message: err.message || "Internal error" }))
              }
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
