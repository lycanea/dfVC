import api from './api';

export const websocketHandlers = {
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
			const auth = api.connect(roomId, userId, ws);
			if (!auth) {
				ws.send("auth fail");
				ws.close();
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
		ws.send("auth wait");
		ws.data = { authed: false };

		ws.data.intervalId = setInterval(() => {
			if (ws.readyState === WebSocket.OPEN) {
				if (ws.data.authed) {
					const muted = api.getUser(ws.data.roomId, ws.data.userId, false)?.mutedServerside;
					ws.send(muted !== undefined ? String(muted) : "undefined");
				}
			}
		}, 1000);
	},
	close(ws) {
		if (ws.data.authed) {
			api.disconnect(ws.data.roomId, ws.data.userId);
		}
		clearInterval(ws.data.intervalId);
	},
};