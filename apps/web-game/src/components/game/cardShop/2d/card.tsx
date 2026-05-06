import React, { useCallback } from "react";
import { Card as CardModel } from "@creature-chess/models";
import { TraitIcon } from "../../../ui/TraitIcon";
import { CreatureImage } from "../../../ui/creatureImage";
import styles from "./CardShop.module.css";

type CardShopCardProps = {
    card: CardModel | null;
    money: number;
    owned: boolean;
    onBuy?: () => void;
};

export function Card2D(props: CardShopCardProps) {
    const { card, money } = props;

    const canBuy = card && card.cost <= money;

    const onBuy = useCallback(() => {
        if (!props.onBuy || !card || card.cost > money) {
            return;
        }
        props.onBuy();
    }, [props, card, money]);

    if (!card) {
        return null;
    }

    const cardBgColor = ["", "#696969", "#2e762e", "#2e89ff", "#931093", "#e09429"][card.cost] || "#ff0000";
    const shadowSize = ["0px", "10px", "24px", "36px", "52px", "62px"][card.cost] || "0px";
    const shadowBlur = ["0px", "12px", "8px", "4px", "2px", "0px"][card.cost] || "0px";
    const nameBarBorderColor = ["", "#b4b4b4", "#4eba4e", "#0258d9", "#c94fbd", "#b86d05"][card.cost] || "#ff0000";

    return (
        <div
            className={`${styles.card} ${!canBuy ? styles.cardDisabled : ""}`}
            style={{ background: cardBgColor }}
            onClick={onBuy}
        >
            {/* Image */}
            <div className={styles.imageContainer}>
                <div 
                    className={styles.shadow} 
                    style={{ 
                        width: shadowSize,
                        height: shadowSize,
                        filter: `blur(${shadowBlur})`
                    }}
                />
                <CreatureImage
                    definitionId={card.definitionId}
                    className={styles.image}
                />
            </div>

            {/* Name + Cost */}
            <div 
                className={styles.nameBar}
                style={{ borderBottom: `3px solid ${nameBarBorderColor}` }}
            >
                <span className={styles.name}>{card.name}</span>
                <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                    {props.owned && (
                        <img
                            className={styles.ownedIcon}
                            src={`${APP_IMAGE_ROOT}/ui/arrow_up_green.png`}
                        />
                    )}
                    <span className={styles.costBadge}>🪙{card.cost}</span>
                </div>
            </div>

            {/* Traits */}
            {card.traits.length > 0 && (
                <div className={styles.traitRow}>
                    {card.traits.map((trait) => (
                        <TraitIcon
                            key={trait}
                            className={styles.traitIcon}
                            trait={trait}
                            label
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
