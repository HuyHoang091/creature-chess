import React from "react";

import { useDispatch, useSelector } from "react-redux";
import {
	blockUser,
	fetchFriends,
	searchFriends,
	unblockUser,
} from "~/services/friendsApi";
import { reportPlayer, ReportReason } from "~/services/reportsApi";
import { socialEmit } from "~/services/socialSocket";
import { FriendsCommands } from "~/store/friends/state";
import { PrivateLobbyCommands } from "~/store/privateLobby/state";
import { AppState } from "~/store/state";

import styles from "./FriendsPage.module.css";

type PendingById = Record<string, boolean>;

const presenceLabel: Record<string, string> = {
	offline: "Offline",
	online: "Online",
	in_room: "In Room",
	in_game: "In Game",
};

export const FriendsPage = () => {
	const dispatch = useDispatch();
	const token = useSelector((state: AppState) => state.auth.accessToken);
	const authMode = useSelector((state: AppState) => state.auth.mode);
	const friendsState = useSelector((state: AppState) => state.friends);
	const currentRoom = useSelector((state: AppState) => state.privateLobby.room);
	const currentUserId = useSelector(
		(state: AppState) => state.profile.currentUser?.id
	);
	const requestJoinPending = useSelector(
		(state: AppState) => state.privateLobby.requestJoinPendingByUserId
	);
	const [query, setQuery] = React.useState("");
	const [pendingAdd, setPendingAdd] = React.useState<PendingById>({});
	const [pendingInvite, setPendingInvite] = React.useState<PendingById>({});
	const [pendingAccept, setPendingAccept] = React.useState<PendingById>({});
	const [pendingBlock, setPendingBlock] = React.useState<PendingById>({});
	const [pendingReport, setPendingReport] = React.useState<PendingById>({});
	const [reportReasons, setReportReasons] = React.useState<
		Record<string, ReportReason>
	>({});

	const refreshFriends = React.useCallback(async () => {
		if (!token || !currentUserId) {
			return;
		}

		const payload = await fetchFriends(token);
		dispatch(
			FriendsCommands.hydratePayload({
				...payload,
				userId: currentUserId,
			})
		);
	}, [currentUserId, dispatch, token]);

	React.useEffect(() => {
		if (!token || authMode !== "account") {
			return;
		}

		const shouldBootstrap =
			!!currentUserId &&
			(!friendsState.hydrated ||
				friendsState.hydratedForUserId !== currentUserId);

		if (shouldBootstrap) {
			dispatch(FriendsCommands.setLoading(true));
			fetchFriends(token)
				.then((payload) => {
					dispatch(
						FriendsCommands.hydratePayload({
							...payload,
							userId: currentUserId,
						})
					);
					dispatch(FriendsCommands.setError(null));
				})
				.catch((error) => {
					dispatch(FriendsCommands.setError((error as Error).message));
				})
				.finally(() => {
					dispatch(FriendsCommands.setLoading(false));
				});
		}

		socialEmit("socialBootstrap").catch(() => {
			// bootstrap http already loaded; realtime can recover later
		});
		socialEmit<{
			room: AppState["privateLobby"]["room"];
			invites: AppState["privateLobby"]["invites"];
		}>("roomGetSnapshot")
			.then((payload) => {
				dispatch(
					PrivateLobbyCommands.setSnapshot({
						room: payload.room,
						invites: payload.invites,
					})
				);
			})
			.catch(() => {
				// ignore room bootstrap failure here
			});
	}, [
		authMode,
		currentUserId,
		dispatch,
		friendsState.hydrated,
		friendsState.hydratedForUserId,
		token,
	]);

	const outgoingRequestUserIds = new Set(
		friendsState.outgoingRequests.map((item) => item.receiverUserId)
	);
	const friendUserIds = new Set(
		friendsState.friends.map((item) => item.userId)
	);
	const blockedUserIds = new Set(
		friendsState.blockedUsers.map((item) => item.userId)
	);

	const onSearch = async () => {
		if (!token || query.trim().length < 2) {
			return;
		}
		try {
			const response = await searchFriends(token, query.trim());
			dispatch(FriendsCommands.setSearchResults(response.results));
		} catch (error) {
			dispatch(FriendsCommands.setError((error as Error).message));
		}
	};

	const renderAction = (friend: AppState["friends"]["friends"][number]) => {
		if (friend.presence === "online" && currentRoom) {
			return (
				<button
					disabled={!!pendingInvite[friend.userId]}
					onClick={async () => {
						setPendingInvite((prev) => ({ ...prev, [friend.userId]: true }));
						try {
							await socialEmit("roomInvite", { targetUserId: friend.userId });
						} catch (error) {
							dispatch(FriendsCommands.setError((error as Error).message));
						} finally {
							setPendingInvite((prev) => ({ ...prev, [friend.userId]: false }));
						}
					}}
				>
					{pendingInvite[friend.userId] ? "Inviting..." : "Invite to Room"}
				</button>
			);
		}

		if (friend.presence === "in_room") {
			return (
				<button
					disabled={!!requestJoinPending[friend.userId]}
					onClick={async () => {
						dispatch(
							PrivateLobbyCommands.setRequestJoinPending({
								userId: friend.userId,
								value: true,
							})
						);
						try {
							await socialEmit("roomRequestJoin", {
								targetUserId: friend.userId,
							});
						} catch (error) {
							dispatch(FriendsCommands.setError((error as Error).message));
						} finally {
							dispatch(
								PrivateLobbyCommands.setRequestJoinPending({
									userId: friend.userId,
									value: false,
								})
							);
						}
					}}
				>
					{requestJoinPending[friend.userId] ? "Sent..." : "Request Join"}
				</button>
			);
		}

		return null;
	};

	const onBlock = async (targetUserId: string) => {
		if (!token) {
			return;
		}
		setPendingBlock((prev) => ({ ...prev, [targetUserId]: true }));
		try {
			await blockUser(token, targetUserId);
			await refreshFriends();
		} catch (error) {
			dispatch(FriendsCommands.setError((error as Error).message));
		} finally {
			setPendingBlock((prev) => ({ ...prev, [targetUserId]: false }));
		}
	};

	const onUnblock = async (targetUserId: string) => {
		if (!token) {
			return;
		}
		setPendingBlock((prev) => ({ ...prev, [targetUserId]: true }));
		try {
			await unblockUser(token, targetUserId);
			await refreshFriends();
		} catch (error) {
			dispatch(FriendsCommands.setError((error as Error).message));
		} finally {
			setPendingBlock((prev) => ({ ...prev, [targetUserId]: false }));
		}
	};

	const onReport = async (targetUserId: string) => {
		if (!token) {
			return;
		}
		setPendingReport((prev) => ({ ...prev, [targetUserId]: true }));
		try {
			await reportPlayer(
				token,
				targetUserId,
				reportReasons[targetUserId] || "abuse"
			);
			dispatch(FriendsCommands.setError("Report submitted"));
		} catch (error) {
			dispatch(FriendsCommands.setError((error as Error).message));
		} finally {
			setPendingReport((prev) => ({ ...prev, [targetUserId]: false }));
		}
	};

	const renderSafetyActions = (targetUserId: string) => (
		<div className={styles.safetyActions}>
			<span className={styles.safetyLabel}>Safety</span>
			<select
				value={reportReasons[targetUserId] || "abuse"}
				onChange={(event) =>
					setReportReasons((prev) => ({
						...prev,
						[targetUserId]: event.target.value as ReportReason,
					}))
				}
			>
				<option value="abuse">Abuse</option>
				<option value="spam">Spam</option>
				<option value="offensive_name">Offensive Name</option>
				<option value="cheating">Cheating</option>
				<option value="other">Other</option>
			</select>
			<button
				className={styles.smallAction}
				disabled={!!pendingReport[targetUserId]}
				onClick={() => onReport(targetUserId)}
			>
				{pendingReport[targetUserId] ? "Reporting..." : "Report"}
			</button>
			<button
				className={styles.dangerAction}
				disabled={!!pendingBlock[targetUserId]}
				onClick={() => onBlock(targetUserId)}
			>
				{pendingBlock[targetUserId] ? "Blocking..." : "Block"}
			</button>
		</div>
	);

	return (
		<div className={styles.wrapper}>
			{(!token || authMode !== "account") && (
				<div className={styles.item}>
					<div>Account required for friends and room access.</div>
				</div>
			)}

			{friendsState.error && (
				<div className={styles.message}>{friendsState.error}</div>
			)}

			<div className={styles.searchRow}>
				<input
					value={query}
					onChange={(event) => setQuery(event.target.value)}
					placeholder="Search nickname"
					disabled={!token}
				/>
				<button onClick={onSearch} disabled={!token || query.trim().length < 2}>
					Search
				</button>
			</div>

			<div className={styles.list}>
				{friendsState.searchResults.map((item) => (
					<div key={item.userId} className={styles.item}>
						<div className={styles.playerInfo}>
							<div className={styles.nickname}>{item.nickname}</div>
							<div className={styles.presence}>
								{presenceLabel[item.presence] ?? item.presence}
							</div>
						</div>
						<div className={styles.primaryActions}>
							<button
								disabled={
									!token ||
									friendUserIds.has(item.userId) ||
									outgoingRequestUserIds.has(item.userId) ||
									blockedUserIds.has(item.userId) ||
									!!pendingAdd[item.userId]
								}
								onClick={async () => {
									setPendingAdd((prev) => ({ ...prev, [item.userId]: true }));
									try {
										await socialEmit("friendsRequestSend", {
											targetUserId: item.userId,
										});
									} catch (error) {
										dispatch(
											FriendsCommands.setError((error as Error).message)
										);
									} finally {
										setPendingAdd((prev) => ({
											...prev,
											[item.userId]: false,
										}));
									}
								}}
							>
								{friendUserIds.has(item.userId)
									? "Already Friends"
									: outgoingRequestUserIds.has(item.userId)
										? "Request Sent"
										: blockedUserIds.has(item.userId)
											? "Blocked"
											: pendingAdd[item.userId]
												? "Sending..."
												: "Add Friend"}
							</button>
						</div>
						{renderSafetyActions(item.userId)}
					</div>
				))}
			</div>

			<div className={styles.sectionTitle}>Incoming Requests</div>
			<div className={styles.list}>
				{friendsState.incomingRequests.map((item) => (
					<div key={item.id} className={styles.item}>
						<div className={styles.playerInfo}>
							<div className={styles.nickname}>{item.senderNickname}</div>
							<div className={styles.presence}>Friend request</div>
						</div>
						<div className={styles.primaryActions}>
							<button
								disabled={!!pendingAccept[item.id]}
								onClick={async () => {
									setPendingAccept((prev) => ({ ...prev, [item.id]: true }));
									try {
										await socialEmit("friendsRequestAccept", {
											requestId: item.id,
										});
									} catch (error) {
										dispatch(
											FriendsCommands.setError((error as Error).message)
										);
									} finally {
										setPendingAccept((prev) => ({ ...prev, [item.id]: false }));
									}
								}}
							>
								{pendingAccept[item.id] ? "Accepting..." : "Accept"}
							</button>
						</div>
						{renderSafetyActions(item.senderUserId)}
					</div>
				))}
			</div>

			<div className={styles.sectionTitle}>Friends</div>
			<div className={styles.list}>
				{friendsState.friends.map((item) => (
					<div key={item.userId} className={styles.item}>
						<div className={styles.playerInfo}>
							<div className={styles.nickname}>{item.nickname}</div>
							<div className={styles.presence}>
								{presenceLabel[item.presence] ?? item.presence}
							</div>
						</div>
						<div className={styles.primaryActions}>{renderAction(item)}</div>
						{renderSafetyActions(item.userId)}
					</div>
				))}
			</div>

			<div className={styles.sectionTitle}>Blocked Users</div>
			<div className={styles.list}>
				{friendsState.blockedUsers.map((item) => (
					<div key={item.userId} className={styles.item}>
						<div className={styles.playerInfo}>
							<div className={styles.nickname}>{item.nickname}</div>
							<div className={styles.presence}>Blocked</div>
						</div>
						<div className={styles.primaryActions}>
							<button
								disabled={!!pendingBlock[item.userId]}
								onClick={() => onUnblock(item.userId)}
							>
								{pendingBlock[item.userId] ? "Unblocking..." : "Unblock"}
							</button>
						</div>
					</div>
				))}
			</div>
		</div>
	);
};
