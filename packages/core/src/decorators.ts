import { z } from "zod"

export function Namespace(name: string) {
  return function (target: any) {
    target.__socketdocs_namespace = name
  }
}

export function Event(name: string, direction: "client_to_server" | "server_to_client" | "bidirectional" = "bidirectional") {
  return function (target: any, key: string) {
    if (!target.__socketdocs_events) {
      target.__socketdocs_events = []
    }
    target.__socketdocs_events.push({
      name,
      direction,
      method: key,
      // In a real implementation, we could extract Zod schemas from parameters
      // or use other decorators to define them.
    })
  }
}
