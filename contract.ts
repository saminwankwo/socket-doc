import { createContract } from "@socketdocs/core"
import { z } from "zod"

export const contract = createContract({
  name: "demo-api",
  version: "1.0.0",
  description: "A demo API for testing the CLI"
})

const main = contract.namespace("main")

main.event({
  name: "ping",
  direction: "client_to_server",
  payload: z.object({
    message: z.string().optional()
  })
}).errors([
  { code: "RATE_LIMITED", description: "Too many pings" },
  { code: "INVALID_MESSAGE", description: "Message content is invalid" }
])

main.event({
  name: "pong",
  direction: "server_to_client",
  payload: z.object({
    time: z.number()
  })
})
