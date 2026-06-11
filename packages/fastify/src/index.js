import { createValidator, generateHtml } from "@socketdocs/core";
export function serveFastifyDocs(fastify, contract, path = "/docs") {
    const spec = contract.generateSpec();
    const html = generateHtml(spec);
    fastify.get(path, async (_request, reply) => {
        reply.type("text/html").send(html);
    });
    fastify.get(`${path}/spec`, async (_request, reply) => {
        reply.type("application/json").send(spec);
    });
}
export function bindFastifyAdapter(fastify, contract, handlers, opts) {
    fastify.get("/ws", { websocket: true }, async (connection, request) => {
        let authCtx = null;
        if (opts?.onAuth) {
            try {
                authCtx = await opts.onAuth(connection, request);
            }
            catch (_err) {
                connection.close(1008, "Unauthorized");
                return;
            }
        }
        connection.on("message", async (data) => {
            try {
                const message = JSON.parse(data.toString());
                const { event: eventName, namespace: nsName = "default", id: messageId } = message;
                let { payload } = message;
                const ns = contract._namespaces.get(nsName);
                if (!ns)
                    return;
                const eventDef = ns.events.get(eventName);
                if (!eventDef)
                    return;
                if (eventDef.direction === "client_to_server" || eventDef.direction === "bidirectional") {
                    const validator = createValidator(eventDef);
                    // Validation
                    const result = validator.validate(payload);
                    if (!result.success) {
                        if (messageId) {
                            connection.send(JSON.stringify({
                                event: "error",
                                id: messageId,
                                payload: { code: 400, message: "Invalid payload", details: result.error }
                            }));
                        }
                        return;
                    }
                    payload = result.data;
                    // Auth
                    if (eventDef.authRequired && !authCtx) {
                        if (messageId) {
                            connection.send(JSON.stringify({
                                event: "error",
                                id: messageId,
                                payload: { code: 401, message: "Unauthorized" }
                            }));
                        }
                        return;
                    }
                    if (eventDef.roles && eventDef.roles.length > 0) {
                        const ok = eventDef.roles.some((r) => authCtx?.roles?.includes(r));
                        if (!ok) {
                            if (messageId) {
                                connection.send(JSON.stringify({
                                    event: "error",
                                    id: messageId,
                                    payload: { code: 403, message: "Forbidden" }
                                }));
                            }
                            return;
                        }
                    }
                    // Handler
                    const nsHandlers = handlers[nsName] || handlers["default"];
                    if (nsHandlers && nsHandlers[eventName]) {
                        const response = await nsHandlers[eventName]({ payload, connection, authCtx });
                        if (response && messageId) {
                            connection.send(JSON.stringify({
                                event: `${eventName}_response`,
                                id: messageId,
                                payload: response
                            }));
                        }
                    }
                }
            }
            catch (err) {
                console.error("[SocketDocs] Error processing message:", err);
            }
        });
    });
}
