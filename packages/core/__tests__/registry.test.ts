import { describe, it, expect } from "vitest";
import { z } from "zod";
import { EventRegistry } from "../src/registry.js";

function makeRegistry() {
  return new EventRegistry({
    info: { title: "Test", version: "1.0.0" },
  });
}

describe("EventRegistry", () => {
  it("observe then declare: declared fields win, source becomes declared", () => {
    const r = makeRegistry();
    r.observe("/", "ping", { direction: "client_to_server", kind: "request_response" });
    r.declare("/", "ping", {
      summary: "Ping",
      payload: z.object({ n: z.number() }),
    });

    const spec = r.toSpec();
    const evt = spec.namespaces["/"].events["ping"];
    expect(evt.source).toBe("declared");
    expect(evt.summary).toBe("Ping");
    expect(evt.payloadSchema).toBeDefined();
    expect(evt.kind).toBe("request_response");
    expect(evt.direction).toBe("client_to_server");
  });

  it("declare then observe: declared fields are not overwritten by sniffing", () => {
    const r = makeRegistry();
    r.declare("/", "ping", { direction: "bidirectional", summary: "Ping" });
    r.observe("/", "ping", { direction: "client_to_server" });

    const evt = r.toSpec().namespaces["/"].events["ping"];
    expect(evt.direction).toBe("bidirectional");
    expect(evt.source).toBe("declared");
  });

  it("source transitions from sniffed to declared", () => {
    const r = makeRegistry();
    r.observe("/", "ping");
    expect(r.toSpec().namespaces["/"].events["ping"].source).toBe("sniffed");

    r.declare("/", "ping", { summary: "x" });
    expect(r.toSpec().namespaces["/"].events["ping"].source).toBe("declared");
  });

  it("supports multiple namespaces", () => {
    const r = makeRegistry();
    r.observe("/", "ping");
    r.observe("/chat", "send_message");

    const spec = r.toSpec();
    expect(Object.keys(spec.namespaces).sort()).toEqual(["/", "/chat"]);
    expect(spec.namespaces["/"].events["ping"]).toBeDefined();
    expect(spec.namespaces["/chat"].events["send_message"]).toBeDefined();
  });

  it("toSpec returns the canonical SocketDocsSpec shape", () => {
    const r = new EventRegistry({
      info: { title: "Chat", version: "2.0", description: "realtime" },
      servers: [{ url: "http://localhost:3000" }],
      socketPath: "/socket.io",
    });
    r.observe("/", "ping");

    const spec = r.toSpec();
    expect(spec.specVersion).toBe("1.0");
    expect(spec.info.title).toBe("Chat");
    expect(spec.info.version).toBe("2.0");
    expect(spec.socketPath).toBe("/socket.io");
    expect(spec.servers).toEqual([{ url: "http://localhost:3000" }]);
    expect(spec.namespaces["/"].events["ping"].name).toBe("ping");
  });

  it("combining client_to_server and server_to_client observe yields bidirectional", () => {
    const r = makeRegistry();
    r.observe("/", "ping", { direction: "client_to_server" });
    r.observe("/", "ping", { direction: "server_to_client" });

    const evt = r.toSpec().namespaces["/"].events["ping"];
    expect(evt.direction).toBe("bidirectional");
    expect(evt.source).toBe("sniffed");
  });

  it("declare normalizes Zod payload and response to JSON Schema", () => {
    const r = makeRegistry();
    r.declare("/", "ping", {
      payload: z.object({ a: z.string() }),
      response: z.object({ ok: z.boolean() }),
    });

    const evt = r.toSpec().namespaces["/"].events["ping"];
    expect(evt.payloadSchema?.type).toBe("object");
    expect(evt.responseSchema?.type).toBe("object");
  });

  it("onChange fires on observe and declare", () => {
    const r = makeRegistry();
    let count = 0;
    r.onChange(() => count++);

    r.observe("/", "ping");
    r.declare("/", "ping", { summary: "x" });
    expect(count).toBe(2);
  });
});
