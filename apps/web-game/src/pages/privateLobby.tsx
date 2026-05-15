import React from "react";
import { useDispatch, useSelector } from "react-redux";

import { AppShell } from "~/components/app/AppShell";
import { fetchFriends } from "~/services/friendsApi";
import { socialEmit } from "~/services/socialSocket";
import { FriendsCommands } from "~/store/friends/state";
import { PrivateLobbyCommands } from "~/store/privateLobby/state";
import { AppState } from "~/store/state";

import styles from "./PrivateLobbyPage.module.css";

const presenceLabel: Record<string, string> = {
	offline: "Offline",
	online: "Online",
	in_room: "In Room",
	in_game: "In Game",
};

export const PrivateLobbyPage = () => {
	const dispatch = useDispatch();
	const authMode = useSelector((state: AppState) => state.auth.mode);
	const token = useSelector((state: AppState) => state.auth.accessToken);
	const currentUserId = useSelector((state: AppState) => state.profile.currentUser?.id);
	const friendsState = useSelector((state: AppState) => state.friends);
	const friends = useSelector((state: AppState) => state.friends.friends);
	const roomState = useSelector((state: AppState) => state.privateLobby);
	const joinRequestToasts = useSelector((state: AppState) => state.joinRequestToasts.items);
	const [joinCode, setJoinCode] = React.useState("");
	const [createPending, setCreatePending] = React.useState(false);
	const [joinPending, setJoinPending] = React.useState(false);
	const [startPending, setStartPending] = React.useState(false);
	const [readyPending, setReadyPending] = React.useState(false);
	const [invitePending, setInvitePending] = React.useState<Record<string, boolean>>({});

	React.useEffect(() => {
		if (!token || authMode !== "account") {
			return;
		}

		const shouldBootstrapFriends =
			!!currentUserId &&
			(!friendsState.hydrated || friendsState.hydratedForUserId !== currentUserId);

		dispatch(PrivateLobbyCommands.setLoading(true));
		Promise.all([
			shouldBootstrapFriends
				? fetchFriends(token).then((payload) =>
						dispatch(
							FriendsCommands.hydratePayload({
								...payload,
								userId: currentUserId!,
							})
						)
				  )
				: Promise.resolve(),
			socialEmit<{ room: AppState["privateLobby"]["room"]; invites: AppState["privateLobby"]["invites"] }>(
				"roomGetSnapshot"
			).then((payload) =>
				dispatch(
					PrivateLobbyCommands.setSnapshot({
						room: payload.room,
						invites: payload.invites,
					})
				)
			),
		])
			.catch((error) => {
				dispatch(PrivateLobbyCommands.setError((error as Error).message));
			})
			.finally(() => {
				dispatch(PrivateLobbyCommands.setLoading(false));
			});
	}, [
		authMode,
		currentUserId,
		dispatch,
		friendsState.hydrated,
		friendsState.hydratedForUserId,
		token,
	]);

	if (authMode !== "account" || !token) {
		return (
			<div className={styles.wrapper}>
				<div className={styles.panel}>
					<div className={styles.title}>Account Required</div>
					<div className={styles.muted}>Private rooms require authenticated account.</div>
				</div>
			</div>
		);
	}

	const room = roomState.room;
	const isOwner = !!room && room.ownerUserId === currentUserId;
	const me = room?.members.find((member) => member.userId === currentUserId);
	const roomFriendIds = new Set(room?.members.map((member) => member.userId) ?? []);
	const canStart =
		!!room &&
		isOwner &&
		room.members.length >= 2 &&
		room.members.every((member) => member.userId === room.ownerUserId || member.ready);

	return (
		<AppShell>
			<div className={styles.wrapper}>
			<div className={styles.panel}>
				<div className={styles.title}>Room Control</div>
				{roomState.error && (
					<div className={styles.error}>{roomState.error}</div>
				)}
				{room ? (
					<>
						<div style={{ marginTop: 16 }}>
							<span className={styles.codeBadge}>Room Code: {room.code}</span>
						</div>
						<div className={styles.memberList}>
							{room.members.map((member) => (
								<div key={member.userId} className={styles.member}>
									<div className={styles.memberMeta}>
										<div className={styles.memberName}>
											{member.nickname}
											{room.ownerUserId === member.userId ? " • Owner" : ""}
										</div>
										<div className={styles.memberSub}>
											{room.ownerUserId === member.userId
												? room.status === "in_game"
													? "In Game"
													: "Owner"
												: member.ready
													? "Ready"
													: "Not Ready"}
										</div>
									</div>
								</div>
							))}
						</div>
						{isOwner && joinRequestToasts.length > 0 && (
							<div className={styles.inviteList}>
								{joinRequestToasts.map((toast) => (
									<div key={toast.id} className={styles.joinRequestPreview}>
										<div className={styles.waveDots}>
											<span />
											<span />
											<span />
										</div>
										<div className={styles.previewName}>
											{toast.requesterNickname} is requesting to join
										</div>
									</div>
								))}
							</div>
						)}
						<div className={styles.row}>
							{!isOwner && (
								<button
									className={styles.actionButton}
									disabled={readyPending}
									onClick={async () => {
										setReadyPending(true);
										try {
											await socialEmit("roomReadyToggle");
										} catch (error) {
											dispatch(
												PrivateLobbyCommands.setError((error as Error).message)
											);
										} finally {
											setReadyPending(false);
										}
									}}
								>
									{readyPending
										? "Updating..."
										: me?.ready
											? "Unready"
											: "Ready"}
								</button>
							)}
							{isOwner && (
								<button
									className={styles.actionButton}
									disabled={!canStart || startPending}
									onClick={async () => {
										setStartPending(true);
										try {
											await socialEmit("roomStart");
										} catch (error) {
											dispatch(
												PrivateLobbyCommands.setError((error as Error).message)
											);
										} finally {
											setStartPending(false);
										}
									}}
								>
									{startPending ? "Starting..." : "Start"}
								</button>
							)}
							<button
								className={styles.actionButton}
								onClick={async () => {
									try {
										await socialEmit("roomLeave");
									} catch (error) {
										dispatch(
											PrivateLobbyCommands.setError((error as Error).message)
										);
									}
								}}
							>
								Leave Room
							</button>
						</div>
					</>
				) : (
					<div className={styles.row}>
						<button
							className={styles.actionButton}
							disabled={createPending}
							onClick={async () => {
								setCreatePending(true);
								try {
									await socialEmit("roomCreate");
								} catch (error) {
									dispatch(PrivateLobbyCommands.setError((error as Error).message));
								} finally {
									setCreatePending(false);
								}
							}}
						>
							{createPending ? "Creating..." : "Create Room"}
						</button>
						<input
							value={joinCode}
							onChange={(event) => setJoinCode(event.target.value.toUpperCase())}
							placeholder="Enter room code"
						/>
						<button
							className={styles.actionButton}
							disabled={joinPending || !joinCode.trim()}
							onClick={async () => {
								setJoinPending(true);
								try {
									await socialEmit("roomJoinByCode", { code: joinCode });
									setJoinCode("");
								} catch (error) {
									dispatch(PrivateLobbyCommands.setError((error as Error).message));
								} finally {
									setJoinPending(false);
								}
							}}
						>
							{joinPending ? "Joining..." : "Join Room"}
						</button>
					</div>
				)}
			</div>

			<div className={styles.panel}>
				<div className={styles.title}>Invites & Friends</div>

				<div className={styles.memberList}>
					{friends.map((friend) => (
						<div key={friend.userId} className={styles.member}>
							<div className={styles.memberMeta}>
								<div className={styles.memberName}>{friend.nickname}</div>
								<div className={styles.memberSub}>
									{presenceLabel[friend.presence] ?? friend.presence}
								</div>
							</div>
							<div className={styles.memberActions}>
								{room && friend.presence === "online" && !roomFriendIds.has(friend.userId) && (
									<button
										disabled={!!invitePending[friend.userId]}
										onClick={async () => {
											setInvitePending((prev) => ({
												...prev,
												[friend.userId]: true,
											}));
											try {
												await socialEmit("roomInvite", {
													targetUserId: friend.userId,
												});
											} catch (error) {
												dispatch(
													PrivateLobbyCommands.setError((error as Error).message)
												);
											} finally {
												setInvitePending((prev) => ({
													...prev,
													[friend.userId]: false,
												}));
											}
										}}
									>
										{invitePending[friend.userId] ? "Inviting..." : "Invite"}
									</button>
								)}
							</div>
						</div>
					))}
				</div>
			</div>
		</div>
		</AppShell>
	);
};
