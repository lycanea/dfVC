import jwt, { type JwtPayload } from "jsonwebtoken";

interface PlayerData {
	x?: number;
	y?: number;
	z?: number;
	name?: string;
	mutedServerside?: boolean;
	connected: boolean;
	canHear?: string[]; //array of ids of other players they can hear
	broadcastTo?: string[]; //array of ids of other players that can hear this player globally

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
	getUser(roomId: string, userId: string): {connected: boolean, position?: {x: number, y: number, z: number}};
	updateUserPosition(roomId: string, user: string, position: {}): void;
}

const validDFIps = ['51.222.245.229'];
let tokens: {[key: string]: string} = {} // uhh just an in memory token thingy nothing to see here... this ruins the point of jwt
const jwt_token: string | undefined = process.env.JWT_SECRET
if (!jwt_token) {console.warn("invalid jwt_token");process.abort();}

let endpoints = {
	// okay so input will be like token&asd=123,123,123&silly=456,456,456&meow=27,6,3
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
		// request with valid valid
		const plotId: string = tokenValidation.id
		if (!(token == tokens[plotId])) return new Response("Unauthorised"); // if token isnt valid and isnt in the tokens object then yk... die
		// request with valid and correct token
		delete splitInput[0]
		
		// iterate over all the players in the request
		const decoded: {[key: string]: {x: number, y: number, z: number}}  = {}
		splitInput.forEach(function(value: string){
			const splitUser: string | undefined = value.split('=')[0]
			if (!splitUser) return; //if no user... somehow, then uhhh skip this index (appease the typescript gods)
			const userData: string[] | undefined = value.split('=')[1]?.split(',')
			if (!userData || !userData[0] || !userData[1] || !userData[2]) return; // the... other check thing i fucking hate typescript maybe idk there has to be a better way to do this, this has like 100 if statement checks for not undefined in it so far
			decoded[splitUser] = {x: parseFloat(userData[0]), y: parseFloat(userData[1]), z: parseFloat(userData[2])}
			api.updateUserPosition(plotId, splitUser, {x: parseFloat(userData[0]), y: parseFloat(userData[1]), z: parseFloat(userData[2])})
		});
		
		console.log(`update req from ${plotId}`)
		console.log(decoded)
		return new Response();
	},
	"/api/v1/init": (req: Request) => {
		const headers = req.headers.toJSON()
		if (!headers['x-forwarded-for'] || !validDFIps.includes(headers['x-forwarded-for']) || !headers['user-agent']) return new Response("Unauthorised");
		// should be secure if behind a proxy
		console.log(headers)

		const matches = headers['user-agent'].match(/Hypercube\/([\d.]+) \((\d+), (.*)\)/) || [];
		// console.log(matches)
		const plotId = matches[2];
		
		const secretKey = process.env.JWT_SECRET;
		if (!secretKey || !plotId) return new Response("some serverside error")
		const token = jwt.sign({ id: plotId }, secretKey, {expiresIn: "14d"}); // generate the token for the plotId (should maybe have expiration or secondary validation)
		tokens[plotId] = token
		return new Response(`${token}|1`); // `token|latest api version` easily like... usable format on dfside
	},
}

const api: Api = {
	rooms: {"asd": {"asd": {"connected": false}}},
	endpoints: endpoints,
	newRoom (roomId: string): {} {
		api.rooms[roomId] = {}
		return api.rooms[roomId];
	},
	getUser (roomId: string, userId: string): {connected: boolean, position?: {x: number, y: number, z: number}} {
		let targetRoom = api.rooms[roomId]; if (!targetRoom) targetRoom = api.newRoom(roomId); // gets room, creates if doesnt exist
		let user = targetRoom[userId]; if (!user) user = targetRoom[userId] = {"connected": false};
		return user
	},
	updateUserPosition (roomId: string, userId: string, position: {x: number, y: number, z: number}) {
		let user = api.getUser(roomId, userId);
		user["position"] = position // does this work or is it like a reference to the user object or smth ifykwim??? idk test this later plz
	}
}

export default api