import * as React from "react";
import { useEffect } from "react";

import { useDispatch, useSelector } from "react-redux";
import { withErrorBoundary, useErrorBoundary } from "react-use-error-boundary";
import { VoiceChatProvider } from "~/services/voiceChat";

import { AppRouter } from "./router/AppRouter";
import { AppShellCommands } from "./store/appShell/state";
import { AppState } from "./store/state";
import { NotificationCommands } from "~/store/notifications/state";

export const App = withErrorBoundary(() => {
	const [error, resetError] = useErrorBoundary();
	const dispatch = useDispatch();
	const modal = useSelector((state: AppState) => state.appShell.modal);

	useEffect(() => {
		const loadActiveEvents = async () => {
			try {
				const response = await fetch(`${APP_API_URL}/events/public`);
				if (response.ok) {
					const data = await response.json();
					if (data.events && Array.isArray(data.events)) {
						data.events.forEach((event: any) => {
							dispatch(
								NotificationCommands.pushNotification({
									id: `event-${event.id}`,
									message: event.description ? event.description.slice(0, 200) : "Một sự kiện mới đã bắt đầu! Tham gia ngay.",
									data: { eventId: event.id, pageSlug: event.pageSlug, type: "game_event" },
								})
							);
						});
					}
				}
			} catch (err) {
				console.error("Failed to load active events:", err);
			}
		};
		loadActiveEvents();
	}, [dispatch]);

	if (error) {
		return (
			<div>
				<p>{(error as Error).message}</p>

				<p>{(error as Error).stack}</p>

				<button onClick={() => window.location.reload()}>Try again</button>
			</div>
		);
	}

	return (
		<VoiceChatProvider>
			<>
				<AppRouter />
				{modal === "signin-required" && (
					<div
						style={{
							position: "fixed",
							inset: 0,
							background: "rgba(5, 8, 16, 0.7)",
							display: "flex",
							alignItems: "center",
							justifyContent: "center",
							zIndex: 1000,
						}}
					>
						<div
							style={{
								width: "min(92vw, 480px)",
								background: "#101625",
								border: "1px solid rgba(131, 153, 255, 0.25)",
								borderRadius: 16,
								padding: 20,
								color: "#f5f7ff",
								display: "flex",
								flexDirection: "column",
								gap: 12,
							}}
						>
							<h2>Account Required</h2>
							<p>
								Friends, party, private lobbies, and persistent history require
								an authenticated account.
							</p>
							<p>
								Auth0 is currently disabled in your environment, so only guest
								quick play is active right now.
							</p>
							<button
								onClick={() => dispatch(AppShellCommands.setModal(null))}
								style={{
									alignSelf: "flex-end",
									padding: "10px 14px",
									borderRadius: 10,
									border: "none",
									background: "#4d6bff",
									color: "white",
									cursor: "pointer",
								}}
							>
								Close
							</button>
						</div>
					</div>
				)}
			</>
		</VoiceChatProvider>
	);
});
