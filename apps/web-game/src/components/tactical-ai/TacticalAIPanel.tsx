import * as React from "react";

import { useSelector } from "react-redux";
import { useLocalPlayerId } from "~/auth/context";
import {
	requestPositioningAdvice,
	requestCoachAdviceStream,
	requestBuildAdviceStream,
	requestBattleAnalysis,
	requestBuildAutoPlayState,
	startBuildAutoPlay,
	stopBuildAutoPlay,
	subscribeBuildAutoPlayStatus,
	BuildAutoPlayLevel,
	BuildAutoPlayPreset,
	BuildAutoPlayStatus,
	PositioningAdvice,
} from "~/services/tacticalAI";
import { AppState } from "~/store/state";

import { BoardSelectors, BoardState } from "@shoki/board";

import { PieceModel, GamePhase, RoundType } from "@creature-chess/models";
import { PlayerListPlayer } from "@creature-chess/models/game/playerList";

import { CoachMessageRenderer } from "./CoachMessageRenderer";
import { PositioningTab } from "./PositioningTab";
import { TacticalAIBrainIcon, TacticalAIRobotIcon } from "./TacticalAIIcons";
import styles from "./tactical-ai.module.css";

const COACH_THINKING_DELAY_MS = 700;
const waitForCoachThinking = () =>
	new Promise((resolve) => setTimeout(resolve, COACH_THINKING_DELAY_MS));

type CoachMessage = {
	role: "user" | "ai";
	text: string;
	plan?: any;
	kind?: "welcome" | "permission" | "auto";
	status?: BuildAutoPlayStatus;
};

const INITIAL_COACH_MESSAGES: CoachMessage[] = [
	{
		role: "ai",
		kind: "welcome",
		text: "Chào bạn, tôi là trợ lý Coach. Tôi có thể giúp gì cho bạn?",
	},
];

const AUTO_PRESETS: Array<{
	id: BuildAutoPlayPreset;
	label: string;
	description: string;
}> = [
	{
		id: "balanced",
		label: "Cân bằng",
		description: "Bot tiêu chuẩn",
	},
	{
		id: "stabilize",
		label: "Giữ máu",
		description: "Ưu tiên tempo",
	},
	{
		id: "economy",
		label: "Tích tiền",
		description: "Giữ nhịp economy",
	},
];

const AUTO_PRESET_LABELS: Record<BuildAutoPlayPreset, string> = {
	balanced: "Cân bằng",
	stabilize: "Giữ máu",
	economy: "Tích tiền",
};

const AUTO_LEVEL_LABELS: Record<BuildAutoPlayLevel, string> = {
	1: "Chỉ xếp quân",
	2: "Mua tướng + xếp quân",
	3: "Thêm reroll / lên cấp",
	4: "Full auto",
};

const cleanAutoText = (text: string) =>
	text
		.replace(/Tactical AI/gi, "Coach")
		.replace(/\btactical\b/gi, "xếp quân")
		.replace(/\bready\b/gi, "sẵn sàng")
		.replace(/\bbot\b/gi, "nhịp tự động")
		.replace(/\.\.\.$/, "...")
		.trim();

const getAutoStatusHeadline = (status: BuildAutoPlayStatus) => {
	if (!status.enabled) {
		return "Coach đã dừng auto.";
	}

	switch (status.activity) {
		case "analyzing":
			return "Đang phân tích ván đấu...";
		case "choosing_action":
			return "Đang chọn hành động...";
		case "acting":
			return `Đang thực hiện: ${formatAutoStep(status.message)}`;
		case "waiting":
			return cleanAutoText(status.message);
		case "error":
			return `Chờ nhịp tiếp theo: ${cleanAutoText(status.message)}`;
		case "disabled":
		default:
			return cleanAutoText(status.message);
	}
};

const getAutoStepGroup = (step: string) => {
	const normalized = cleanAutoText(step).toLowerCase();
	if (
		normalized.includes("bán") ||
		normalized.includes("dọn") ||
		normalized.includes("chỗ trống")
	) {
		return "Dọn bench an toàn";
	}
	if (
		normalized.includes("mua ") ||
		normalized.includes("xuống sân") ||
		normalized.includes("thay ") ||
		normalized.includes("bench")
	) {
		return "Triển khai đội hình";
	}
	if (
		normalized.includes("ghép") ||
		normalized.includes("gắn") ||
		normalized.includes("đồ")
	) {
		return "Tối ưu trang bị";
	}
	if (
		normalized.includes("xếp quân") ||
		normalized.includes("đối thủ") ||
		normalized.includes("phương án") ||
		normalized.includes("ô ") ||
		normalized.includes("tọa độ")
	) {
		return "Điều chỉnh vị trí";
	}
	if (
		normalized.includes("reroll") ||
		normalized.includes("kinh nghiệm") ||
		normalized.includes("cửa hàng")
	) {
		return "Điều phối tài nguyên";
	}
	return "Nhịp trận";
};

const formatAutoStep = (step: string) => {
	const text = cleanAutoText(step).replace(/\.\.\.$/, "");
	if (text.startsWith("Đang mua ")) return text.replace(/^Đang /, "");
	if (text.startsWith("Đang triển khai ")) return text.replace(/^Đang /, "");
	if (text.startsWith("Đang thay ")) return text.replace(/^Đang /, "");
	if (text.startsWith("Đang bán ")) return text.replace(/^Đang /, "");
	if (text.startsWith("Đang ghép ")) return text.replace(/^Đang /, "");
	if (text.startsWith("Đang gắn ")) return text.replace(/^Đang /, "");
	if (text.startsWith("Đang áp dụng ")) return text.replace(/^Đang /, "");
	if (text.startsWith("Đang ")) return text.replace(/^Đang /, "Đang xử lý ");
	return text;
};

const groupAutoSteps = (steps: string[]) =>
	steps.reduce<Array<{ title: string; steps: string[] }>>((groups, step) => {
		const title = getAutoStepGroup(step);
		const formatted = formatAutoStep(step);
		const last = groups[groups.length - 1];
		if (last?.title === title) {
			last.steps.push(formatted);
			return groups;
		}
		groups.push({ title, steps: [formatted] });
		return groups;
	}, []);

const TacticalAIPanel: React.FC = () => {
	const [open, setOpen] = React.useState(false);
	const [activeTab, setActiveTab] = React.useState<"positioning" | "coach">(
		"coach"
	);
	const [loading, setLoading] = React.useState(false);
	const [positioningResult, setPositioningResult] =
		React.useState<PositioningAdvice | null>(null);
	const [coachMessages, setCoachMessages] =
		React.useState<CoachMessage[]>(INITIAL_COACH_MESSAGES);
	const [coachInput, setCoachInput] = React.useState("");
	const [pendingPlan, setPendingPlan] = React.useState<any | null>(null);
	const [pendingPreset, setPendingPreset] =
		React.useState<BuildAutoPlayPreset>("balanced");
	const [autoStatus, setAutoStatus] =
		React.useState<BuildAutoPlayStatus | null>(null);
	const [latestPlan, setLatestPlan] = React.useState<any | null>(null);
	const [autoExecutedThisPlan, setAutoExecutedThisPlan] = React.useState(false);
	const chatMessagesRef = React.useRef<HTMLDivElement>(null);
	const agentStepsRef = React.useRef<HTMLDivElement>(null);
	const lastAutoMessageKeyRef = React.useRef<string | null>(null);
	const previousCoachMessageCountRef = React.useRef(INITIAL_COACH_MESSAGES.length);
	const previousOpenRef = React.useRef(open);
	const previousActiveTabRef = React.useRef(activeTab);
	const wasAutoEnabledRef = React.useRef(false);

	React.useEffect(() => {
		const unsubscribe = subscribeBuildAutoPlayStatus(setAutoStatus);
		requestBuildAutoPlayState()
			.then(({ state }) => setAutoStatus(state))
			.catch(() => undefined);
		return unsubscribe;
	}, []);

	React.useEffect(() => {
		if (!autoStatus) {
			return;
		}

		const wasEnabled = wasAutoEnabledRef.current;
		const shouldShow = autoStatus.enabled || wasEnabled;
		wasAutoEnabledRef.current = autoStatus.enabled;
		if (!shouldShow) {
			return;
		}

		const key = [
			autoStatus.enabled,
			autoStatus.round,
			autoStatus.activity,
			autoStatus.message,
			autoStatus.recentSteps.join("|"),
		].join(":");
		if (lastAutoMessageKeyRef.current === key) {
			return;
		}

		lastAutoMessageKeyRef.current = key;
		setCoachMessages((prev) => {
			const autoMessage: CoachMessage = {
				role: "ai",
				kind: "auto",
				text: autoStatus.message,
				status: autoStatus,
			};
			return [...prev.filter((message) => message.kind !== "auto"), autoMessage];
		});
	}, [autoStatus]);

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
	const autoEnabled = !!autoStatus?.enabled;
	const canSendCoachMessage = !loading && !autoEnabled;
	const scrollCoachToBottom = React.useCallback(() => {
		const chatMessages = chatMessagesRef.current;
		if (!chatMessages) {
			return;
		}

		chatMessages.scrollTop = chatMessages.scrollHeight;
	}, []);
	const scrollAgentStepsToTop = React.useCallback((smooth = true) => {
		const agentSteps = agentStepsRef.current;
		if (!agentSteps) {
			return;
		}

		agentSteps.scrollTo({
			top: 0,
			behavior: smooth ? "smooth" : "auto",
		});
	}, []);

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
		const wasOpen = previousOpenRef.current;
		const wasActiveTab = previousActiveTabRef.current;
		previousOpenRef.current = open;
		previousActiveTabRef.current = activeTab;

		if (!open || activeTab !== "coach") {
			return;
		}

		const openedCoach = !wasOpen || wasActiveTab !== "coach";
		const messageCountChanged =
			coachMessages.length !== previousCoachMessageCountRef.current;
		previousCoachMessageCountRef.current = coachMessages.length;
		const lastMessage = coachMessages[coachMessages.length - 1];
		if (!openedCoach && !messageCountChanged && lastMessage?.kind === "auto") {
			return;
		}

		const animationFrame = requestAnimationFrame(scrollCoachToBottom);
		const timeout = window.setTimeout(scrollCoachToBottom, 40);
		return () => {
			cancelAnimationFrame(animationFrame);
			window.clearTimeout(timeout);
		};
	}, [coachMessages, activeTab, loading, open, scrollCoachToBottom]);

	React.useEffect(() => {
		if (!open || activeTab !== "coach" || !autoStatus?.enabled) {
			return;
		}

		const animationFrame = requestAnimationFrame(() =>
			scrollAgentStepsToTop(true)
		);
		return () => cancelAnimationFrame(animationFrame);
	}, [
		activeTab,
		autoStatus?.activity,
		autoStatus?.enabled,
		autoStatus?.message,
		autoStatus?.recentSteps,
		open,
		scrollAgentStepsToTop,
	]);

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

	const handleCoachSend = async (quickMessage?: string) => {
		if (!canSendCoachMessage) {
			return;
		}
		const raw = (quickMessage || coachInput).trim();
		if (!raw) return;
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
				const buildNote = raw.replace(/^\/(build|team|doi)\s*/i, "").trim();
				setCoachMessages((prev) => [...prev, { role: "ai", text: "" }]);
				await waitForCoachThinking();
				const buildResponse = await requestBuildAdviceStream(
					buildNote || undefined,
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
				setCoachMessages((prev) => {
					const last = prev[prev.length - 1];
					if (!last || last.role !== "ai") {
						return prev;
					}

					const updated = [...prev];
					updated[updated.length - 1] = {
						...last,
						plan: buildResponse.plan || undefined,
						text:
							last.text.trim() ||
							buildResponse.answer ||
							"Coach chưa lấy được gợi ý build.",
					};
					return updated;
				});
				setLatestPlan(buildResponse.plan || null);
				setAutoExecutedThisPlan(false);
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
				await waitForCoachThinking();
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
				await waitForCoachThinking();
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
			await waitForCoachThinking();
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

	const handleStartAutoPlay = async (level: BuildAutoPlayLevel) => {
		if (!pendingPlan) return;
		try {
			const { state } = await startBuildAutoPlay(
				pendingPlan,
				level,
				pendingPreset
			);
			setAutoStatus(state);
			setPendingPlan(null);
		} catch (error: any) {
			setCoachMessages((prev) => [
				...prev,
				{ role: "ai", text: `Không thể bật auto: ${error.message}` },
			]);
		}
	};

	const handleExecuteBuild = (plan: any) => {
		if (autoEnabled) {
			return;
		}
		setPendingPlan(plan);
		setPendingPreset("balanced");
		setCoachMessages((prev) => [
			...prev,
			{
				role: "ai",
				kind: "permission",
				text: "Cấu hình tự động: Hãy chọn cách tôi thực hiện.",
			},
		]);
	};

	const handleStopAutoPlay = async () => {
		try {
			const { state } = await stopBuildAutoPlay();
			setAutoStatus(state);
		} catch (error: any) {
			setCoachMessages((prev) => [
				...prev,
				{ role: "ai", text: `Không thể tắt auto: ${error.message}` },
			]);
		}
	};

	const renderCoachMessage = (msg: CoachMessage, index: number) => {
		if (msg.role === "user") {
			return (
				<div key={index} className={styles.userMessage}>
					{msg.text}
				</div>
			);
		}

		const status = msg.status;
		const autoStepGroups = status
			? groupAutoSteps([...status.recentSteps].reverse())
			: [];
		return (
			<div
				key={index}
				className={`${styles.agentCard} ${
					msg.kind === "auto" ? styles.autoAgentCard : ""
				}`}
			>
				{msg.kind === "auto" && status ? (
					<>
						<div className={styles.agentHeader}>
							{status.enabled && <span className={styles.spinner} />}
							<span>
								Coach auto
								{status.level ? ` | ${AUTO_LEVEL_LABELS[status.level]}` : ""}
								{status.preset
									? ` | ${AUTO_PRESET_LABELS[status.preset]}`
									: ""}
								{status.effectivePreset &&
								status.preset &&
								status.effectivePreset !== status.preset
									? ` → ${AUTO_PRESET_LABELS[status.effectivePreset]}`
									: ""}
								{status.lobbyTempo && status.lobbyTempo !== "neutral"
									? ` | nhịp ${status.lobbyTempo === "fast" ? "nhanh" : "chậm"}`
									: ""}
							</span>
							{status.enabled && (
								<button onClick={handleStopAutoPlay}>Tắt auto</button>
							)}
						</div>
						{status.planName && (
							<div className={styles.agentMeta}>Build: {status.planName}</div>
						)}
						<div className={styles.agentCurrent}>
							{getAutoStatusHeadline(status)}
						</div>
						<div className={styles.agentSteps} ref={agentStepsRef}>
							{autoStepGroups.map((group, groupIndex) => (
								<div
									className={styles.agentStepGroup}
									key={`${group.title}-${groupIndex}`}
								>
									<div className={styles.agentStepTitle}>{group.title}</div>
									{group.steps.map((step, stepIndex) => (
										<div
											className={styles.agentStep}
											key={`${group.title}-${step}-${stepIndex}`}
										>
											| {step}
										</div>
									))}
								</div>
							))}
						</div>
					</>
				) : msg.kind === "permission" && pendingPlan ? (
					<div className={styles.permissionCard}>
						<div className={styles.permissionTitle}>
							Chọn cách Coach tự chơi build này
						</div>
						<div className={styles.permissionHint}>
							Coach sẽ giữ luật an toàn: không bán core, không bán tướng đã
							nâng sao hoặc đang cầm đồ.
						</div>
						<div className={styles.presetRow}>
							{AUTO_PRESETS.map((preset) => (
								<button
									key={preset.id}
									className={
										pendingPreset === preset.id
											? styles.presetActive
											: undefined
									}
									onClick={() => setPendingPreset(preset.id)}
									disabled={autoEnabled}
									title={preset.description}
								>
									{preset.label}
								</button>
							))}
						</div>
						<button
							onClick={() => handleStartAutoPlay(1)}
							disabled={autoEnabled}
						>
							1. Chỉ xếp quân theo đối thủ
						</button>
						<button
							onClick={() => handleStartAutoPlay(2)}
							disabled={autoEnabled}
						>
							2. Mua tướng + xếp đội hình
						</button>
						<button
							onClick={() => handleStartAutoPlay(3)}
							disabled={autoEnabled}
						>
							3. Thêm reroll / lên cấp
						</button>
						<button
							onClick={() => handleStartAutoPlay(4)}
							disabled={autoEnabled}
						>
							4. Full auto: bán rác, ghép và gắn đồ
						</button>
						<button
							className={styles.permissionCancel}
							onClick={() => {
								setPendingPlan(null);
								setAutoExecutedThisPlan(false);
							}}
							disabled={autoEnabled}
						>
							Hủy
						</button>
					</div>
				) : (
					<>
						{!msg.text && loading ? (
							<div className={styles.agentHeader}>
								<span className={styles.spinner} />
								<span>Coach đang đọc ván đấu...</span>
							</div>
						) : (
							<CoachMessageRenderer text={msg.text} />
						)}
					</>
				)}
			</div>
		);
	};

	return (
		<>
			{autoStatus?.enabled && <div className={styles.autoViewportGlow} />}

			{/* Floating button */}
			<button
				className={`${styles.fab} ${autoStatus?.enabled ? styles.autoFab : ""}`}
				onClick={() => setOpen((prev) => !prev)}
				title="Coach"
			>
				<TacticalAIRobotIcon className={styles.fabIcon} />
			</button>

			{/* Panel */}
			{open && (
				<div
					className={`${styles.panel} ${autoStatus?.enabled ? styles.autoPanel : ""}`}
				>
					<div className={styles.panelHeader}>
						<span className={styles.panelTitle}>
							<TacticalAIBrainIcon className={styles.panelTitleIcon} />
							<span>Coach Agent</span>
						</span>
						<button className={styles.closeBtn} onClick={() => setOpen(false)}>
							✕
						</button>
					</div>

					<div className={styles.tabs}>
						<button
							className={activeTab === "coach" ? styles.tabActive : styles.tab}
							onClick={() => setActiveTab("coach")}
						>
							Hỏi Coach
						</button>
						<button
							className={
								activeTab === "positioning" ? styles.tabActive : styles.tab
							}
							onClick={() => setActiveTab("positioning")}
						>
							Xếp Quân
						</button>
					</div>

					<div className={styles.panelBody}>
						{activeTab === "coach" && (
							<div className={styles.chatContainer}>
								<div className={styles.chatMessages} ref={chatMessagesRef}>
									{coachMessages.map(renderCoachMessage)}
								</div>

								{(!loading && !autoEnabled && pendingPlan === null) && (
									<div className={styles.floatingActions}>
										<button
											className={styles.floatingBtn}
											onClick={() => handleCoachSend("/pos")}
											disabled={!canSendCoachMessage}
										>
											Gợi ý xếp quân
										</button>

										{!latestPlan ? (
											<button
												className={styles.floatingBtn}
												onClick={() => handleCoachSend("/build")}
												disabled={!canSendCoachMessage}
											>
												Gợi ý đội hình
											</button>
										) : !autoExecutedThisPlan && pendingPlan === null ? (
											<button
												className={`${styles.floatingBtn} ${styles.floatingBtnExecute}`}
												onClick={() => {
													handleExecuteBuild(latestPlan);
													setAutoExecutedThisPlan(true);
												}}
												disabled={!canSendCoachMessage}
											>
												Triển khai đội hình
											</button>
										) : (
											<>
												<button
													className={styles.floatingBtn}
													onClick={() => handleCoachSend("/build")}
													disabled={!canSendCoachMessage}
												>
													Gợi ý đội hình
												</button>
												{pendingPlan === null && (
													<button
														className={`${styles.floatingBtn} ${styles.floatingBtnExecute}`}
														onClick={() => {
															handleExecuteBuild(latestPlan);
															setAutoExecutedThisPlan(true);
														}}
														disabled={!canSendCoachMessage}
													>
														Triển khai đội hình
													</button>
												)}
											</>
										)}

										<button
											className={styles.floatingBtn}
											onClick={() => handleCoachSend("/item")}
											disabled={!canSendCoachMessage}
										>
											Gợi ý trang bị
										</button>
									</div>
								)}

								<div className={styles.chatInputRow}>
									<input
										className={styles.chatInput}
										value={coachInput}
										onChange={(e) => setCoachInput(e.target.value)}
										onKeyDown={(e) =>
											e.key === "Enter" &&
											canSendCoachMessage &&
											handleCoachSend()
										}
										placeholder={
											autoEnabled
												? "Auto đang chạy, hãy tắt auto để chat tiếp..."
												: "Nhập câu hỏi..."
										}
										disabled={!canSendCoachMessage}
									/>
									<button
										className={styles.sendBtn}
										onClick={() => handleCoachSend()}
										disabled={!canSendCoachMessage}
									>
										Gửi
									</button>
								</div>
							</div>
						)}

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
					</div>
				</div>
			)}
		</>
	);
};

export { TacticalAIPanel };
