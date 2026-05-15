import jwt = require("jsonwebtoken");
import jwksClient = require("jwks-rsa");

function makeClient() {
	const { AUTH0_DOMAIN } = process.env;

	if (!AUTH0_DOMAIN) {
		throw new Error("AUTH0_DOMAIN is not set");
	}

	return jwksClient({
		cache: true,
		rateLimit: true,
		jwksRequestsPerMinute: 5,
		jwksUri: `https://${AUTH0_DOMAIN}/.well-known/jwks.json`,
	});
}

const client = makeClient();

interface JWTPayload {
	sub: string;
	aud?: string | string[];
	iss?: string;
}

interface DecodedToken {
	header: jwt.JwtHeader;
	payload: JWTPayload;
}

const verifyToken = async (token: string, publicKey: string) =>
	new Promise<JWTPayload>((resolve, reject) => {
		const { AUTH0_DOMAIN, AUTH0_API_AUDIENCE } = process.env;
		const issuer = AUTH0_DOMAIN ? `https://${AUTH0_DOMAIN}/` : undefined;

		jwt.verify(
			token,
			publicKey,
			{
				algorithms: ["RS256"],
				issuer,
				...(AUTH0_API_AUDIENCE ? { audience: AUTH0_API_AUDIENCE } : {}),
			},
			(err, payload) => {
			if (err) {
				reject(err);
				return;
			}

			resolve(payload as JWTPayload);
			}
		);
	});

export const verifyDecodeJwt = async (token: string) => {
	try {
		const dtoken: DecodedToken | null = (jwt.decode(token, {
			complete: true,
		}) || null) as DecodedToken | null;

		if (dtoken === null) {
			console.log("jwt.decode failed");
			return null;
		}

		const key = await client.getSigningKey(dtoken.header.kid);
		const publicKey = key.getPublicKey();

		const decoded = await verifyToken(token, publicKey);

		return decoded;
	} catch (err) {
		console.log(err);
		return null;
	}
};
