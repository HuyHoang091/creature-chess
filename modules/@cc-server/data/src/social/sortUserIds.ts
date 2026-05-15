export const sortUserIds = (userA: string, userB: string) =>
	userA < userB ? [userA, userB] : [userB, userA];
