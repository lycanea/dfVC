import infoPage from "./public/index.html";
import type { Server } from "bun";

console.log("reload")

const server: Server = Bun.serve({
	port: 8008,
	routes: {
		"/": infoPage,
		"/test": new Response("OK")
	},

	fetch(req, server) {
		if (server.upgrade(req)) {
			return;
		}
		return new Response("Upgrade failed", { status: 500 });
	},
	websocket: {
		message(ws, message) {
			ws.send(message);
		}
	},
});

export { server };