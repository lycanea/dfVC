if (!process.env.JWT_SECRET) {console.warn("missing JWT_SECRET from .env file, please go make that :3");process.abort();}

import infoPage from "./public/index.html";
import voicePage from "./public/voice.html";
const clientJs = await Bun.file("./public/client.js").text(); // Load the client.js file
import type { Server } from "bun";
import api from './api';
import { websocketHandlers } from './websocket';

console.log("running on http://localhost:8008");

const server: Server = Bun.serve({
	port: 8008,
	routes: {
		"/": infoPage,
		"/voice": voicePage,
		"/client": new Response(clientJs, { headers: { "Content-Type": "application/javascript" } }), // Serve the actual client.js content
		"/health": new Response("OK"),
		...api.endpoints
	},

	fetch(req, server) {
		if (server.upgrade(req)) {
			return;
		}
		return new Response("Upgrade failed", { status: 500 });
	},
	websocket: websocketHandlers,
});

function printStatus() {
	console.clear();
	console.log("=== Server Status ===");
	console.log("Listening on http://localhost:8008");
	console.log("Connected WebSockets:", server.pendingWebSockets);
	console.log("Active Rooms:", Object.keys(api.rooms).length);

	for (const [roomName, room] of Object.entries(api.rooms)) {
		const coloredUsers: string[] = [];
		for (const [userId, user] of Object.entries(room)) {
			if (user.connected) {
				coloredUsers.push(`\x1b[32m${userId}\x1b[0m`);
			} else {
				coloredUsers.push(`\x1b[90m${userId}\x1b[0m`);
			}
		}
		console.log(`Room "${roomName}":`, coloredUsers.join(", "));
	}
}

setInterval(printStatus, 2000);


export { server };