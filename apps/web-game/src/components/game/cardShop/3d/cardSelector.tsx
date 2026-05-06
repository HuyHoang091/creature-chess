import * as React from "react";

import { faArrowRight, faArrowLeft } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import classNames from "classnames";

import { Card as CardModel } from "@creature-chess/models";

import { Card3D as Card } from "./card";
import styles from "./CardShop3D.module.css";

type Props = {
	cards: (CardModel | null)[];
	ownedDefinitionIds: number[];
	money: number;
	onSelectCard?: (index: number | null) => void;
};

function useCardScroll(cards: Props["cards"]) {
	const [activeIndex, setActiveCardIndex] = React.useState<number>(0);

	const goNext = React.useCallback(() => {
		setActiveCardIndex((prev) => {
			let cur = null;

			while (cur === null) {
				prev = prev + 1;

				if (prev >= cards.length) {
					prev = 0;
				}

				cur = cards[prev];
			}

			return prev;
		});
	}, [cards]);

	const goPrevious = React.useCallback(() => {
		setActiveCardIndex((prev) => {
			let cur = null;

			while (cur === null) {
				prev = prev - 1;

				if (prev < 0) {
					prev = cards.length - 1;
				}

				cur = cards[prev];
			}

			return prev;
		});
	}, [cards]);

	// set back to first card when the cards change
	React.useEffect(() => {
		setActiveCardIndex(0);
	}, [cards]);

	// skip null cards
	React.useEffect(() => {
		if (cards[activeIndex] === null) {
			goNext();
		}
	}, [activeIndex, cards, goNext]);

	// set random rotations for the cards whenever the active card changes
	const [rotations, setRandomRotations] = React.useState<number[]>([]);
	React.useEffect(() => {
		const newRotations: number[] = Array.from({ length: cards.length });

		newRotations[0] = Math.random() * 6 - 3;

		for (let i = 1; i < cards.length; i++) {
			newRotations[i] = Math.random() * 20 - 10;
		}

		setRandomRotations(newRotations);
	}, [cards, activeIndex]);

	const card = cards[activeIndex] || null;

	const others = cards
		.slice(activeIndex + 1)
		.concat(cards.slice(0, activeIndex));

	return {
		card,
		cardIndex: activeIndex,
		rotations,
		others,
		goNext,
		goPrevious,
	};
}

/**
 * todo: consider locking this to square aspect ratio, so
 * we can be a bit more stylish with the card layout
 */
const CardSelector: React.FunctionComponent<Props> = ({
	cards,
	ownedDefinitionIds,
	money,
	onSelectCard,
}) => {
	const { card, cardIndex, others, rotations, goNext, goPrevious } =
		useCardScroll(cards);

	const bg = `${APP_IMAGE_ROOT}/ui/textures/velvet.jpg`;

	React.useEffect(() => {
		if (onSelectCard) {
			onSelectCard(cardIndex);
		}
	}, [cardIndex, onSelectCard]);

	let cardRenderIndex = 0;
	const createCard = React.useCallback(
		(c: CardModel | null) => {
			if (c === null) {
				return null;
			}

			const isOwned = ownedDefinitionIds.includes(c.definitionId);
            const rotIndex = cardRenderIndex;
            cardRenderIndex++;
			return (
				<div
                    className={styles.cardStackCard}
                    key={c.id}
                    style={{ transform: `rotate(${rotations[rotIndex%rotations.length] || 0}deg)` }}
                >
					<Card alreadyOwned={isOwned} disabled={money < c.cost} card={c} />
				</div>
			);
		},
		[styles.cardStackCard, money, ownedDefinitionIds, rotations]
	);

	const cardStack: React.ReactNode[] = [];

	if (card) {
		cardStack.push(createCard(card));
	}

	others.forEach((c) => {
		cardStack.push(createCard(c));
	});

	return (
		<div className={styles.selectorContainer} style={{ backgroundImage: `url(${bg})` }}>
			<div className={styles.paginator}>
				<div className={styles.paginatorChip}>
					{Array.from({ length: cards.length }).map((_, i) =>
						cards[i] === null ? null : (
							<div
								key={i}
								className={classNames(styles.paginatorDot, {
									[styles.paginatorDotActive]: i === cardIndex,
								})}
							/>
						)
					)}
				</div>
			</div>
			<div
				className={classNames(styles.selectorControls, styles.controlLeft)}
				onClick={goPrevious}
			>
				<FontAwesomeIcon icon={faArrowLeft} />
			</div>
			<div className={styles.cardStack}>{cardStack}</div>
			<div
				className={classNames(styles.selectorControls, styles.controlRight)}
				onClick={goNext}
			>
				<FontAwesomeIcon icon={faArrowRight} />
			</div>
		</div>
	);
};

export { CardSelector };
