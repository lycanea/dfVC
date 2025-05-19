if (!process.env.JWT_SECRET) {console.warn("missing JWT_SECRET from .env file, please go make that :3");process.abort();}

import infoPage from "./public/index.html";
import type { Server } from "bun";
import api from './api'

console.log("running on http://localhost:8008")

const server: Server = Bun.serve({
	port: 8008,
	routes: {
		"/": infoPage,
		"/health": new Response("OK"),
		...api.endpoints
	},

	fetch(req, server) {
		if (server.upgrade(req)) {
			return;
		}
		return new Response("Upgrade failed", { status: 500 });
	},
	websocket: {
		async message(ws, message) {
			if (ws.data.authed) {
				return;
			}
			try {
				const [roomId, userId] = String(message).split(',');
				if (!roomId || !userId) {
					ws.send("auth fail");
					return;
				}
				const auth = api.connect(roomId, userId, ws)
				if (!auth) {
					ws.send("auth fail")
					ws.close()
				}
				ws.send("auth success");
				ws.data.roomId = roomId;
				ws.data.userId = userId;
				ws.data.authed = true;
			} catch (error) {
				console.error("Error processing message:", error);
				ws.send("auth fail");
			}
		},
		open(ws) {
			console.log("websocket connection opened")
			ws.send("auth wait");
			ws.data = { authed: false };
		},
		close(ws) {
			console.log("websocket connection closed")
			if (ws.data.authed) {
				api.disconnect(ws.data.roomId, ws.data.userId)
			}
		},
	},
});

export { server };