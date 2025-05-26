import { logger } from '.';
import api from './api';

export const websocketHandlers = {
	async message(ws: any, message: string | Buffer) {
		if (!ws.data.authed) {
			// Expecting auth message as JSON: { type: "auth", roomId, userId }
			if (typeof message !== "string") {
				logger("Received non-string message before auth");
				ws.send(JSON.stringify({ type: "auth", status: "fail" }));
				return;
			}
			try {
				const msg = JSON.parse(message);
				if (msg.type !== "auth" || !msg.roomId || !msg.userId) {
					ws.send(JSON.stringify({ type: "auth", status: "fail" }));
					return;
				}
				const auth = api.connect(msg.roomId, msg.userId, ws);
				if (!auth) {
					ws.send(JSON.stringify({ type: "auth", status: "fail" }));
					ws.close();
					return;
				}
				logger(`WebSocket connected: ${msg.userId} in room ${msg.roomId}`);
				ws.send(JSON.stringify({ type: "auth", status: "success" }));
				ws.data.roomId = msg.roomId;
				ws.data.userId = msg.userId;
				ws.data.authed = true;
			} catch (error) {
				logger("Error processing auth message: " + error);
				ws.send(JSON.stringify({ type: "auth", status: "fail" }));
			}
			return;
		}

		// Handle audio data (binary or base64)
		if (Buffer.isBuffer(message)) {
			// Process audio data here if needed
			const processedAudio = message; // Replace with actual processing

			// Broadcast to other clients in the same room
			const players = api.rooms[ws.data.roomId];
			if (Array.isArray(players)) {
				for (const player of players) {
					if (player.connected && player.websocket && player.websocket.readyState === player.websocket.OPEN) {
						player.websocket.send(processedAudio);
					}
				}
			}
		}
	},
	open(ws: any) {
		ws.send(JSON.stringify({ type: "auth", status: "wait" }));
		ws.data = { authed: false };

		ws.data.intervalId = setInterval(() => {
			if (ws.readyState === ws.OPEN && ws.data.authed) {
				const muted = api.getUser(ws.data.roomId, ws.data.userId, false)?.mutedServerside;
				ws.send(JSON.stringify({ type: "muted", value: muted !== undefined ? muted : "undefined" }));
			}
		}, 1000);
	},
	close(ws: any) {
		if (ws.data.authed) {
			logger(`WebSocket disconnected: ${ws.data.userId} from room ${ws.data.roomId}`);
			api.disconnect(ws.data.roomId, ws.data.userId);
		}
		clearInterval(ws.data.intervalId);
	},
};