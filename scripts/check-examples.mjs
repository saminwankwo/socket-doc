#!/usr/bin/env node
/**
 * End-to-end smoke check for the example apps.
 *
 * Starts `examples/express-chat` on an ephemeral port, then:
 *   - asserts /socket-docs serves the UI and /socket-docs/spec.json is valid
 *   - asserts declared events are documented before any client connects
 *   - asserts undeclared events appear only after live traffic (sniffing)
 *   - asserts an ack-based event acknowledges the client
 *   - asserts a server -> client event is discovered as `server_to_client`
 *
 * Usage:  npm run check:examples     (requires `npm run build` first)
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { io as ioClient } from "socket.io-client";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const serverPath = join(root, "examples/express-chat/src/server.js");
const TOKEN = "demo-token";

const failures = [];
let checks = 0;

function check(label, condition, details) {
  checks += 1;
  const ok = Boolean(condition);
  console.log(`${ok ? "  ok  " : " FAIL "} ${label}${ok ? "" : details ? ` — ${details}` : ""}`);
  if (!ok) failures.push(label);
  return ok;
}

function assertEqual(label, actual, expected) {
  return check(label, actual === expected, `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

function waitFor(fn, timeoutMs = 10000, intervalMs = 100) {
  const start = Date.now();
  return (async () => {
    for (;;) {
      let value;
      try {
        value = await fn();
      } catch {
        value = undefined;
      }
      if (value !== undefined) return value;
      if (Date.now() - start > timeoutMs) throw new Error(`timed out after ${timeoutMs}ms`);
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
  })();
}

async function fetchSpec(baseUrl) {
  const res = await fetch(`${baseUrl}/socket-docs/spec.json`);
  if (!res.ok) throw new Error(`spec.json responded ${res.status}`);
  return res.json();
}

async function main() {
  // The example imports the built workspace packages.
  for (const artifact of [
    "packages/express/dist/index.js",
    "packages/express/ui-dist/index.html",
  ]) {
    if (!existsSync(join(root, artifact))) {
      throw new Error(`Missing ${artifact} — run \`npm run build\` in the repo root first.`);
    }
  }

  const server = spawn(process.execPath, [serverPath], {
    env: { ...process.env, PORT: "0", CHAT_TOKEN: TOKEN },
    stdio: ["ignore", "pipe", "pipe"],
  });

  let output = "";
  server.stdout.on("data", (chunk) => (output += chunk));
  server.stderr.on("data", (chunk) => (output += chunk));

  try {
    const port = await waitFor(() => {
      const match = output.match(/Chat server listening on http:\/\/localhost:(\d+)/);
      return match ? Number(match[1]) : undefined;
    }, 15000);
    const baseUrl = `http://127.0.0.1:${port}`;
    console.log(`express-chat listening on ${baseUrl}\n`);

    const spec = await waitFor(() => fetchSpec(baseUrl));

    // 1. UI + spec basics
    const page = await fetch(`${baseUrl}/socket-docs/`);
    check("UI is served at /socket-docs/", page.status === 200, `status ${page.status}`);
    check("UI serves an HTML page", (await page.text()).includes("<!DOCTYPE html>"));
    assertEqual("spec version", spec.specVersion, "1.0");
    assertEqual("spec title", spec.info.title, "Chat API");

    // 2. Declared events are documented before any client connects
    const chat = spec.namespaces["/chat"];
    check("declared namespace /chat exists", Boolean(chat));
    const sendMsg = chat?.events?.["send_message"];
    assertEqual("send_message source", sendMsg?.source, "declared");
    check("send_message has a payload schema", Boolean(sendMsg?.payloadSchema));
    check("send_message has a response schema", Boolean(sendMsg?.responseSchema));
    assertEqual(
      "send_message errors are documented",
      JSON.stringify(sendMsg?.errors),
      JSON.stringify([{ code: "INVALID_ROOM", description: "Room does not exist" }])
    );
    assertEqual("join_room kind", chat?.events?.["join_room"]?.kind, "request_response");
    check("undeclared `typing` is not documented yet", spec.namespaces["/"]?.events?.["typing"] === undefined);

    // 3. Sniffing: an undeclared event appears after live traffic
    const connect = (path) =>
      new Promise((resolve, reject) => {
        const client = ioClient(`${baseUrl}${path}`, {
          path: "/socket.io",
          transports: ["websocket"],
          auth: { token: TOKEN },
          reconnection: false,
        });
        const timer = setTimeout(() => reject(new Error(`client did not connect to ${path || "/"}`)), 8000);
        client.on("connect", () => {
          clearTimeout(timer);
          resolve(client);
        });
        client.on("connect_error", (err) => {
          clearTimeout(timer);
          reject(err);
        });
      });

    const socket = await connect(""); // default namespace

    socket.emit("typing", { roomId: "lobby" });
    const sniffed = await waitFor(async () => {
      const current = await fetchSpec(baseUrl);
      const event = current.namespaces["/"]?.events?.["typing"];
      return event?.source === "sniffed" ? event : undefined;
    });
    assertEqual("typing direction", sniffed.direction, "client_to_server");

    // 4. Ack-based event answers the client (on the /chat namespace)
    const chatClient = await connect("/chat");
    const ackResponse = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("no ack received")), 8000);
      chatClient.emit("join_room", { roomId: "general" }, (ack) => {
        clearTimeout(timer);
        resolve(ack);
      });
    });
    assertEqual("join_room ack payload", JSON.stringify(ackResponse), JSON.stringify({ joined: "general", members: 1 }));

    // 5. Server -> client event is discovered
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("no ack received for send_message")), 8000);
      chatClient.emit("send_message", { text: "hello from the smoke test", roomId: "general" }, (ack) => {
        clearTimeout(timer);
        resolve(ack);
      });
    });
    const pushed = await waitFor(async () => {
      const current = await fetchSpec(baseUrl);
      return current.namespaces["/chat"]?.events?.["new_message"];
    });
    assertEqual("new_message direction", pushed.direction, "server_to_client");
    assertEqual("new_message source", pushed.source, "sniffed");

    // 6. Handshake auth is enforced by the example server
    const rejected = await new Promise((resolve) => {
      const bad = ioClient(baseUrl, { path: "/socket.io", transports: ["websocket"], auth: { token: "wrong" }, reconnection: false });
      bad.on("connect_error", (err) => {
        bad.disconnect();
        resolve(String(err.message));
      });
      setTimeout(() => resolve(undefined), 8000);
    });
    check("wrong handshake token is rejected", typeof rejected === "string" && rejected.includes("unauthorized"), `got ${JSON.stringify(rejected)}`);

    socket.disconnect();
    chatClient.disconnect();
  } finally {
    server.kill("SIGTERM");
  }

  console.log(`\n${checks - failures.length}/${checks} checks passed`);
  if (failures.length > 0) {
    console.error(`Failed: ${failures.join(", ")}`);
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(`\ncheck-examples failed: ${err.stack ?? err}`);
  process.exitCode = 1;
});
