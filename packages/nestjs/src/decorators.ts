import 'reflect-metadata';
import type {
  Direction,
  ErrorSpec,
  EventKind,
  JSONSchema,
} from '@socketdocs/core';
import type { ZodTypeAny } from 'zod';

export const SOCKET_EVENT_METADATA = 'socketdocs:socket_event';

export interface SocketEventOptions {
  summary?: string;
  description?: string;
  direction?: Direction;
  /** request_response when the handler acknowledges (defaults to unset: never guessed). */
  kind?: EventKind;
  payload?: ZodTypeAny | JSONSchema;
  response?: ZodTypeAny | JSONSchema;
  examples?: unknown[];
  errors?: ErrorSpec[];
  tags?: string[];
  deprecated?: boolean;
  authRequired?: boolean;
}

/**
 * Decorator to enrich a WebSocket message handler with documentation.
 * Used alongside `@SubscribeMessage(...)`.
 */
export function SocketEvent(options: SocketEventOptions = {}): MethodDecorator {
  return (
    target: object,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor,
  ) => {
    Reflect.defineMetadata(SOCKET_EVENT_METADATA, options, descriptor.value);
    return descriptor;
  };
}
