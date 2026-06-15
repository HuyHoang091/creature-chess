export const claimEventReward = async (token: string, eventId: string, taskId: string) => {
	const response = await fetch(`${APP_API_URL}/events/claim`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${token}`,
		},
		body: JSON.stringify({ eventId, taskId }),
	});

	if (!response.ok) {
		const data = await response.json().catch(() => null);
		throw new Error(data?.message || "Failed to claim reward");
	}

	return response.json();
};
