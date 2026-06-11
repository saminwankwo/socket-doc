import { describe, expect, test, beforeEach } from "vitest";
import { createContract } from "../src/contract.js";
import { bindWsAdapter } from "../../ws/src/index.js";
import { WebSocketServer } from "ws";
import { z } from "zod";

describe("WsAdapter", () => {
  let wss: WebSocketServer;
  let contract: any;

  beforeEach(() => {
    contract = createContract({ name: "test", version: "1.0.0" });
    const ns = contract.namespace("default");
    ns.event({
      name: "ping",
      direction: "client_to_server",
      payload: z.object({ msg: z.string() })
    });
  });

  test("should be able to bind to a websocket server", () => {
    wss = new WebSocketServer({ noServer: true });
    const handlers = {
      default: {
        ping: async ({ payload }: any) => {
          return { reply: `pong: ${payload.msg}` };
        }
      }
    };

    const adapter = bindWsAdapter(wss, contract, handlers);
    expect(adapter).toBeDefined();
    expect(typeof adapter.send).toBe("function");
  });
});