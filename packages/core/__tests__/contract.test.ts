import { describe, expect, test } from "vitest";
import { createContract } from "../src/contract.js";
import { z } from "zod";

describe("createContract", () => {
  test("should create a contract and generate spec", () => {
    const contract = createContract({
      name: "test-api",
      version: "1.0.0",
      description: "Test description"
    });

    const chat = contract.namespace("chat");
    chat.event({
      name: "ping",
      direction: "client_to_server",
      payload: z.object({ msg: z.string() })
    });

    const spec = contract.generateSpec();

    expect(spec.info.name).toBe("test-api");
    expect(spec.namespaces.chat).toBeDefined();
    expect(spec.namespaces.chat.events.ping).toBeDefined();
    expect(spec.namespaces.chat.events.ping.direction).toBe("client_to_server");
    expect(spec.namespaces.chat.events.ping.payloadSchema).toBeDefined();
  });

  test("should throw error if duplicate event name is added", () => {
    const contract = createContract({ name: "test", version: "1.0.0" });
    const ns = contract.namespace("test");
    ns.event({ name: "e1", direction: "bidirectional" });
    expect(() => ns.event({ name: "e1", direction: "bidirectional" })).toThrow("Event exists: test.e1");
  });

  test("should handle bidirectional events correctly", () => {
    const contract = createContract({ name: "test", version: "1.0.0" });
    const ns = contract.namespace("test");
    ns.event({
      name: "bidirectional_event",
      direction: "bidirectional"
    });

    const spec = contract.generateSpec();
    expect(spec.namespaces.test.events.bidirectional_event.direction).toBe("bidirectional");
  });

  test("should handle request-response events with both payload and response schemas", () => {
    const contract = createContract({ name: "test", version: "1.0.0" });
    const ns = contract.namespace("test");
    ns.event({
      name: "get_data",
      direction: "client_to_server",
      type: "request_response",
      payload: z.object({ id: z.string() }),
      response: z.object({ data: z.any() })
    });

    const spec = contract.generateSpec();
    expect(spec.namespaces.test.events.get_data.type).toBe("request_response");
    expect(spec.namespaces.test.events.get_data.payloadSchema).toBeDefined();
    expect(spec.namespaces.test.events.get_data.responseSchema).toBeDefined();
  });

  test("should include errors in generated spec", () => {
    const contract = createContract({ name: "test", version: "1.0.0" });
    const ns = contract.namespace("test");
    const eventBuilder = ns.event({ name: "event_with_errors", direction: "client_to_server" });
    eventBuilder.errors([
      { code: "NOT_FOUND", description: "Resource not found" },
      { code: "UNAUTHORIZED", description: "Not authorized" }
    ]);

    const spec = contract.generateSpec();
    expect(spec.namespaces.test.events.event_with_errors.errors).toHaveLength(2);
    expect(spec.namespaces.test.events.event_with_errors.errors[0].code).toBe("NOT_FOUND");
  });

  test("should include security requirements in spec", () => {
    const contract = createContract({
      name: "secure-api",
      version: "1.0.0",
      security: [
        { name: "API Key", type: "apiKey", in: "header", description: "API key for authentication" }
      ]
    });

    const spec = contract.generateSpec();
    expect(spec.security).toHaveLength(1);
    expect(spec.security[0].name).toBe("API Key");
  });

  test("should handle auth required events", () => {
    const contract = createContract({ name: "test", version: "1.0.0" });
    const ns = contract.namespace("test");
    ns.event({
      name: "sensitive_action",
      direction: "client_to_server",
      authRequired: true,
      roles: ["admin", "user"]
    });

    const spec = contract.generateSpec();
    expect(spec.namespaces.test.events.sensitive_action.authRequired).toBe(true);
    expect(spec.namespaces.test.events.sensitive_action.roles).toEqual(["admin", "user"]);
  });

  test("should include examples in generated spec", () => {
    const contract = createContract({ name: "test", version: "1.0.0" });
    const ns = contract.namespace("test");
    ns.event({
      name: "event_with_examples",
      direction: "client_to_server",
      examples: [
        { message: "Hello world" },
        { message: "Another example" }
      ]
    });

    const spec = contract.generateSpec();
    expect(spec.namespaces.test.events.event_with_examples.examples).toHaveLength(2);
  });

  test("should handle multiple namespaces correctly", () => {
    const contract = createContract({ name: "multi-ns-api", version: "1.0.0" });

    const chatNs = contract.namespace("chat");
    chatNs.event({ name: "send", direction: "client_to_server" });

    const notificationsNs = contract.namespace("notifications");
    notificationsNs.event({ name: "push", direction: "server_to_client" });

    const spec = contract.generateSpec();
    expect(spec.namespaces.chat).toBeDefined();
    expect(spec.namespaces.notifications).toBeDefined();
    expect(Object.keys(spec.namespaces)).toHaveLength(2);
  });

  test("should default type when not specified", () => {
    const contract = createContract({ name: "test", version: "1.0.0" });
    const ns = contract.namespace("test");
    ns.event({ name: "default_type_event", direction: "client_to_server" });

    const spec = contract.generateSpec();
    expect(spec.namespaces.test.events.default_type_event.type).toBe("fire_and_forget");
  });
});