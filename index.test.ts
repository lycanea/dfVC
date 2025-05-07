import { expect, test, beforeAll, afterAll } from "bun:test";
import type { Server } from "bun";

let server: Server;

beforeAll(async () => {
	try {
		const indexModule = await import("./index");
		server = (indexModule as any).server;
		if (!server) {
			console.warn("Server instance not exported from index.ts. Tests might fail to clean up.");
		}
	} catch (error) {
		console.error("Failed to import or start server from index.ts:", error);
		throw error;
	}
});

afterAll(async () => {
	if (server) {
		server.stop();
	}
});

test("GET / should return 200", async () => {
	const res = await fetch("http://localhost:8008/");
	expect(res.status).toBe(200);
});

test("GET /test should return OK", async () => {
	const res = await fetch("http://localhost:8008/test");
	expect(res.status).toBe(200);
	expect(await res.text()).toBe("OK");
});

test("websocket should echo messages", async () => {
	const ws = new WebSocket("ws://localhost:8008/");
	await new Promise((resolve, reject) => {
		ws.onopen = resolve;
		ws.onerror = reject;
	});

	const message = "Hello WebSocket!";
	ws.send(message);

	await new Promise<void>((resolve) => {
		ws.onmessage = (event) => {
			expect(event.data).toBe(message);
			resolve();
		};
	});

	ws.close();
});
