const http = require("http");
const { WebSocketServer, WebSocket } = require("ws");

const rooms = new Map();
const port = Number(process.env.PORT || 8080);

const server = http.createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify({ ok: true, service: "monto-signaling", rooms: rooms.size }));
});

const wss = new WebSocketServer({ server, path: "/ws/call" });

wss.on("connection", (socket, request) => {
  const url = new URL(request.url, "http://localhost");
  const role = url.searchParams.get("role");
  const roomId = url.searchParams.get("room") || "monto-room";
  if (role !== "child" && role !== "parent") return socket.close(1008, "invalid role");

  const room = rooms.get(roomId) || { child: null, parent: null };
  const previous = room[role];
  if (previous && previous.readyState === WebSocket.OPEN) previous.close(1000, "replaced");
  room[role] = socket;
  rooms.set(roomId, room);
  const peerRole = role === "child" ? "parent" : "child";
  const peer = room[peerRole];
  if (peer?.readyState === WebSocket.OPEN) {
    peer.send(JSON.stringify({ type: "peer-online", role }));
    socket.send(JSON.stringify({ type: "peer-online", role: peerRole }));
  }

  socket.on("message", data => {
    const target = room[peerRole];
    if (target?.readyState === WebSocket.OPEN) target.send(data.toString());
    else {
      try {
        if (JSON.parse(data.toString()).type === "ring") {
          socket.send(JSON.stringify({ type: "error", message: "Parent app is not connected. Open the parent app first." }));
        }
      } catch {}
    }
  });

  socket.on("close", () => {
    if (room[role] === socket) room[role] = null;
    const target = room[peerRole];
    if (target?.readyState === WebSocket.OPEN) target.send(JSON.stringify({ type: "peer-offline", role }));
    if (!room.child && !room.parent) rooms.delete(roomId);
  });
});

server.listen(port, "0.0.0.0", () => console.log(`Monto signaling listening on ${port}`));
