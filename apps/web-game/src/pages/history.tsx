import React from "react";
import { useDispatch, useSelector } from "react-redux";

import type { MatchHistoryDetailDto } from "@creature-chess/models";

import { fetchHistory, fetchHistoryDetail } from "~/services/historyApi";
import { reportPlayer, ReportReason } from "~/services/reportsApi";
import { AppShellCommands } from "~/store/appShell/state";
import { HistoryCommands } from "~/store/history/state";
import { AppState } from "~/store/state";

import styles from "./HistoryPage.module.css";

const reportReasonOptions: { value: ReportReason; label: string }[] = [
	{ value: "abuse", label: "Abuse" },
	{ value: "spam", label: "Spam" },
	{ value: "offensive_name", label: "Offensive name" },
	{ value: "cheating", label: "Cheating" },
	{ value: "other", label: "Other" },
];

const resultLabel: Record<string, string> = {
	win: "Win",
	top4: "Top 4",
	loss: "Loss",
	custom: "Custom",
};

function formatDuration(seconds: number) {
	const minutes = Math.floor(seconds / 60);
	const remain = seconds % 60;
	return minutes > 0 ? `${minutes}m ${remain}s` : `${remain}s`;
}

export const HistoryPage = () => {
	const dispatch = useDispatch();
	const token = useSelector((state: AppState) => state.auth.accessToken);
	const authMode = useSelector((state: AppState) => state.auth.mode);
	const currentUserId = useSelector(
		(state: AppState) => state.profile.currentUser?.id ?? null
	);
	const history = useSelector((state: AppState) => state.history);

	const [timeFilter, setTimeFilter] = React.useState<"7d" | "30d" | "all">(
		"30d"
	);
	const [sortBy, setSortBy] = React.useState<
		"time_desc" | "time_asc" | "placement_best" | "placement_worst"
	>("time_desc");
	const [resultFilter, setResultFilter] = React.useState<
		"all" | "win" | "top4" | "loss"
	>("all");
	const [detail, setDetail] = React.useState<MatchHistoryDetailDto | null>(null);
	const [detailLoading, setDetailLoading] = React.useState(false);
	const [detailError, setDetailError] = React.useState<string | null>(null);
	const [reportState, setReportState] = React.useState<{
		targetUserId: string;
		targetName: string;
		matchId: string;
	} | null>(null);
	const [reportReason, setReportReason] = React.useState<ReportReason>("abuse");
	const [reportDescription, setReportDescription] = React.useState("");
	const [reportBusy, setReportBusy] = React.useState(false);
	const [reportMessage, setReportMessage] = React.useState<string | null>(null);

	const load = React.useCallback(
		async (cursor?: string | null) => {
			if (!token) {
				return;
			}

			dispatch(HistoryCommands.setLoading(true));
			try {
				const payload = await fetchHistory(token, {
					cursor,
					limit: 20,
					timeFilter,
					sortBy,
					resultFilter,
				});
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
		[dispatch, resultFilter, sortBy, timeFilter, token]
	);

	React.useEffect(() => {
		load();
	}, [load]);

	const openDetail = async (matchId: string) => {
		if (!token) {
			return;
		}
		setDetail(null);
		setDetailLoading(true);
		setDetailError(null);
		try {
			setDetail(await fetchHistoryDetail(token, matchId));
			setReportMessage(null);
		} catch (error) {
			setDetailError((error as Error).message);
		} finally {
			setDetailLoading(false);
		}
	};

	const closeDetail = () => {
		setDetail(null);
		setDetailError(null);
		setDetailLoading(false);
	};

	const onSubmitReport = async (event: React.FormEvent) => {
		event.preventDefault();
		if (!token || !reportState) {
			return;
		}
		setReportBusy(true);
		setReportMessage(null);
		try {
			await reportPlayer(token, reportState.targetUserId, reportReason, {
				matchId: reportState.matchId,
				description: reportDescription,
			});
			setReportMessage("Đã gửi báo cáo. Cảm ơn bạn!");
			setReportState(null);
			setReportReason("abuse");
			setReportDescription("");
		} catch (error) {
			setReportMessage((error as Error).message);
		} finally {
			setReportBusy(false);
		}
	};

	const visibleModal = detail || detailLoading || detailError;

	return (
		<div className={styles.wrapper}>
			{(!token || authMode !== "account") && (
				<div className={styles.alert}>
					Lịch sử trận và báo cáo người chơi chỉ dùng được với tài khoản đã
					đăng nhập.
				</div>
			)}

			<div className={styles.toolbar}>
				<label>
					<span>Time</span>
					<select
						value={timeFilter}
						onChange={(event) =>
							setTimeFilter(event.target.value as typeof timeFilter)
						}
					>
						<option value="7d">7 days</option>
						<option value="30d">30 days</option>
						<option value="all">All</option>
					</select>
				</label>
				<label>
					<span>Sort by</span>
					<select
						value={sortBy}
						onChange={(event) => setSortBy(event.target.value as typeof sortBy)}
					>
						<option value="time_desc">Newest</option>
						<option value="time_asc">Oldest</option>
						<option value="placement_best">Best</option>
						<option value="placement_worst">Worst</option>
					</select>
				</label>
				<label>
					<span>Result</span>
					<select
						value={resultFilter}
						onChange={(event) =>
							setResultFilter(event.target.value as typeof resultFilter)
						}
					>
						<option value="all">All</option>
						<option value="win">Win</option>
						<option value="top4">Top 4</option>
						<option value="loss">Loss</option>
					</select>
				</label>
				<button
					className={styles.actionButton}
					onClick={() => load()}
					disabled={!token || history.loading}
				>
					{history.loading ? "Loading..." : "Apply"}
				</button>
			</div>

			{history.error && <div className={styles.alert}>{history.error}</div>}
			{reportMessage && <div className={styles.alert}>{reportMessage}</div>}

			{history.items.length === 0 && !history.loading ? (
				<div className={styles.emptyState}>
					<div>
						<div className={styles.emptyTitle}>No matches yet</div>
						<div className={styles.emptyText}>
							Complete a match to see results and report players from match
							history.
						</div>
					</div>
					<button
						className={styles.actionButton}
						onClick={() => dispatch(AppShellCommands.setScreen("home"))}
					>
						Play now
					</button>
				</div>
			) : null}

			<div className={styles.list}>
				{history.items.map((item) => (
					<button
						key={`${item.matchId}-${item.placement}`}
						className={styles.card}
						onClick={() => openDetail(item.matchId)}
					>
						<div className={styles.rankBadge}>#{item.placement}</div>
						<div className={styles.cardMain}>
							<div className={styles.matchId}>Match {item.matchId.slice(0, 8)}</div>
							<div className={styles.placement}>{resultLabel[item.result]}</div>
						</div>
						<div className={styles.cardMeta}>
							<span>{item.playerCount} players</span>
							<span>{formatDuration(item.durationSeconds)}</span>
							<span>{new Date(item.endedAt).toLocaleString()}</span>
						</div>
					</button>
				))}
			</div>

			{history.nextCursor && (
				<button
					className={styles.loadMore}
					onClick={() => load(history.nextCursor)}
					disabled={history.loading}
				>
					{history.loading ? "Loading..." : "Load more"}
				</button>
			)}

			{visibleModal && (
				<div className={styles.modalBackdrop} onClick={closeDetail}>
					<div
						className={styles.modal}
						onClick={(event) => event.stopPropagation()}
					>
						<div className={styles.modalHeader}>
							<div>
								<div className={styles.eyebrow}>Match Detail</div>
								<h3>
									{detail
										? `Match ${detail.matchId.slice(0, 8)}`
										: "Match detail"}
								</h3>
							</div>
							<button className={styles.ghostButton} onClick={closeDetail}>
								Close
							</button>
						</div>

						{detailLoading ? (
							<div className={styles.modalBody}>Loading...</div>
						) : detailError ? (
							<div className={styles.modalBody}>{detailError}</div>
						) : detail ? (
							<div className={styles.modalBody}>
								<div className={styles.summaryGrid}>
									<div>
										<span>Rank</span>
										<strong>#{detail.placement}</strong>
									</div>
									<div>
										<span>Result</span>
										<strong>{resultLabel[detail.result]}</strong>
									</div>
									<div>
										<span>Duration</span>
										<strong>{formatDuration(detail.durationSeconds)}</strong>
									</div>
									<div>
										<span>Players</span>
										<strong>{detail.stats.totalParticipants}</strong>
									</div>
								</div>

								<div className={styles.timeRow}>
									<span>Started at: {new Date(detail.startedAt).toLocaleString()}</span>
									<span>Ended at: {new Date(detail.endedAt).toLocaleString()}</span>
								</div>

								<div className={styles.panelTitle}>Participants in match</div>
								<div className={styles.participantList}>
									{detail.participants.map((participant, index) => {
										const canReport =
											!participant.isBot &&
											participant.userId &&
											participant.userId !== currentUserId;
										return (
											<div
												key={`${participant.displayName}-${index}`}
												className={styles.participantRow}
											>
												<div className={styles.participantRank}>
													#{participant.placement}
												</div>
												<div className={styles.participantInfo}>
													<div className={styles.participantName}>
														{participant.displayName}
													</div>
													<div className={styles.participantMeta}>
														{participant.isBot
															? "Bot"
															: resultLabel[participant.result] ||
																participant.result}
													</div>
												</div>
												{canReport ? (
													<button
														className={styles.ghostButton}
														onClick={() =>
															setReportState({
																targetUserId: participant.userId!,
																targetName: participant.displayName,
																matchId: detail.matchId,
															})
														}
													>
														Report
													</button>
												) : null}
											</div>
										);
									})}
								</div>
							</div>
						) : null}
					</div>
				</div>
			)}

			{reportState && (
				<div
					className={styles.modalBackdrop}
					onClick={() => setReportState(null)}
				>
					<form
						className={styles.reportModal}
						onClick={(event) => event.stopPropagation()}
						onSubmit={onSubmitReport}
					>
						<div className={styles.modalHeader}>
							<div>
								<div className={styles.eyebrow}>Player Report</div>
								<h3>{reportState.targetName}</h3>
							</div>
							<button
								type="button"
								className={styles.ghostButton}
								onClick={() => setReportState(null)}
							>
								Close
							</button>
						</div>
						<div className={styles.modalBody}>
							<label className={styles.field}>
								<span>Match ID</span>
								<input value={reportState.matchId} readOnly />
							</label>
							<label className={styles.field}>
								<span>Reason</span>
								<select
									value={reportReason}
									onChange={(event) =>
										setReportReason(event.target.value as ReportReason)
									}
								>
									{reportReasonOptions.map((option) => (
										<option key={option.value} value={option.value}>
											{option.label}
										</option>
									))}
								</select>
							</label>
							<label className={styles.field}>
								<span>
									Description{" "}
									{reportReason === "other" ? "(required)" : "(maximum 500 characters)"}
								</span>
								<textarea
									rows={5}
									maxLength={500}
									value={reportDescription}
									onChange={(event) => setReportDescription(event.target.value)}
									required={reportReason === "other"}
								/>
							</label>
							<div className={styles.metaLine}>
								{reportDescription.length}/500 characters
							</div>
							<div className={styles.modalActions}>
								<button
									type="button"
									className={styles.ghostButton}
									onClick={() => setReportState(null)}
								>
									Cancel
								</button>
								<button
									className={styles.actionButton}
									type="submit"
									disabled={reportBusy}
								>
									{reportBusy ? "Sending..." : "Submit report"}
								</button>
							</div>
						</div>
					</form>
				</div>
			)}
		</div>
	);
};
