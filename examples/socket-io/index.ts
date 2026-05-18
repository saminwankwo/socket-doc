import { createServer } from "http"
import { Server } from "socket.io"
import { createContract } from "@socketdocs/core"
import { bindSocketioAdapter } from "@socketdocs/socket-io"
import { z } from "zod"

const httpServer = createServer()
const io = new Server(httpServer)

const contract = createContract({
  name: "chat-api",
  version: "1.0.0",
  description: "A simple chat API"
})

const chat = contract.namespace("chat")

chat.event({
  name: "send_message",
  direction: "client_to_server",
  payload: z.object({
    message: z.string(),
    userId: z.string()
  })
})

chat.event({
  name: "new_message",
  direction: "server_to_client",
  payload: z.object({
    message: z.string(),
    userId: z.string(),
    timestamp: z.number()
  })
})

// Bind the adapter
const adapter = bindSocketioAdapter(io, contract, {
  chat: {
    send_message: async ({ payload }: any) => {
      console.log("Valid message received via handler:", payload)
      // Broadcast the message back to all clients in the namespace
      adapter.emit(io.of("chat"), "chat", "new_message", {
        ...payload,
        timestamp: Date.now()
      })
    }
  }
})

// Register a simple logging plugin
contract.registerPlugin({
  name: "logger",
  version: "1.0.0",
  onEvent: (eventName, payload, namespace) => {
    console.log(`[Plugin:Logger] Event "${eventName}" in namespace "${namespace}"`, payload)
  }
})

io.on("connection", (_socket) => {
  console.log("Client connected")
})

httpServer.listen(3000, () => {
  console.log("Server listening on port 3000")
})
