export const apiFetch = async <T>(
	path: string,
	options: RequestInit = {},
	token?: string | null
) => {
	const response = await fetch(`${APP_API_URL}${path}`, {
		cache: "no-store",
		...options,
		headers: {
			"Content-Type": "application/json",
			...(token ? { Authorization: token } : {}),
			...(options.headers || {}),
		},
	});

	if (!response.ok) {
		let message = `Request failed with status ${response.status}`;
		try {
			const body = await response.json();
			message = body.message || message;
		} catch (error) {
			// ignore parse failure
		}
		throw new Error(message);
	}

	if (response.status === 204) {
		return null as T;
	}

	return (await response.json()) as T;
};
