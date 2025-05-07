import jwt, { type JwtPayload } from "jsonwebtoken";

const validDFIps = ['51.222.245.229'];
let tokens = {} // uhh just an in memory token thingy nothing to see here... this ruins the point of jwt

let endpoints = {
	// okay so input will be like token&asd=123,123,123&silly=456,456,456&meow=27,6,3
	"/api/v1/update/:input": (req: Request) => {
		console.log(req.params.input)
		return new Response(`${req.params.input}`);
	},
	"/api/v1/init": (req: Request) => {
		const headers = req.headers.toJSON()
		if (!headers['x-forwarded-for'] || !validDFIps.includes(headers['x-forwarded-for']) || !headers['user-agent']) return new Response("Unauthorised");
		// should be secure if behind a proxy
		console.log(headers)

		const matches = headers['user-agent'].match(/Hypercube\/([\d.]+) \((\d+), (.*)\)/) || [];
		const plotId = matches[2];
		
		const secretKey = process.env.JWT_SECRET;
		if (!secretKey || !plotId) return new Response("some serverside error")
		const token = jwt.sign({ id: plotId }, secretKey, {expiresIn: "14d"}); // generate the token for the plotId (should maybe have expiration or secondary validation)
		token[plotId] = token
		return new Response(`${token}|1`); // `token|latest api version` easily like... usable format on dfside
	},
}

export default {endpoints}