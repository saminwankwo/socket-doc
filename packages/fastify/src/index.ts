import { FastifyInstance, FastifyRequest } from "fastify"
import { SocketStream } from "@fastify/websocket"
import { Contract, createValidator, generateHtml } from "@socketdocs/core"

export interface FastifyAdapterOptions {
  onAuth?: (connection: SocketStream, request: FastifyRequest) => Promise<{ userId?: string; roles?: string[] } | null>
  logger?: (msg: string) => void
}

export function serveFastifyDocs(fastify: FastifyInstance, contract: Contract, path: string = "/docs") {
  const spec = contract.generateSpec()
  const html = generateHtml(spec)

  fastify.get(path, async (_request, reply) => {
    reply.type("text/html").send(html)
  })

  fastify.get(`${path}/spec`, async (_request, reply) => {
    reply.type("application/json").send(spec)
  })
}

export function bindFastifyAdapter(fastify: FastifyInstance, contract: Contract, handlers: any, opts?: FastifyAdapterOptions) {
  fastify.get("/ws", { websocket: true }, async (connection: SocketStream, request: FastifyRequest) => {
    let authCtx: any = null
    if (opts?.onAuth) {
      try {
        authCtx = await opts.onAuth(connection, request)
      } catch (err) {
        connection.socket.close(1008, "Unauthorized")
        return
      }
    }

    connection.socket.on("message", async (data: any) => {
      try {
        const message = JSON.parse(data.toString())
        const { event: eventName, namespace: nsName = "default", id: messageId } = message
        let { payload } = message

        const ns = contract._namespaces.get(nsName)
        if (!ns) return

        const eventDef = ns.events.get(eventName)
        if (!eventDef) return

        if (eventDef.direction === "client_to_server" || eventDef.direction === "bidirectional") {
          const validator = createValidator(eventDef)
          // Validation
          const result = validator.validate(payload)
          if (!result.success) {
            connection.socket.send(JSON.stringify({
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
            connection.socket.send(JSON.stringify({ type: "error", id: messageId, code: 401, message: "Unauthorized" }))
            return
          }
          if (eventDef.roles && eventDef.roles.length > 0) {
            const ok = eventDef.roles.some((r: string) => authCtx?.roles?.includes(r))
            if (!ok) {
              connection.socket.send(JSON.stringify({ type: "error", id: messageId, code: 403, message: "Forbidden" }))
              return
            }
          }

          // Notify plugins
          contract.plugins.notifyEvent(eventName, payload, nsName)

          // Handler
          const handler = handlers?.[nsName]?.[eventName]
          if (handler) {
            try {
              const result = await handler({ payload, socket: connection.socket, auth: authCtx })
              if (messageId) {
                if (eventDef.response) {
                  const rsp = eventDef.response.safeParse(result)
                  if (!rsp.success) {
                    connection.socket.send(JSON.stringify({ type: "error", id: messageId, code: 500, message: "Invalid response shape" }))
                    return
                  }
                  connection.socket.send(JSON.stringify({ type: "response", id: messageId, payload: rsp.data }))
                } else {
                  connection.socket.send(JSON.stringify({ type: "response", id: messageId, payload: result }))
                }
              }
            } catch (err: any) {
              if (messageId) {
                connection.socket.send(JSON.stringify({ type: "error", id: messageId, code: 500, message: err.message || "Internal error" }))
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
    send: (socket: any, nsName: string, eventName: string, payload: any) => {
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
