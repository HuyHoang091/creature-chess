import * as React from "react";

import { useSelector } from "react-redux";
import { useLocalPlayerId } from "~/auth/context";
import {
	requestPositioningAdvice,
	requestCoachAdvice,
	requestCoachAdviceStream,
	requestBattleAnalysis,
	PositioningAdvice,
	CoachResponse,
} from "~/services/tacticalAI";
import { AppState } from "~/store/state";

import { BoardSelectors, BoardState } from "@shoki/board";

import { PieceModel, GamePhase, RoundType } from "@creature-chess/models";
import { PlayerListPlayer } from "@creature-chess/models/game/playerList";

import { CoachMessageRenderer } from "./CoachMessageRenderer";
import { PositioningTab } from "./PositioningTab";
import { TacticalAIBrainIcon, TacticalAIRobotIcon } from "./TacticalAIIcons";
import styles from "./tactical-ai.module.css";

const TacticalAIPanel: React.FC = () => {
	const [open, setOpen] = React.useState(false);
	const [activeTab, setActiveTab] = React.useState<"positioning" | "coach">(
		"positioning"
	);
	const [loading, setLoading] = React.useState(false);
	const [positioningResult, setPositioningResult] =
		React.useState<PositioningAdvice | null>(null);
	const [coachMessages, setCoachMessages] = React.useState<
		Array<{ role: "user" | "ai"; text: string }>
	>([]);
	const [coachInput, setCoachInput] = React.useState("");
	const chatMessagesRef = React.useRef<HTMLDivElement>(null);

	const localPlayerId = useLocalPlayerId();

	const board = useSelector<AppState, BoardState<PieceModel>>(
		(state) => state.game.board
	);
	const myPieces = BoardSelectors.getAllPieces(board).filter(
		(p) => p.ownerId === localPlayerId
	);
	const opponentId = useSelector<AppState, string | null>(
		(state) => state.game.playerInfo.opponentId
	);
	const potentialOpponentId = useSelector<AppState, string | null>(
		(state) => state.game.playerInfo.potentialOpponentId
	);
	const phase = useSelector<AppState, GamePhase>(
		(state) => state.game.roundInfo.phase
	);
	const roundNumber = useSelector<AppState, number>(
		(state) => state.game.roundInfo.round
	);
	const roundType = useSelector<AppState, RoundType | undefined>(
		(state) => state.game.roundInfo.roundType
	);
	const isPvE =
		roundType === RoundType.PVE_CREEP || roundType === RoundType.PVE_BOSS;
	const canUsePositioning =
		opponentId !== null &&
		potentialOpponentId !== null &&
		opponentId !== "creep" &&
		phase === GamePhase.PREPARING &&
		!isPvE;
	const matchBoard = useSelector<AppState, BoardState<PieceModel> | null>(
		(state) => state.game.match.board
	);
	const playerList = useSelector<AppState, PlayerListPlayer[]>(
		(state) => state.game.playerList
	);
	const selectedPieceId = useSelector<AppState, string | null>(
		(state) => state.game.ui.selectedPieceId
	);
	const inventory = useSelector<AppState, string[]>(
		(state) => state.game.playerInfo.inventory
	);

	const myTraits = React.useMemo(() => {
		const traitSet = new Set<string>();
		myPieces.forEach((p) => {
			if (p.definition?.traits) {
				p.definition.traits.forEach((t) => traitSet.add(t));
			}
		});
		return Array.from(traitSet);
	}, [myPieces]);

	React.useEffect(() => {
		if (chatMessagesRef.current && activeTab === "coach") {
			chatMessagesRef.current.scrollTop = chatMessagesRef.current.scrollHeight;
		}
	}, [coachMessages, activeTab, loading]);

	// Reset positioning result when round changes
	const prevRoundRef = React.useRef(roundNumber);
	React.useEffect(() => {
		if (roundNumber !== prevRoundRef.current) {
			prevRoundRef.current = roundNumber;
			setPositioningResult(null);
		}
	}, [roundNumber]);

	const handlePositioningRequest = async () => {
		if (!canUsePositioning) {
			setCoachMessages((prev) => [
				...prev,
				{
					role: "ai",
					text: isPvE
						? "Round PvE không hỗ trợ gợi ý xếp quân."
						: "Chỉ dùng được khi đã reveal đủ 2 đối thủ trong vòng mua đồ.",
				},
			]);
			return;
		}

		setLoading(true);
		try {
			const res = await requestPositioningAdvice(board);
			if (res.success && res.advice) {
				setPositioningResult(res.advice);
			}
		} catch (e: any) {
			console.error("Positioning advice failed:", e.message);
		} finally {
			setLoading(false);
		}
	};

	const handleCoachSend = async () => {
		if (!coachInput.trim()) return;
		const raw = coachInput.trim();
		setCoachInput("");
		setCoachMessages((prev) => [...prev, { role: "user", text: raw }]);
		setLoading(true);

		const lower = raw.toLowerCase();

		try {
			// /pos or /xếp → trigger positioning advice
			if (lower === "/pos" || lower === "/xếp" || lower === "/xep") {
				setActiveTab("positioning");
				if (!canUsePositioning) {
					setCoachMessages((prev) => [
						...prev,
						{
							role: "ai",
							text: isPvE
								? "Round PvE không hỗ trợ gợi ý xếp quân."
								: "Chưa reveal đủ 2 đối thủ để chạy gợi ý xếp quân.",
						},
					]);
					setLoading(false);
					return;
				}
				await handlePositioningRequest();
				setCoachMessages((prev) => [
					...prev,
					{
						role: "ai",
						text: "Đã chuyển sang tab Xếp Quân và gửi yêu cầu phân tích cho cả 2 đối thủ.",
					},
				]);
				setLoading(false);
				return;
			}

			// /build or /team → build advice (streaming)
			if (
				lower.startsWith("/build") ||
				lower.startsWith("/team") ||
				lower.startsWith("/doi")
			) {
				setCoachMessages((prev) => [...prev, { role: "ai", text: "" }]);
				await requestCoachAdviceStream(
					`Gợi ý build team. Traits: ${myTraits.join(", ")}. Pieces: ${myPieces.map((p) => p.definition?.name || "").join(", ")}`,
					{
						traits: myTraits,
						pieces: myPieces.map((p) => ({
							name: p.definition?.name || "",
							definitionId: p.definitionId,
						})),
					},
					(chunk) => {
						setCoachMessages((prev) => {
							const last = prev[prev.length - 1];
							if (!last || last.role !== "ai") return prev;
							const updated = [...prev];
							updated[updated.length - 1] = {
								...last,
								text: last.text + chunk,
							};
							return updated;
						});
					}
				);
				setLoading(false);
				return;
			}

			// /item or /đồ → item advice for selected piece (streaming)
			if (
				lower.startsWith("/item") ||
				lower.startsWith("/đồ") ||
				lower.startsWith("/do")
			) {
				const targetPiece = selectedPieceId
					? myPieces.find((p) => p.id === selectedPieceId)
					: myPieces[0];
				if (!targetPiece) {
					setCoachMessages((prev) => [
						...prev,
						{
							role: "ai",
							text: "Không tìm thấy quân nào để gợi ý đồ. Vui lòng chọn một quân trên bàn.",
						},
					]);
					setLoading(false);
					return;
				}
				const role = targetPiece.definition?.traits?.[0] || "general";
				const currentItems =
					(targetPiece as any).itemIds || (targetPiece as any).items || [];
				setCoachMessages((prev) => [...prev, { role: "ai", text: "" }]);
				await requestCoachAdviceStream(
					`Gợi ý item cho ${targetPiece.definition?.name || "Quân"} (role: ${role}). Current items: ${currentItems.join(", ") || "none"}`,
					{},
					(chunk) => {
						setCoachMessages((prev) => {
							const last = prev[prev.length - 1];
							if (!last || last.role !== "ai") return prev;
							const updated = [...prev];
							updated[updated.length - 1] = {
								...last,
								text: last.text + chunk,
							};
							return updated;
						});
					}
				);
				setLoading(false);
				return;
			}

			// /counter or /khắc → counter advice (streaming)
			if (
				lower.startsWith("/counter") ||
				lower.startsWith("/khắc") ||
				lower.startsWith("/khac")
			) {
				const enemyPieces = matchBoard
					? BoardSelectors.getAllPieces(matchBoard).filter(
							(p) => p.ownerId !== localPlayerId
						)
					: [];
				if (enemyPieces.length === 0) {
					const opp = opponentId
						? playerList.find((p) => p.id === opponentId)
						: null;
					if (!opp) {
						setCoachMessages((prev) => [
							...prev,
							{
								role: "ai",
								text: "Chưa có dữ liệu đối thủ để phân tích counter.",
							},
						]);
						setLoading(false);
						return;
					}
					setCoachMessages((prev) => [
						...prev,
						{
							role: "ai",
							text: `🛡️ Counter ${opp.name} (Lv.${opp.level}, HP ${opp.health}): Đang ở vòng mua đồ nên chưa thấy chi tiết quân địch. Hãy dùng /scout để xem tổng quan.`,
						},
					]);
					setLoading(false);
					return;
				}
				const archetype = enemyPieces[0]?.definition?.traits?.[0] || "mixed";
				setCoachMessages((prev) => [...prev, { role: "ai", text: "" }]);
				await requestCoachAdviceStream(
					`Counter đội hình ${archetype}. Enemy: ${enemyPieces.map((p) => p.definition?.name || "").join(", ")}`,
					{ enemyArchetype: archetype },
					(chunk) => {
						setCoachMessages((prev) => {
							const last = prev[prev.length - 1];
							if (!last || last.role !== "ai") return prev;
							const updated = [...prev];
							updated[updated.length - 1] = {
								...last,
								text: last.text + chunk,
							};
							return updated;
						});
					}
				);
				setLoading(false);
				return;
			}

			// /scout or /đối or /doi → show opponent info
			if (
				lower.startsWith("/scout") ||
				lower.startsWith("/đối") ||
				lower.startsWith("/doi")
			) {
				const enemyPieces = matchBoard
					? BoardSelectors.getAllPieces(matchBoard).filter(
							(p) => p.ownerId !== localPlayerId
						)
					: [];
				if (enemyPieces.length > 0) {
					const names = enemyPieces
						.map((p) => p.definition?.name || "?")
						.join(", ");
					const traits = [
						...new Set(enemyPieces.flatMap((p) => p.definition?.traits || [])),
					].join(", ");
					setCoachMessages((prev) => [
						...prev,
						{
							role: "ai",
							text: `📋 Scout đối thủ (combat):\nQuân: ${names}\nTộc/hệ: ${traits || "Không rõ"}\nSố lượng: ${enemyPieces.length}`,
						},
					]);
					setLoading(false);
					return;
				}

				// Preparing phase: use playerList info
				const realOpp = opponentId
					? playerList.find((p) => p.id === opponentId)
					: null;
				const potOpp = potentialOpponentId
					? playerList.find((p) => p.id === potentialOpponentId)
					: null;
				if (!realOpp) {
					setCoachMessages((prev) => [
						...prev,
						{ role: "ai", text: "Chưa có thông tin đối thủ." },
					]);
					setLoading(false);
					return;
				}
				const lines = [
					`📋 Scout đối thủ (preparing):`,
					`👤 Đối thủ chính: ${realOpp.name} (Lv.${realOpp.level}, HP ${realOpp.health}, Streak ${realOpp.streakAmount ?? 0})`,
				];
				if (potOpp) {
					lines.push(
						`👤 Đối thủ phụ: ${potOpp.name} (Lv.${potOpp.level}, HP ${potOpp.health})`
					);
				}
				setCoachMessages((prev) => [
					...prev,
					{ role: "ai", text: lines.join("\n") },
				]);
				setLoading(false);
				return;
			}

			// /help → list commands
			if (lower === "/help" || lower === "/?") {
				setCoachMessages((prev) => [
					...prev,
					{
						role: "ai",
						text:
							`📌 Danh sách lệnh nhanh:\n` +
							`/pos hoặc /xếp — Gợi ý xếp quân\n` +
							`/build hoặc /team — Gợi ý đội hình\n` +
							`/item hoặc /đồ — Gợi ý item cho quân đang chọn\n` +
							`/counter hoặc /khắc — Phân tích counter đối thủ\n` +
							`/scout hoặc /đối — Xem thông tin đối thủ\n` +
							`/help — Hiện danh sách lệnh`,
					},
				]);
				setLoading(false);
				return;
			}

			// Default: streaming coach chat
			setCoachMessages((prev) => [...prev, { role: "ai", text: "" }]);
			await requestCoachAdviceStream(
				raw,
				{
					pieces: myPieces.map((p) => ({
						name: p.definition?.name || "",
						definitionId: p.definitionId,
					})),
				},
				(chunk) => {
					setCoachMessages((prev) => {
						const last = prev[prev.length - 1];
						if (!last || last.role !== "ai") return prev;
						const updated = [...prev];
						updated[updated.length - 1] = { ...last, text: last.text + chunk };
						return updated;
					});
				}
			);
		} catch (e: any) {
			setCoachMessages((prev) => [
				...prev,
				{ role: "ai", text: `Lỗi: ${e.message}` },
			]);
		} finally {
			setLoading(false);
		}
	};

	return (
		<>
			{/* Floating button */}
			<button
				className={styles.fab}
				onClick={() => setOpen((prev) => !prev)}
				title="Tactical AI"
			>
				<TacticalAIRobotIcon className={styles.fabIcon} />
			</button>

			{/* Panel */}
			{open && (
				<div className={styles.panel}>
					<div className={styles.panelHeader}>
						<span className={styles.panelTitle}>
							<TacticalAIBrainIcon className={styles.panelTitleIcon} />
							<span>Tactical AI</span>
						</span>
						<button className={styles.closeBtn} onClick={() => setOpen(false)}>
							✕
						</button>
					</div>

					<div className={styles.tabs}>
						<button
							className={
								activeTab === "positioning" ? styles.tabActive : styles.tab
							}
							onClick={() => setActiveTab("positioning")}
						>
							Xếp Quân
						</button>
						<button
							className={activeTab === "coach" ? styles.tabActive : styles.tab}
							onClick={() => setActiveTab("coach")}
						>
							Hỏi Coach
						</button>
					</div>

					<div className={styles.panelBody}>
						{activeTab === "positioning" && (
							<PositioningTab
								loading={loading}
								result={positioningResult}
								board={board}
								localPlayerId={localPlayerId}
								canUsePositioning={canUsePositioning}
								roundNumber={roundNumber}
								onRequest={handlePositioningRequest}
							/>
						)}

						{activeTab === "coach" && (
							<div className={styles.chatContainer}>
								<div className={styles.chatMessages} ref={chatMessagesRef}>
									{coachMessages.length === 0 && (
										<div className={styles.emptyChat}>
											Gõ /help để xem lệnh nhanh, hoặc hỏi tự do về đội hình,
											item, chiến thuật...
										</div>
									)}
									{coachMessages.map((msg, i) => (
										<div
											key={i}
											className={
												msg.role === "user"
													? styles.userMessage
													: styles.aiMessage
											}
										>
											{msg.role === "ai" ? (
												<CoachMessageRenderer text={msg.text} />
											) : (
												msg.text
											)}
										</div>
									))}
									{loading && (
										<div className={styles.typing}>Coach đang trả lời...</div>
									)}
								</div>
								<div className={styles.chatInputRow}>
									<input
										className={styles.chatInput}
										value={coachInput}
										onChange={(e) => setCoachInput(e.target.value)}
										onKeyDown={(e) => e.key === "Enter" && handleCoachSend()}
										placeholder="Nhập câu hỏi..."
									/>
									<button
										className={styles.sendBtn}
										onClick={handleCoachSend}
										disabled={loading}
									>
										Gửi
									</button>
								</div>
							</div>
						)}
					</div>
				</div>
			)}
		</>
	);
};

export { TacticalAIPanel };
