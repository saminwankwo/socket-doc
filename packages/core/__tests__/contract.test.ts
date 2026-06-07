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
    const contract = createContract({ name: "test", version: "1" });
    const ns = contract.namespace("test");
    ns.event({ name: "e1", direction: "bidirectional" });
    expect(() => ns.event({ name: "e1", direction: "bidirectional" })).toThrow("Event exists: test.e1");
  });
});
