import React from "react";
import { useDispatch, useSelector } from "react-redux";

import { fetchHistory } from "~/services/historyApi";
import { HistoryCommands } from "~/store/history/state";
import { AppState } from "~/store/state";

import styles from "./HistoryPage.module.css";

export const HistoryPage = () => {
	const dispatch = useDispatch();
	const token = useSelector((state: AppState) => state.auth.accessToken);
	const authMode = useSelector((state: AppState) => state.auth.mode);
	const history = useSelector((state: AppState) => state.history);

	const load = React.useCallback(
		async (cursor?: string | null) => {
			if (!token) {
				return;
			}

			dispatch(HistoryCommands.setLoading(true));
			try {
				const payload = await fetchHistory(token, cursor);
				if (cursor) {
					dispatch(HistoryCommands.appendPayload(payload));
				} else {
					dispatch(HistoryCommands.setPayload(payload));
				}
				dispatch(HistoryCommands.setError(null));
			} catch (error) {
				dispatch(HistoryCommands.setError((error as Error).message));
			} finally {
				dispatch(HistoryCommands.setLoading(false));
			}
		},
		[dispatch, token]
	);

	React.useEffect(() => {
		load();
	}, [load]);

	return (
		<div className={styles.wrapper}>
				{(!token || authMode !== "account") && (
					<div className={styles.alert}>
						Public match history only appears for authenticated accounts.
					</div>
				)}
				{history.error && <div className={styles.alert}>{history.error}</div>}
				{history.items.map((item) => (
					<div key={item.matchId} className={styles.card}>
						<div className={styles.matchId}>Match #{item.matchId.slice(0, 8)}</div>
						<div className={styles.placement}>
							Placement #{item.placement} • {item.result} •{" "}
							{new Date(item.endedAt).toLocaleString()}
						</div>
						<div className={styles.meta}>
							Players: {item.playerCount} • Duration: {item.durationSeconds}s
						</div>
					</div>
				))}
				{history.nextCursor && (
					<button className={styles.loadMore} onClick={() => load(history.nextCursor)} disabled={history.loading}>
						Load More
					</button>
				)}
		</div>
	);
};
