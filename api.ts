import jwt, { type JwtPayload } from "jsonwebtoken";

const validDFIps = ['51.222.245.229'];
let tokens = {} // uhh just an in memory token thingy nothing to see here... this ruins the point of jwt

function getKeyByValue(object, value) {
	return Object.keys(object).find(key => object[key] === value);
}

let endpoints = {
	// okay so input will be like token&asd=123,123,123&silly=456,456,456&meow=27,6,3
	"/api/v1/update/:input": (req: Request) => {
		const headers = req.headers.toJSON()
		if (!headers['x-forwarded-for'] || !validDFIps.includes(headers['x-forwarded-for'])) return new Response("Unauthorised");
		const splitInput = req.params.input.split('&')
		const token = splitInput[0]
		const plotId = getKeyByValue(tokens, token); // actually dont need to do this, decode the jwt token, then use that to index into tokens and check for equality
		if (!plotId) return new Response("Unauthorised");
		delete splitInput[0]
		
		const decoded = {}
		splitInput.forEach(function(value){
			const splitUser = value.split('=')[0]
			const userData = value.split('=')[1].split(',')
			decoded[splitUser] = {x: userData[0], y: userData[1], z: userData[2]}
		});
		
		console.log(`update req from ${plotId}: ${decoded}`)
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
		
		const secretKey = process.env.JWT_SECRET || "asd";
		if (!secretKey || !plotId) return new Response("some serverside error")
		const token = jwt.sign({ id: plotId }, secretKey, {expiresIn: "14d"}); // generate the token for the plotId (should maybe have expiration or secondary validation)
		tokens[plotId] = token
		return new Response(`${token}|1`); // `token|latest api version` easily like... usable format on dfside
	},
}

export default {endpoints}