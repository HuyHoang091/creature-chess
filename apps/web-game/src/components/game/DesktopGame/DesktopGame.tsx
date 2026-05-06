import * as React from "react";

import { useSelector } from "react-redux";
import { useLocalPlayerId } from "~/auth/context";
import { AppState } from "~/store";
import { StatsState } from "~/store/game/stats/state";

import { BoardSelectors } from "@shoki/board";

import { GamePhase, PieceModel } from "@creature-chess/models";

import { Footer } from "../../ui/Footer";
import { PieceBattleStats } from "../PieceBattleStats";
import { TopBarTFT } from "../TopBarTFT";
import { BoardContainer } from "../board";
import { CardShop } from "../cardShop/cardShop";
import { PlayerListTFT } from "../playerList/PlayerListTFT";
import { PlayerGameProfile } from "../profile";
import { Settings } from "../settings";
import { SynergyPanel } from "../synergy/SynergyPanel";
import styles from "./DesktopGame.module.css";

// Baseline game width — giao diện được thiết kế cho 1280px
const BASE_WIDTH = 1280;

/** Scale toàn bộ giao diện khi viewport nhỏ hơn baseline */
function useViewportScale(ref: React.RefObject<HTMLDivElement>) {
	React.useEffect(() => {
		const el = ref.current;
		if (!el) return;

		const update = () => {
			const vw = window.innerWidth;
			const vh = window.innerHeight;

			// Chỉ scale khi viewport nhỏ hơn baseline
			const scaleByWidth = vw / BASE_WIDTH;
			const scale = Math.min(scaleByWidth, 1); // Không scale lớn hơn 100%

			if (scale < 1) {
				// Scale xuống và điều chỉnh kích thước container
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

	const ownedPieces = useSelector<AppState, PieceModel[]>((state) =>
		[...BoardSelectors.getAllPieces(state.game.board)].filter(
			(p) => p.ownerId === localPlayerId
		)
	);

	const stats = useSelector<AppState, StatsState>((state) => state.game.stats);

	const inPreparingPhase = useSelector<AppState, boolean>(
		(state) => state.game.roundInfo.phase === GamePhase.PREPARING
	);

	return (
		<div className={styles.gameContainer} ref={containerRef}>
			{/* === TOP BAR === */}
			<div className={styles.topBarArea}>
				<TopBarTFT
					onToggleStats={() => setShowStats((prev) => !prev)}
					onOpenSettings={() => setShowSettingsModal(true)}
					showingStats={showStats}
				/>
			</div>

			{/* === LEFT: Synergies === */}
			<div className={styles.synergyColumn}>
				<SynergyPanel />
			</div>

			{/* === CENTER: Board === */}
			<div className={styles.centerArea}>
				<div className={styles.boardArea}>
					<BoardContainer />
				</div>
			</div>

			{/* === RIGHT: Player List OR Stats === */}
			<div className={styles.playerListColumn}>
				{showStats ? (
					<div className={styles.statsPanel}>
						<div className={styles.statsPanelTitle}>Battle Stats</div>
						{inPreparingPhase ? (
							<PieceBattleStats pieces={ownedPieces} stats={stats} />
						) : (
							<span
								style={{
									color: "#a09b8c",
									fontSize: "12px",
									padding: "8px",
									display: "block",
								}}
							>
								Stats available during preparation phase...
							</span>
						)}
					</div>
				) : (
					<PlayerListTFT />
				)}
			</div>

			{/* === BOTTOM-LEFT: Profile/Controls === */}
			<div className={styles.shopControls}>
				<PlayerGameProfile />
			</div>

			{/* === BOTTOM-RIGHT: Shop === */}
			<div className={styles.shopCards}>
				<CardShop />
			</div>

			{/* === SETTINGS MODAL === */}
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
								✕
							</button>
						</div>
						<Settings />
						<div
							style={{
								marginTop: "16px",
								paddingTop: "12px",
								borderTop: "1px solid rgba(200,170,110,0.2)",
							}}
						>
							<Footer />
						</div>
					</div>
				</div>
			)}
		</div>
	);
};

export { DesktopGame };
