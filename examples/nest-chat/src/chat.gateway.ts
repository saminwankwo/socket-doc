import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import { SocketEvent } from "@socketdocs/nestjs";
import type { Server, Socket } from "socket.io";
import { z } from "zod";

/**
 * A gateway with two message handlers:
 *
 * - `send_message` is enriched with `@SocketEvent` (schemas, errors, tags).
 * - `join_room` has no decorator: SocketDocs still discovers its name and
 *   direction from the `@SubscribeMessage` metadata at startup.
 *
 * The gateway exposes its Socket.IO namespace through `@WebSocketServer()`,
 * which lets SocketDocs sniff server -> client events such as `welcome`.
 */
@WebSocketGateway({ namespace: "/chat" })
export class ChatGateway {
  @WebSocketServer()
  server!: Server;

  handleConnection(client: Socket): void {
    // Server -> client event: discovered by sniffing, never declared.
    client.emit("welcome", { message: "connected to the chat gateway" });
  }

  @SubscribeMessage("send_message")
  @SocketEvent({
    summary: "Send a message to a room",
    description: "Broadcasts the message to everyone in the room as `new_message`.",
    payload: z.object({ text: z.string().min(1), roomId: z.string() }),
    response: z.object({ ok: z.boolean() }),
    errors: [{ code: "INVALID_ROOM", description: "Room does not exist" }],
    tags: ["chat"],
  })
  handleMessage(@MessageBody() data: { text: string; roomId: string }) {
    this.server.to(data.roomId).emit("new_message", { text: data.text });
    return { ok: true };
  }

  @SubscribeMessage("join_room")
  handleJoin(@MessageBody() data: { roomId: string }, @ConnectedSocket() client: Socket) {
    const roomId = data?.roomId ?? "lobby";
    client.join(roomId);
    return { joined: roomId };
  }
}
