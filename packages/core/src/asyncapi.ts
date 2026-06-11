export function convertToAsyncApi(spec: any): any {
  const asyncApi: any = {
    asyncapi: "3.0.0", // Use latest AsyncAPI version
    info: {
      title: spec.info.name,
      version: spec.info.version,
      description: spec.info.description
    },
    servers: {
      development: {
        host: "localhost:{port}",
        protocol: "ws",
        description: "Development server",
        variables: {
          port: {
            default: "3000",
            description: "Port number"
          }
        }
      }
    },
    channels: {},
    components: {
      messages: {},
      schemas: {}
    }
  }

  // Add security schemes if present
  if (spec.security && spec.security.length > 0) {
    asyncApi.components.securitySchemes = {}
    asyncApi.security = []
    
    for (const sec of spec.security) {
      if (sec.type === "apiKey") {
        asyncApi.components.securitySchemes[sec.name] = {
          type: "apiKey",
          in: sec.in || "header",
          description: sec.description
        }
      } else if (sec.type === "http") {
        asyncApi.components.securitySchemes[sec.name] = {
          type: "http",
          scheme: "bearer",
          description: sec.description
        }
      } else if (sec.type === "oauth2") {
        asyncApi.components.securitySchemes[sec.name] = {
          type: "oauth2",
          description: sec.description,
          flows: {} // Basic placeholder
        }
      }
      asyncApi.security.push({ [sec.name]: [] })
    }
  }

  // Process each namespace
  for (const [nsName, ns] of Object.entries(spec.namespaces) as [string, any]) {
    const channelName = nsName === "default" ? "/" : `/${nsName}`
    
    asyncApi.channels[channelName] = {
      address: channelName,
      messages: {}
    }

    // Process each event in the namespace
    for (const [evtName, evt] of Object.entries(ns.events) as [string, any]) {
      const messageKey = `${nsName}_${evtName}`
      
      const message: any = {
        name: evtName,
        title: evt.summary || evtName,
        summary: evt.summary,
        description: evt.description,
        payload: evt.payloadSchema || { type: "object" }
      }

      // Add examples if present
      if (evt.examples && evt.examples.length > 0) {
        message.examples = evt.examples.map((ex: any, i: number) => ({
          name: `example-${i}`,
          payload: ex
        }))
      }

      asyncApi.components.messages[messageKey] = message

      // Add to channel messages based on direction
      const channel = asyncApi.channels[channelName]
      
      if (evt.direction === "client_to_server" || evt.direction === "bidirectional") {
        channel.messages[messageKey] = {
          $ref: `#/components/messages/${messageKey}`
        }
      }

      if (evt.direction === "server_to_client" || evt.direction === "bidirectional") {
        // For bidirectional, we can add it as both or just handle it in operations
        channel.messages[messageKey] = {
          $ref: `#/components/messages/${messageKey}`
        }
      }
    }

    // Define operations for the channel
    const hasClientToServer = Object.values(ns.events).some(
      (e: any) => e.direction === "client_to_server" || e.direction === "bidirectional"
    )
    const hasServerToClient = Object.values(ns.events).some(
      (e: any) => e.direction === "server_to_client" || e.direction === "bidirectional"
    )

    if (hasClientToServer) {
      asyncApi.channels[channelName].operations = {
        ...asyncApi.channels[channelName].operations,
        [`sendMessageTo${nsName}`]: {
          action: "send",
          channel: {
            $ref: `#/channels/${encodeURIComponent(channelName)}`
          },
          messages: Object.entries(ns.events)
            .filter(([_, e]: [string, any]) => 
              e.direction === "client_to_server" || e.direction === "bidirectional"
            )
            .map(([evtName, _]: [string, any]) => ({
              $ref: `#/components/messages/${nsName}_${evtName}`
            }))
        }
      }
    }

    if (hasServerToClient) {
      asyncApi.channels[channelName].operations = {
        ...asyncApi.channels[channelName].operations,
        [`receiveMessageFrom${nsName}`]: {
          action: "receive",
          channel: {
            $ref: `#/channels/${encodeURIComponent(channelName)}`
          },
          messages: Object.entries(ns.events)
            .filter(([_, e]: [string, any]) => 
              e.direction === "server_to_client" || e.direction === "bidirectional"
            )
            .map(([evtName, _]: [string, any]) => ({
              $ref: `#/components/messages/${nsName}_${evtName}`
            }))
        }
      }
    }
  }

  return asyncApi
}
