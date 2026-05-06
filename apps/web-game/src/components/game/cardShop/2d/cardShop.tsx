import React from "react";
import {
    faArrowsRotate,
    faLock,
    faLockOpen,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useGamemodeSettings } from "~/contexts/GamemodeSettingsContext";
import { Card as CardModel } from "@creature-chess/models";
import { BalanceIcon } from "../../../ui/icon/BalanceIcon";
import { Card2D as Card } from "./card";

import styles from "./CardShop.module.css";

type Props = {
    cards: (CardModel | null)[];
    ownedDefinitionIds: number[];
    money: number;
    isLocked?: boolean;
    onReroll?: () => void;
    onToggleLock?: () => void;
    onBuy?: (index: number) => void;
};

export function CardShop({
    cards,
    money,
    ownedDefinitionIds,
    onReroll,
    onToggleLock,
    onBuy,
    isLocked,
}: Props) {
    return (
        <div className={styles.shop}>
            <div className={styles.cardsRow}>
                {cards.map((card, index) =>
                    card !== null ? (
                        <div className={styles.cardSlot} key={card.id}>
                            <Card
                                card={card}
                                money={money}
                                owned={ownedDefinitionIds.includes(card.definitionId)}
                                onBuy={() => onBuy?.(index)}
                            />
                        </div>
                    ) : (
                        <div className={styles.emptySlot} key={`empty-${index}`} />
                    )
                )}
            </div>
        </div>
    );
}
