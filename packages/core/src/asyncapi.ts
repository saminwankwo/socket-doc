export function convertToAsyncApi(spec: any): any {
  const asyncApi: any = {
    asyncapi: '2.6.0',
    info: {
      title: spec.info.name,
      version: spec.info.version,
      description: spec.info.description
    },
    channels: {},
    components: {
      messages: {},
      schemas: {}
    }
  };

  for (const [nsName, ns] of Object.entries(spec.namespaces) as [string, any][]) {
    const channelName = nsName === 'default' ? '/' : `/${nsName}`;
    
    asyncApi.channels[channelName] = {
      publish: {
        message: {
          oneOf: []
        }
      },
      subscribe: {
        message: {
          oneOf: []
        }
      }
    };

    for (const [evtName, evt] of Object.entries(ns.events) as [string, any][]) {
      const messageKey = `${nsName}_${evtName}`;
      const message: any = {
        name: evtName,
        summary: evt.summary,
        description: evt.description,
        payload: evt.payloadSchema || { type: 'object' }
      };

      asyncApi.components.messages[messageKey] = message;

      if (evt.direction === 'client_to_server' || evt.direction === 'bidirectional') {
        asyncApi.channels[channelName].publish.message.oneOf.push({
          $ref: `#/components/messages/${messageKey}`
        });
      }

      if (evt.direction === 'server_to_client' || evt.direction === 'bidirectional') {
        asyncApi.channels[channelName].subscribe.message.oneOf.push({
          $ref: `#/components/messages/${messageKey}`
        });
      }
    }

    // Clean up empty publish/subscribe
    if (asyncApi.channels[channelName].publish.message.oneOf.length === 0) {
      delete asyncApi.channels[channelName].publish;
    }
    if (asyncApi.channels[channelName].subscribe.message.oneOf.length === 0) {
      delete asyncApi.channels[channelName].subscribe;
    }
  }

  return asyncApi;
}
