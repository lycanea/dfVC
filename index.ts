if (!process.env.JWT_SECRET) {console.warn("missing JWT_SECRET from .env file, please go make that :3");process.abort();}

import infoPage from "./public/index.html";
import voicePage from "./public/voice.html";
const clientJs = await Bun.file("./public/client.js").text(); // Load the client.js file
import type { Server } from "bun";
import api from './api';
import { websocketHandlers } from './websocket';
import { appendFile } from "node:fs";

let logLines: string[] = [];
const LOG_FILE = "./server.log";

const logger = (message: string) => {
	if (logLines.length >= 100) {
		logLines.shift();
	}
	logLines.push(message);

	// Bun.write(LOG_FILE, message + "\n", { mode: "a" });
	appendFile(LOG_FILE, message + "\n", err => {
		if (err) throw err;
	});
}

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
	const consoleHeight = process.stdout.rows || 24;
	console.log("\nRecent Logs:");
	const headerLines = 7 + Object.keys(api.rooms).length; // 6 lines before logs + 1 per room
	const availableLogLines = Math.max(consoleHeight - headerLines, 0);
	const logsToShow = logLines.slice(-availableLogLines).reverse();
	for (const line of logsToShow) {
		console.log(line);
	}
}

setInterval(printStatus, 500);
logger("Started Server");
export { server, logger };