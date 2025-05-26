import jwt, { type JwtPayload } from "jsonwebtoken";

interface PlayerData {
	position?: {x: number, y: number, z: number};
	name?: string;
	mutedServerside?: boolean;
	connected: boolean;
	canHear?: string[]; //array of ids of other players they can hear
	broadcastTo?: string[]; //array of ids of other players that can hear this player globally
	websocket?: any;
}
interface RoomData {
	[key: string]: PlayerData;
}
type Rooms = {
	[plotId: string]: RoomData
}
interface Api {
	rooms: Rooms;
	endpoints: any;
	newRoom(roomId: string): {};
	getUser(roomId: string, userId: string, createIfNot?: boolean): PlayerData | undefined;
	updateUserPosition(roomId: string, user: string, position: {}): void;
	updateUsername(roomId: string, userId: string, name: string): void;
	setMuted(roomId: string, userId: string, muted: boolean): void;
	connect(roomId: string, userId: string, websocket: any): boolean;
	disconnect(roomId: string, userId: string): boolean;
}

const validDFIps = ['51.222.245.229'];
let tokens: {[key: string]: string} = {} // uhh just an in memory token thingy nothing to see here... this ruins the point of jwt
const jwt_token: string | undefined = process.env.JWT_SECRET
if (!jwt_token) {console.warn("invalid JWT_SECRET");process.abort();}

let endpoints = {
	"/api/v1/update/:input": (req: Request & {params: {input: string}}) => {
		const headers = req.headers.toJSON()
		if (!headers['x-forwarded-for'] || !validDFIps.includes(headers['x-forwarded-for'])) return new Response("Unauthorised");
		//request from df
		const splitInput: string[] = req.params.input.split('&')
		const token: string | undefined = splitInput[0]
		if (!token) return new Response("Unauthorised");
		//request with a token
		const tokenValidation: JwtPayload | string = jwt.verify(token, jwt_token);
		if (typeof tokenValidation === 'string' || tokenValidation instanceof String) return new Response("error parsing token");
		// request with valid token
		const plotId: string = tokenValidation.id
		if (!(token == tokens[plotId])) return new Response("Unauthorised"); // if token is valid but isnt in the tokens object then yk... die
		// request with valid and correct token
		delete splitInput[0]
		
		// iterate over all the players in the request
		splitInput.forEach(function(value: string){
			const splitUser: string | undefined = value.split('=')[0]
			if (!splitUser) return; //if no user... somehow, then uhhh skip this index (appease the typescript gods)
			const userData: string[] | undefined = value.split('=')[1]?.split(',')
			if (!userData) return; // the... other check thing i fucking hate typescript maybe idk there has to be a better way to do this, this has like 100 if statement checks for not undefined in it so far
			let processedUserData: {[key: string]: string} = {}
			userData.forEach(function(data: string){
				const key: string[] | undefined = data.split(':');
				if (!key || !key[0] || !key[1]) return;
				processedUserData[key[0]] = key[1];
			});

			// data is now processed
			// 0=x, 1=y, 2=z, 3=name, 4=muted

			if (processedUserData[0] && processedUserData[1] && processedUserData[2]) api.updateUserPosition(plotId, splitUser, {x: parseFloat(processedUserData[0]), y: parseFloat(processedUserData[1]), z: parseFloat(processedUserData[2])});
			if (processedUserData[3]) api.updateUsername(plotId, splitUser, processedUserData[3]);
			if (processedUserData[4]) api.setMuted(plotId, splitUser, processedUserData[4] == "true" || processedUserData[4] == "1");
		});
		
		console.log(`update req from ${plotId}`)
		return new Response();
	},
	"/api/v1/init": (req: Request) => {
		const headers = req.headers.toJSON()
		if (!headers['x-forwarded-for'] || !validDFIps.includes(headers['x-forwarded-for']) || !headers['user-agent']) return new Response("Unauthorised");
		// should be secure if behind a proxy

		const matches = headers['user-agent'].match(/Hypercube\/([\d.]+) \((\d+), (.*)\)/) || []; // `Hypercube/7.2 (100, asd)` is valid
		const plotId = matches[2];
		
		const secretKey = process.env.JWT_SECRET;
		if (!secretKey || !plotId) return new Response("some serverside error")
		const token = jwt.sign({ id: plotId }, secretKey, {expiresIn: "14d"}); // generate the token for the plotId (should maybe have expiration or secondary validation)
		tokens[plotId] = token
		api.newRoom(plotId)
		return new Response(`${token}|1`); // `token|latest api version` easily like... usable format on dfside
	},
}

const api: Api = {
	rooms: {"100": {"playerUUID": {"connected": false, "position": {"x": 0, "y": 0, "z": 0}, "name": "asd"}}},
	endpoints: endpoints,
	newRoom (roomId: string): {} {
		api.rooms[roomId] = {}
		return api.rooms[roomId];
	},
	getUser (roomId: string, userId: string, createIfNot?: boolean): PlayerData | undefined {
		let targetRoom = api.rooms[roomId]; if (!targetRoom) if (createIfNot) targetRoom = api.newRoom(roomId); else return undefined; // gets room, creates if doesnt exist
		let user = targetRoom[userId]; if (!user && createIfNot) user = targetRoom[userId] = {"connected": false};
		return user
	},
	updateUserPosition (roomId: string, userId: string, position: {x: number, y: number, z: number}) {
		let user = api.getUser(roomId, userId, true);
		if (user) user["position"] = position
	},
	updateUsername (roomId: string, userId: string, name: string) {
		let user = api.getUser(roomId, userId, true);
		if (user) user["name"] = name
	},
	setMuted (roomId: string, userId: string, muted: boolean) {
		let user = api.getUser(roomId, userId, true);
		if (user) user['mutedServerside'] = muted
	},
	connect (roomId: string, userId: string, websocket: any) {
		let user = api.getUser(roomId, userId, false);
		if (!user) return false;
		user['connected'] = true;
		user['websocket'] = websocket;
		return true;
	},
	disconnect (roomId: string, userId: string) {
		let user = api.getUser(roomId, userId, false);
		if (!user) return false;
		user['connected'] = false;
		user['websocket'] = undefined;
		return true
	}
}

export default api