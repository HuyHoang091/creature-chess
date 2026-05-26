import * as React from "react";

import { useSelector } from "react-redux";
import { useLocalPlayerId } from "~/auth/context";
import { AppState } from "~/store";
import { StatsState } from "~/store/game/stats/state";

import { BoardSelectors } from "@shoki/board";

import { GamePhase, PieceModel } from "@creature-chess/models";

import { BattleAnalysis, requestBattleAnalysis } from "~/services/tacticalAI";
import { Footer } from "../../ui/Footer";
import {
	TacticalAIPanel,
	BattleReportOverlay,
	BattleLossCard,
} from "../../tactical-ai";
import { BoardContainer } from "../board";
import { CardShop } from "../cardShop/cardShop";
import { InventoryPanel } from "../inventory/InventoryPanel";
import { PieceBattleStats } from "../PieceBattleStats";
import { PlayerListTFT } from "../playerList/PlayerListTFT";
import { PlayerGameProfile } from "../profile";
import { Settings } from "../settings";
import { SynergyPanel } from "../synergy/SynergyPanel";
import { TopBarTFT } from "../TopBarTFT";
import { DesktopBattlefieldBackground } from "./DesktopBattlefieldBackground";
import { DesktopPrepOverlays } from "./DesktopPrepOverlays";
import styles from "./DesktopGame.module.css";

const BASE_WIDTH = 1280;

function useViewportScale(ref: React.RefObject<HTMLDivElement>) {
	React.useEffect(() => {
		const el = ref.current;
		if (!el) return;

		const update = () => {
			const vw = window.innerWidth;
			const scaleByWidth = vw / BASE_WIDTH;
			const scale = Math.min(scaleByWidth, 1);

			if (scale < 1) {
				el.style.transform = `scale(${scale})`;
				el.style.width = `${100 / scale}vw`;
				el.style.height = `${100 / scale}dvh`;
				el.dataset.scaled = "true";
			} else {
				el.style.transform = "";
				el.style.width = "";
				el.style.height = "";
				el.dataset.scaled = "false";
			}
		};

		update();
		window.addEventListener("resize", update);
		return () => window.removeEventListener("resize", update);
	}, [ref]);
}

const DesktopGame: React.FunctionComponent = () => {
	const containerRef = React.useRef<HTMLDivElement>(null);
	useViewportScale(containerRef);

	const localPlayerId = useLocalPlayerId();

	const [showStats, setShowStats] = React.useState(false);
	const [showSettingsModal, setShowSettingsModal] = React.useState(false);
	const [isShopCollapsed, setIsShopCollapsed] = React.useState(false);
	const [battleAnalysis, setBattleAnalysis] =
		React.useState<BattleAnalysis | null>(null);
	const [pendingLossAnalysis, setPendingLossAnalysis] =
		React.useState<BattleAnalysis | null>(null);

	const lastMatchBoardRef = React.useRef<AppState["game"]["match"]["board"]>(null);
	const analyzedRoundRef = React.useRef<number | null>(null);

	const ownedPieces = useSelector<AppState, PieceModel[]>((state) =>
		[...BoardSelectors.getAllPieces(state.game.board)].filter(
			(piece) => piece.ownerId === localPlayerId
		)
	);

	const stats = useSelector<AppState, StatsState>((state) => state.game.stats);
	const matchBoard = useSelector<AppState, AppState["game"]["match"]["board"]>(
		(state) => state.game.match.board
	);
	const roundNumber = useSelector<AppState, number>(
		(state) => state.game.roundInfo.round
	);

	const inPreparingPhase = useSelector<AppState, boolean>(
		(state) => state.game.roundInfo.phase === GamePhase.PREPARING
	);

	React.useEffect(() => {
		if (matchBoard) {
			lastMatchBoardRef.current = matchBoard;
			return;
		}

		const finalBoard = lastMatchBoardRef.current;
		if (!finalBoard || analyzedRoundRef.current === roundNumber) {
			return;
		}

		const pieces = BoardSelectors.getAllPieces(finalBoard);
		const myPieces = pieces.filter((piece) => piece.ownerId === localPlayerId);
		const enemyPieces = pieces.filter((piece) => piece.ownerId !== localPlayerId);

		if (
			myPieces.length === 0 ||
			enemyPieces.length === 0 ||
			!pieces.some((piece) => piece.lastBattleStats)
		) {
			lastMatchBoardRef.current = null;
			return;
		}

		const mySurvivors = myPieces.filter((piece) => piece.currentHealth > 0).length;
		const enemySurvivors = enemyPieces.filter(
			(piece) => piece.currentHealth > 0
		).length;
		const result =
			mySurvivors > enemySurvivors
				? "win"
				: enemySurvivors > mySurvivors
					? "loss"
					: "draw";

		analyzedRoundRef.current = roundNumber;
		lastMatchBoardRef.current = null;

		requestBattleAnalysis({
			myPieces,
			enemyPieces,
			result,
			roundNumber,
		})
			.then((response) => {
				if (response.success && response.analysis?.winner === "loss") {
					setPendingLossAnalysis(response.analysis);
				}
			})
			.catch((error) => {
				console.error("Battle analysis failed:", error);
			});
	}, [localPlayerId, matchBoard, roundNumber]);

	return (
		<div
			className={styles.gameContainer}
			ref={containerRef}
			data-shop-state={isShopCollapsed ? "collapsed" : "expanded"}
		>
			<DesktopBattlefieldBackground />

			<div className={styles.centerArea}>
				<div
					className={`${styles.boardArea} ${
						isShopCollapsed ? styles.boardAreaCollapsed : styles.boardAreaExpanded
					}`}
				>
					<BoardContainer />
				</div>
				<DesktopPrepOverlays />
			</div>

			<div className={styles.topBarArea}>
				<TopBarTFT
					onToggleStats={() => setShowStats((prev) => !prev)}
					onOpenSettings={() => setShowSettingsModal(true)}
					showingStats={showStats}
				/>
			</div>

			<div className={styles.synergyColumn}>
				<SynergyPanel />
			</div>

			<div className={styles.playerListColumn}>
				{showStats ? (
					<div className={styles.statsPanel}>
						<div className={styles.statsPanelTitle}>Battle Stats</div>
						{inPreparingPhase ? (
							<PieceBattleStats pieces={ownedPieces} stats={stats} />
						) : (
							<span className={styles.statsHint}>
								Stats available during preparation phase...
							</span>
						)}
					</div>
				) : (
					<PlayerListTFT />
				)}
			</div>

			<div className={styles.shopControls}>
				<div className={`${styles.controlCard} ${styles.inventoryCard}`}>
					<InventoryPanel />
				</div>
				<div className={`${styles.controlCard} ${styles.profileCard}`}>
					<PlayerGameProfile />
				</div>
			</div>

			<div
				className={`${styles.shopCards} ${
					isShopCollapsed ? styles.shopCardsCollapsed : styles.shopCardsExpanded
				}`}
			>
				<button
					type="button"
					className={styles.shopToggle}
					aria-expanded={!isShopCollapsed}
					aria-label="Toggle shop"
					onClick={() => setIsShopCollapsed((prev) => !prev)}
				>
					<span
						className={`${styles.shopToggleArrow} ${
							isShopCollapsed ? styles.shopToggleArrowCollapsed : ""
						}`}
					/>
				</button>
				<div className={styles.shopContent}>
					<CardShop />
				</div>
			</div>

			{showSettingsModal && (
				<div
					className={styles.modalOverlay}
					onClick={() => setShowSettingsModal(false)}
				>
					<div
						className={styles.modalContent}
						onClick={(e) => e.stopPropagation()}
					>
						<div className={styles.modalHeader}>
							<span className={styles.modalTitle}>Settings</span>
							<button
								className={styles.modalCloseBtn}
								onClick={() => setShowSettingsModal(false)}
							>
								×
							</button>
						</div>
						<Settings />
						<div className={styles.modalFooter}>
							<Footer />
						</div>
					</div>
				</div>
			)}

			<TacticalAIPanel />

			{pendingLossAnalysis && !battleAnalysis && (
				<BattleLossCard
					analysis={pendingLossAnalysis}
					onOpen={() => {
						setBattleAnalysis(pendingLossAnalysis);
						setPendingLossAnalysis(null);
					}}
					onDismiss={() => setPendingLossAnalysis(null)}
				/>
			)}

			<BattleReportOverlay
				analysis={battleAnalysis}
				onClose={() => setBattleAnalysis(null)}
			/>
		</div>
	);
};

export { DesktopGame };
