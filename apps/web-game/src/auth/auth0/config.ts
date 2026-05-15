export const AUTH0_ENABLED = APP_AUTH0_ENABLED === "true";
export const AUTH0_API_AUDIENCE = APP_AUTH0_API_AUDIENCE || "";

export const auth0Config = {
	domain: APP_AUTH0_DOMAIN,
	clientID: APP_AUTH0_SPA_CLIENT_ID,
	redirectUri: APP_URL,
	audience: AUTH0_API_AUDIENCE || undefined,
	scope: "openid profile email",
};
