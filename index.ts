import infoPage from "./public/index.html";
import type { Server } from "bun";
import api from './api'

if (!process.env.JWT_SECRET) {console.warn("missing JWT_SECRET from .env file, please go make that :3");process.abort();}

console.log("running on http://localhost:8008")

const server: Server = Bun.serve({
	port: 8008,
	routes: {
		"/": infoPage,
		"/health": new Response("OK"),
		"/other": (req: Request) => {
			console.log(api.counter.toString())
			return new Response(api.counter.toString());
		},
		...api.endpoints
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