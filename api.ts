const validDFIps = ['51.222.245.229'];

let endpoints = {
	// okay so input will be like token&asd=123,123,123&silly=456,456,456&meow=27,6,3
	"/api/v1/update/:input": (req: Request) => {
		console.log(req.params.input)
		return new Response(`${req.params.input}`);
	},
	"/api/v1/init": (req: Request) => {
		const headers = req.headers.toJSON()
		if (!headers['x-forwarded-for'] || !validDFIps.includes(headers['x-forwarded-for']) || !headers['user-agent']) return new Response("Unauthorised");

		console.log(headers)

		const matches = headers['user-agent'].match(/Hypercube\/([\d.]+) \((\d+), (.*)\)/) || [];
		const plotId = matches[2];

		return new Response(`Hello, ${plotId}!`);
	},
}

export default {endpoints}