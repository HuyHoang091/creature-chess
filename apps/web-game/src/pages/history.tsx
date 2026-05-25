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
	{ value: "abuse", label: "Lạm dụng" },
	{ value: "spam", label: "Spam" },
	{ value: "offensive_name", label: "Tên phản cảm" },
	{ value: "cheating", label: "Gian lận" },
	{ value: "other", label: "Khác" },
];

export const HistoryPage = () => {
	const dispatch = useDispatch();
	const token = useSelector((state: AppState) => state.auth.accessToken);
	const authMode = useSelector((state: AppState) => state.auth.mode);
	const currentUserId = useSelector(
		(state: AppState) => state.profile.currentUser?.id ?? null
	);
	const history = useSelector((state: AppState) => state.history);

	const [timeFilter, setTimeFilter] = React.useState<"7d" | "30d" | "all">("30d");
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

	return (
		<div className={styles.wrapper}>
			{(!token || authMode !== "account") && (
				<div className={styles.alert}>
					Lịch sử trận và tính năng báo cáo chỉ có cho tài khoản đã đăng nhập.
				</div>
			)}

			<div className={styles.toolbar}>
				<select value={timeFilter} onChange={(event) => setTimeFilter(event.target.value as typeof timeFilter)}>
					<option value="7d">7 ngày qua</option>
					<option value="30d">30 ngày qua</option>
					<option value="all">Tất cả</option>
				</select>
				<select value={sortBy} onChange={(event) => setSortBy(event.target.value as typeof sortBy)}>
					<option value="time_desc">Mới nhất</option>
					<option value="time_asc">Cũ nhất</option>
					<option value="placement_best">Xếp hạng tốt nhất</option>
					<option value="placement_worst">Xếp hạng tệ nhất</option>
				</select>
				<select
					value={resultFilter}
					onChange={(event) =>
						setResultFilter(event.target.value as typeof resultFilter)
					}
				>
					<option value="all">Mọi kết quả</option>
					<option value="win">Win</option>
					<option value="top4">Top 4</option>
					<option value="loss">Loss</option>
				</select>
				<button className={styles.actionButton} onClick={() => load()} disabled={!token}>
					Lọc
				</button>
			</div>

			{history.error && <div className={styles.alert}>{history.error}</div>}
			{reportMessage && <div className={styles.alert}>{reportMessage}</div>}

			{history.items.length === 0 && !history.loading ? (
				<div className={styles.emptyState}>
					<div className={styles.emptyTitle}>Chưa có lịch sử trận đấu</div>
					<button
						className={styles.actionButton}
						onClick={() => dispatch(AppShellCommands.setScreen("home"))}
					>
						Chơi ngay
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
						<div className={styles.cardHeader}>
							<div>
								<div className={styles.matchId}>Match #{item.matchId.slice(0, 8)}</div>
								<div className={styles.placement}>
									Hạng #{item.placement} • {item.result.toUpperCase()}
								</div>
							</div>
							<div className={styles.cardTime}>
								{new Date(item.endedAt).toLocaleString()}
							</div>
						</div>
						<div className={styles.meta}>
							<span>{item.playerCount} người chơi</span>
							<span>{item.durationSeconds}s</span>
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
					{history.loading ? "Đang tải..." : "Tải thêm"}
				</button>
			)}

			{(detail || detailLoading || detailError) && (
				<div className={styles.modalBackdrop} onClick={() => setDetail(null)}>
					<div
						className={styles.modal}
						onClick={(event) => event.stopPropagation()}
					>
						<div className={styles.modalHeader}>
							<div>
								<div className={styles.matchId}>
									{detail ? `Match #${detail.matchId.slice(0, 8)}` : "Chi tiết trận"}
								</div>
								<div className={styles.placement}>
									{detail ? `Hạng #${detail.placement}` : ""}
								</div>
							</div>
							<button className={styles.ghostButton} onClick={() => setDetail(null)}>
								Đóng
							</button>
						</div>

						{detailLoading ? (
							<div className={styles.modalBody}>Đang tải chi tiết trận...</div>
						) : detailError ? (
							<div className={styles.modalBody}>{detailError}</div>
						) : detail ? (
							<div className={styles.modalBody}>
								<div className={styles.detailGrid}>
									<div className={styles.detailPanel}>
										<div className={styles.detailTitle}>Thống kê trận</div>
										<div className={styles.detailMeta}>
											<span>Bắt đầu: {new Date(detail.startedAt).toLocaleString()}</span>
											<span>Kết thúc: {new Date(detail.endedAt).toLocaleString()}</span>
											<span>Thời lượng: {detail.durationSeconds}s</span>
											<span>Tổng người chơi: {detail.stats.totalParticipants}</span>
										</div>
									</div>
									<div className={styles.detailPanel}>
										<div className={styles.detailTitle}>Người chơi trong trận</div>
										<div className={styles.participantList}>
											{detail.participants.map((participant, index) => {
												const canReport =
													!participant.isBot &&
													participant.userId &&
													participant.userId !== currentUserId;
												return (
													<div key={`${participant.displayName}-${index}`} className={styles.participantRow}>
														<div>
															<div className={styles.participantName}>
																#{participant.placement} {participant.displayName}
															</div>
															<div className={styles.participantMeta}>
																{participant.isBot
																	? "Bot"
																	: participant.result.toUpperCase()}
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
																Báo cáo
															</button>
														) : null}
													</div>
												);
											})}
										</div>
									</div>
								</div>
							</div>
						) : null}
					</div>
				</div>
			)}

			{reportState && (
				<div className={styles.modalBackdrop} onClick={() => setReportState(null)}>
					<form
						className={styles.modal}
						onClick={(event) => event.stopPropagation()}
						onSubmit={onSubmitReport}
					>
						<div className={styles.modalHeader}>
							<div>
								<div className={styles.matchId}>Báo cáo người chơi</div>
								<div className={styles.placement}>{reportState.targetName}</div>
							</div>
							<button
								type="button"
								className={styles.ghostButton}
								onClick={() => setReportState(null)}
							>
								Đóng
							</button>
						</div>
						<div className={styles.modalBody}>
							<label className={styles.field}>
								<span>Match ID</span>
								<input value={reportState.matchId} readOnly />
							</label>
							<label className={styles.field}>
								<span>Lý do</span>
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
								<span>Mô tả chi tiết {reportReason === "other" ? "(bắt buộc)" : "(tối đa 500 ký tự)"}</span>
								<textarea
									rows={5}
									maxLength={500}
									value={reportDescription}
									onChange={(event) => setReportDescription(event.target.value)}
									required={reportReason === "other"}
								/>
							</label>
							<div className={styles.metaLine}>
								{reportDescription.length}/500 ký tự
							</div>
							<div className={styles.modalActions}>
								<button type="button" className={styles.ghostButton} onClick={() => setReportState(null)}>
									Hủy
								</button>
								<button className={styles.actionButton} type="submit" disabled={reportBusy}>
									{reportBusy ? "Đang gửi..." : "Gửi báo cáo"}
								</button>
							</div>
						</div>
					</form>
				</div>
			)}
		</div>
	);
};
