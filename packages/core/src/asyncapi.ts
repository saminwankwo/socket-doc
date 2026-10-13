import type { SocketDocsSpec } from './spec.js';

export function toAsyncApi(spec: SocketDocsSpec): Record<string, unknown> {
  const asyncApi: Record<string, unknown> = {
    asyncapi: '3.0.0',
    info: {
      title: spec.info.title,
      version: spec.info.version,
      description: spec.info.description,
    },
    servers: {},
    channels: {},
    components: {
      messages: {},
      schemas: {},
    },
  };

  if (spec.servers && spec.servers.length > 0) {
    const servers: Record<string, unknown> = {};
    for (const s of spec.servers) {
      const key = s.label || s.url.replace(/[^a-zA-Z0-9]/g, '_') || 'server';
      servers[key] = {
        host: s.url,
        protocol: 'ws',
      };
    }
    asyncApi.servers = servers;
  } else {
    asyncApi.servers = {
      development: {
        host: 'localhost:3000',
        protocol: 'ws',
        description: 'Development server',
      },
    };
  }

  if (spec.security && spec.security.length > 0) {
    const securitySchemes: Record<string, unknown> = {};
    const security: Array<Record<string, unknown[]>> = [];

    for (const sec of spec.security) {
      if (sec.type === 'apiKey') {
        securitySchemes[sec.name] = {
          type: 'apiKey',
          in: sec.in || 'header',
          description: sec.description,
        };
      } else if (sec.type === 'http') {
        securitySchemes[sec.name] = {
          type: 'http',
          scheme: 'bearer',
          description: sec.description,
        };
      } else if (sec.type === 'oauth2') {
        securitySchemes[sec.name] = {
          type: 'oauth2',
          description: sec.description,
          flows: {},
        };
      }
      security.push({ [sec.name]: [] });
    }

    (asyncApi.components as Record<string, unknown>).securitySchemes =
      securitySchemes;
    asyncApi.security = security;
  }

  for (const [nsName, ns] of Object.entries(spec.namespaces)) {
    const channelName = nsName === 'default' ? '/' : nsName;

    const channel: Record<string, unknown> = {
      address: channelName,
      messages: {},
    };

    const sendMessages: Array<Record<string, string>> = [];
    const receiveMessages: Array<Record<string, string>> = [];

    for (const [evtName, evt] of Object.entries(ns.events)) {
      const messageKey = `${nsName.replace(/[^a-zA-Z0-9]/g, '_')}_${evtName}`;

      const message: Record<string, unknown> = {
        name: evtName,
        title: evt.summary || evtName,
        summary: evt.summary,
        description: evt.description,
        payload: evt.payloadSchema || { type: 'object' },
      };

      if (evt.responseSchema) {
        message['x-response'] = evt.responseSchema;
      }

      if (evt.errors && evt.errors.length > 0) {
        message['x-errors'] = evt.errors;
      }

      if (evt.examples && evt.examples.length > 0) {
        message.examples = evt.examples.map((ex, i) => ({
          name: `example-${i}`,
          payload: ex,
        }));
      }

      (asyncApi.components as Record<string, Record<string, unknown>>).messages[
        messageKey
      ] = message;

      if (
        evt.direction === 'client_to_server' ||
        evt.direction === 'bidirectional'
      ) {
        (channel.messages as Record<string, unknown>)[messageKey] = {
          $ref: `#/components/messages/${messageKey}`,
        };
        sendMessages.push({ $ref: `#/components/messages/${messageKey}` });
      }

      if (
        evt.direction === 'server_to_client' ||
        evt.direction === 'bidirectional'
      ) {
        (channel.messages as Record<string, unknown>)[messageKey] = {
          $ref: `#/components/messages/${messageKey}`,
        };
        receiveMessages.push({ $ref: `#/components/messages/${messageKey}` });
      }
    }

    if (sendMessages.length > 0) {
      channel.operations = {
        ...(channel.operations as Record<string, unknown> | undefined),
        send: {
          action: 'send',
          channel: { $ref: `#/channels/${encodeURIComponent(channelName)}` },
          messages: sendMessages,
        },
      };
    }

    if (receiveMessages.length > 0) {
      channel.operations = {
        ...(channel.operations as Record<string, unknown> | undefined),
        receive: {
          action: 'receive',
          channel: { $ref: `#/channels/${encodeURIComponent(channelName)}` },
          messages: receiveMessages,
        },
      };
    }

    (asyncApi.channels as Record<string, unknown>)[channelName] = channel;
  }

  return asyncApi;
}
