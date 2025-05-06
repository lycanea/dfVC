const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

// honestly i think i should rewrite the whole backend based on this version cause this is just kind of a mess now
// imo the frontend serving, the api and the voicechat websocket server should be different files
// working with multiple files running async is weird though, api effects websocket and stuff so idk
// if rewrite, make it bun and typescript

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// { [roomId]: { [userId]: { socketId, position, connected, expiration } } }
const rooms = { 0: {} };
const validDFIps = ['51.222.245.229'];

const audioParams = {
	innerRadius: 0,
	outerRadius: 20,
	falloffExponent: 1.5
};
  
function computeDistance(a, b) {
	const dx = a.x - b.x,
		dy = a.y - b.y,
		dz = a.z - b.z;
	return Math.sqrt(dx*dx + dy*dy + dz*dz);
}

function computeVolume(distance) {
	const { innerRadius, outerRadius, falloffExponent } = audioParams;
	if (distance <= innerRadius) return 1;
	if (distance >= outerRadius) return 0;
	const t = (distance - innerRadius) / (outerRadius - innerRadius);
	return 1 - Math.pow(t, falloffExponent);
}

// Front-end routes
// Rooms list
app.get('/api/rooms', (req, res) => {
	res.json(Object.keys(rooms));
});
// the actual... yk... page
app.get('/:roomId/:userId', (req, res) => res.sendFile(path.join(__dirname, 'public', 'thingy.html')));


// DiamondFire position updates
app.post('/api/update', (req, res) => {
	if (!validDFIps.includes(req.headers['x-forwarded-for'])) return res.json({ error: 'Unauthorized' }); // check if its coming from df (this uses x-forwarded-for so will only work behind a proxy like nginx or caddy)
	// if (!validDFIps.includes(req.socket.remoteAddress)) return res.json({ error: 'Unauthorized' }); // this is the non proxy check (trigger this from config maybe)
	const ua = req.headers['user-agent'] || '';
	const matches = ua.match(/Hypercube\/([\d.]+) \((\d+), (.*)\)/) || []; // extract df ver, plotid, plot author from useragent
	const plotId = matches[2];
	const roomId = plotId;

	if (!rooms[roomId]) rooms[roomId] = {}; // make the room for the plot if it doesnt exist
	req.body.forEach(player => { // for each player in the included data from the plot
		const { id, position, username } = player; // extract out data into some vars
		if (!id || !position) return; // if important data is missing, skip
		if (rooms[roomId][id]) { // if the player exists in the room already, update the values and the expiration
			rooms[roomId][id].position = position;
			rooms[roomId][id].username = username || rooms[roomId][id].username;
			rooms[roomId][id].expiration = Date.now() + 5000;
		} else { // else, make the user, connected will equal false here
			rooms[roomId][id] = { connected: false, position, expiration: Date.now() + 5000, username: username || id };
		}
	});
	for (const [targetId, targetInfo] of Object.entries(rooms[roomId])) { // repeat over every player in the room
		if (!targetInfo.connected) continue; // skip ones that arent connected
		const volumes = {};
		const usernames = {};
		for (const [otherId, otherInfo] of Object.entries(rooms[roomId])) { // repeat over other player and calculate volume
			if (!otherInfo.connected || otherId === targetId) continue;
			const dist = computeDistance(targetInfo.position, otherInfo.position);
			volumes[otherId] = computeVolume(dist);
			usernames[otherId] = otherInfo.username;
		}
		io.to(targetInfo.socketId).emit('volume-update', volumes); // send over volume values to be used for clients
		usernames[targetId] = targetInfo.username;
		io.to(targetInfo.socketId).emit('username-update', usernames); // send over username data, dunno why im doing this here
	}
	res.json({ ok: true });
});

io.on('connection', socket => {
	socket.on('join', ({ roomId, userId }) => { // on initial connect
		const room = rooms[roomId];
		if (!room) return socket.emit('join-error', 'Room does not exist');
		let user = room[userId] ?? {}; // pretty much make the user if they dont exist
		if (!roomId === '0') { // if its not the bypass room, validate the user from df plot
			user = room[userId];
			if (!user || user.expiration < Date.now()) return socket.emit('join-error', 'User not validated or expired');
		} else { // else... just let them in no matter what
			room[userId] = user;
		}
		if (user.connected) return socket.emit('join-error', 'User ID already connected'); // deduplicate connected ids
		
		socket.join(roomId); // connect to the room-specific socket channel thingy
		room[userId].connected = true; // make them connected internally in their user state
		room[userId].socketId = socket.id; // store their socket id

		// Send only currently connected users
		const existingUsers = Object.entries(room) // pretty much just send all connected users
			.filter(([id, info]) => id !== userId && info.connected)
			.map(([id]) => id);
		socket.emit('all-users', existingUsers);

		if (!roomId === '0') { // if its no the bypass room, calculate and update volumes on the client using positions
			const volumes = {};
			for (const [otherId, otherInfo] of Object.entries(rooms[roomId])) {
				if (!otherInfo.connected) continue;
				const dist = computeDistance(user.position, otherInfo.position);
				volumes[otherId] = computeVolume(dist);
			}
			socket.emit('volume-update', volumes);
		}

		socket.to(roomId).emit('user-joined', userId); // let everyone know the new user joined
	});

	socket.on('signal', ({ roomId, targetId, callerId, signal }) => {
		const target = rooms[roomId]?.[targetId]; // this is p much just server middleware to facilitate peer connections
		if (target && target.connected) io.to(target.socketId).emit('signal', { callerId, signal });
	});

	socket.on('disconnecting', () => {
		for (const roomId of socket.rooms) { // this pretty much just removes the corresponding user, makes them not connected, and tells everyone they left
			const room = rooms[roomId];
			if (!room) continue;
			const entry = Object.entries(room).find(([, info]) => info.socketId === socket.id);
			if (!entry) continue;
			const [userId] = entry;
			room[userId].connected = false;
			//   room[userId].expiration = Date.now() + 5000;
			socket.to(roomId).emit('user-left', userId);
		}
	});
});

const PORT = process.env.PORT || 8008; // boob :3
server.listen(PORT, () => console.log(`Server listening on http://localhost:${PORT}`));
