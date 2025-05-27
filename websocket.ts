import type { ServerWebSocket } from 'bun';
import { logger } from '.';
import api from './api';

export const websocketHandlers = {
	async message(ws: ServerWebSocket, message: string | Buffer) {
		if (!ws.data.authed) {
			// Expecting auth message as JSON: { type: "auth", roomId, userId }
			logger("Received message before auth: " + message);
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

		if (Buffer.isBuffer(message)) {
			const players = api.rooms[ws.data.roomId];
			if (!players) {
				logger("Players object is undefined for room: " + ws.data.roomId);
				return;
			}
			const self = players[ws.data.userId];
			if (self?.mutedServerside) {
				return;
			}
			if (players && typeof players === "object") {
				for (const playerId in players) {
					const player = players[playerId];
					if (
						player &&
						ws.data &&
						player.connected &&
						player.websocket &&
						player.websocket.readyState === 1 &&
						playerId !== ws.data.userId
					) {
						if (self?.broadcastTo?.includes(playerId)) {
							player.websocket.send(message);
							continue;
						}

						let playerPosition = player.position || { x: 0, y: 0, z: 0 };
						let selfPosition = self.position || { x: 0, y: 0, z: 0 };

						let distance = Math.sqrt(
							Math.pow(playerPosition.x - selfPosition.x, 2) +
							Math.pow(playerPosition.y - selfPosition.y, 2) +
							Math.pow(playerPosition.z - selfPosition.z, 2)
						);

						const maxDistance = 15;
						if (distance > maxDistance) {
							continue;
						}

						let processed = Buffer.allocUnsafe(message.length);
						let falloff = 1 - distance / maxDistance;
						logger(falloff.toString())
						for (let i = 0; i < processed.length; i += 2) {
							let sample = message.readInt16LE(i);
							let adjustedSample = sample * falloff;
							processed.writeInt16LE(Math.max(Math.min(adjustedSample, 32767), -32768), i);
						}

						player.websocket.send(processed);
					}
				}
			}
		}
	},
	open(ws: ServerWebSocket) {
		ws.send(JSON.stringify({ type: "auth", status: "wait" }));
		ws.data = { authed: false };

		ws.data.intervalId = setInterval(() => {
			if (ws.readyState === ws.OPEN && ws.data.authed) {
				const muted = api.getUser(ws.data.roomId, ws.data.userId, false)?.mutedServerside;
				ws.send(JSON.stringify({ type: "muted", value: muted !== undefined ? muted : "undefined" }));
			}
		}, 1000);
	},
	close(ws: ServerWebSocket) {
		if (ws.data.authed) {
			logger(`WebSocket disconnected: ${ws.data.userId} from room ${ws.data.roomId}`);
			api.disconnect(ws.data.roomId, ws.data.userId);
		}
		clearInterval(ws.data.intervalId);
	},
};