import * as React from "react";

import { useSelector } from "react-redux";
import { useLocalPlayerId } from "~/auth/context";
import type { AppState } from "~/store";

import { BoardSelectors } from "@shoki/board";

import type { PieceModel } from "@creature-chess/models";
import {
	ELEMENT_TRAIT_IDS,
	countUniqueElementTraits,
} from "@creature-chess/models/gamemode/elementSynergyBalance";
import { allTraitsMap } from "@creature-chess/models/gamemode/traits";
import type { Trait } from "@creature-chess/models/gamemode/traits";

import { TraitIcon } from "../../ui/TraitIcon";
import styles from "./SynergyPanel.module.css";

type ActiveSynergy = {
	trait: Trait;
	count: number;
	activeTierIndex: number;
};

const TIER_CLASSES = [
	styles.tierBronze,
	styles.tierSilver,
	styles.tierGold,
	styles.tierChromatic,
	styles.tierChromatic,
];

function getActiveSynergies(pieces: PieceModel[]) {
	const counts = countUniqueElementTraits(pieces);

	return ELEMENT_TRAIT_IDS.map((traitId) => {
		const trait = allTraitsMap.get(traitId);
		const count = counts.get(traitId) ?? 0;

		if (!trait || count === 0) {
			return null;
		}

		const activeTierIndex = trait.tiers.reduce(
			(highestTierIndex, tier, tierIndex) =>
				count >= tier.amount ? tierIndex : highestTierIndex,
			-1
		);

		return {
			trait,
			count,
			activeTierIndex,
		};
	})
		.filter((synergy): synergy is ActiveSynergy => synergy !== null)
		.sort(
			(a, b) =>
				b.count - a.count ||
				b.activeTierIndex - a.activeTierIndex ||
				a.trait.name.localeCompare(b.trait.name)
		);
}

export function SynergyPanel() {
	const localPlayerId = useLocalPlayerId();
	const [hoveredTraitId, setHoveredTraitId] = React.useState<string | null>(
		null
	);

	const pieces = useSelector<AppState, PieceModel[]>((state) =>
		[...BoardSelectors.getAllPieces(state.game.board)].filter(
			(piece) => piece.ownerId === localPlayerId
		)
	);

	const synergies = React.useMemo(() => getActiveSynergies(pieces), [pieces]);

	if (synergies.length === 0) {
		return (
			<div className={styles.panel}>
				<div className={styles.emptyState}>No elements</div>
			</div>
		);
	}

	return (
		<div className={styles.panel}>
			{synergies.map(({ trait, count, activeTierIndex }) => (
				<div
					key={trait.id}
					className={`${styles.synergyItem} ${
						activeTierIndex >= 0 ? TIER_CLASSES[activeTierIndex] ?? "" : ""
					}`}
					onMouseEnter={() => setHoveredTraitId(trait.id)}
					onMouseLeave={() => setHoveredTraitId(null)}
				>
					<TraitIcon trait={trait.id} className={styles.icon} />
					<span className={styles.countBadge}>{count}</span>

					{hoveredTraitId === trait.id && (
						<div className={styles.tooltip}>
							<div className={styles.tooltipHeader}>
								<span className={styles.tooltipTitle}>{trait.name}</span>
								<span className={styles.tooltipCount}>{count}</span>
							</div>

							<div className={styles.thresholdRail}>
								{trait.tiers.map((tier) => {
									const isActive = count >= tier.amount;

									return (
										<span
											key={tier.amount}
											className={`${styles.thresholdStep} ${
												isActive
													? styles.thresholdStepActive
													: styles.thresholdStepInactive
											}`}
										>
											{tier.amount}
										</span>
									);
								})}
							</div>

							<div className={styles.tierList}>
								{trait.tiers.map((tier) => {
									const isActive = count >= tier.amount;

									return (
										<div
											key={tier.amount}
											className={`${styles.tierRow} ${
												isActive
													? styles.tierRowActive
													: styles.tierRowInactive
											}`}
										>
											<span className={styles.tierAmount}>{tier.amount}</span>
											<span className={styles.tierDescription}>
												{tier.description}
											</span>
										</div>
									);
								})}
							</div>
						</div>
					)}
				</div>
			))}
		</div>
	);
}
