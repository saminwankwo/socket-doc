import { createContract } from "../src/contract.js";
import { bindFastifyAdapter } from "../../fastify/src/index.js";
import { z } from "zod";

describe("FastifyAdapter", () => {
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

  test("should define bind function", () => {
    expect(bindFastifyAdapter).toBeDefined();
  });
});
