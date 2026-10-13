import { describe, it, expect } from "vitest";
import { lintSpec } from "../src/lint.js";
import { toAsyncApi } from "../src/asyncapi.js";
import type { SocketDocsSpec } from "../src/spec.js";

const baseSpec: SocketDocsSpec = {
  specVersion: "1.0",
  info: { title: "Test", version: "1.0.0", description: "desc" },
  namespaces: {
    "/": {
      name: "/",
      events: {
        ping: {
          name: "ping",
          namespace: "/",
          direction: "client_to_server",
          kind: "request_response",
          summary: "Ping",
          description: "ping pong",
          payloadSchema: { type: "object" },
          responseSchema: { type: "object" },
          source: "declared",
          errors: [{ code: "ERR", description: "bad" }],
        },
      },
    },
  },
};

describe("lintSpec", () => {
  it("returns no issues for a well-formed spec", () => {
    expect(lintSpec(baseSpec)).toEqual([]);
  });

  it("warns when request_response has no response schema", () => {
    const spec = structuredClone(baseSpec) as SocketDocsSpec;
    delete spec.namespaces["/"].events["ping"].responseSchema;
    const issues = lintSpec(spec);
    expect(issues.some((i) => i.message.includes("response schema"))).toBe(true);
  });

  it("errors on duplicate error codes", () => {
    const spec = structuredClone(baseSpec) as SocketDocsSpec;
    spec.namespaces["/"].events["ping"].errors = [
      { code: "ERR", description: "a" },
      { code: "ERR", description: "b" },
    ];
    const issues = lintSpec(spec);
    expect(issues.some((i) => i.type === "error" && i.message.includes("Duplicate error code"))).toBe(true);
  });

  it("warns on missing summary and description", () => {
    const spec = structuredClone(baseSpec) as SocketDocsSpec;
    delete spec.namespaces["/"].events["ping"].summary;
    delete spec.namespaces["/"].events["ping"].description;
    const issues = lintSpec(spec);
    expect(issues.some((i) => i.message.includes("missing both summary and description"))).toBe(true);
  });
});

describe("toAsyncApi", () => {
  it("produces an AsyncAPI 3.0 doc with title and version", () => {
    const doc = toAsyncApi(baseSpec) as any;
    expect(doc.asyncapi).toBe("3.0.0");
    expect(doc.info.title).toBe("Test");
    expect(doc.info.version).toBe("1.0.0");
  });

  it("uses spec.servers instead of hardcoding localhost", () => {
    const spec = structuredClone(baseSpec) as SocketDocsSpec;
    spec.servers = [{ url: "wss://example.com", label: "prod" }];
    const doc = toAsyncApi(spec) as any;
    expect(doc.servers.prod.host).toBe("wss://example.com");
  });

  it("maps events into channels and messages", () => {
    const doc = toAsyncApi(baseSpec) as any;
    expect(doc.channels["/"]).toBeDefined();
    expect(Object.keys(doc.components.messages).length).toBeGreaterThan(0);
  });

  it("maps errors into the message via x-errors", () => {
    const doc = toAsyncApi(baseSpec) as any;
    const msg = Object.values(doc.components.messages)[0] as any;
    expect(msg["x-errors"]).toBeDefined();
    expect(msg["x-errors"][0].code).toBe("ERR");
  });
});
