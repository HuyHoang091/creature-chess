import React from "react";
import { useSelector } from "react-redux";
import { AppState } from "~/store";

import { GamePhase } from "@creature-chess/models";
import { getQuickChatOptions } from "@creature-chess/models/src/quickChat";

import { QuickChatButton } from "./quickChatButton";
import styles from "./QuickChat.module.css";

export function QuickChatButtonArray() {
	const phase = useSelector<AppState, GamePhase | null>(
		(state) => state.game.roundInfo.phase
	);
	const options = getQuickChatOptions(phase);
	return (
		<div className={styles.root}>
			<div className={styles.buttons}>
				{options &&
					Object.values(options).map((chat) => (
						<QuickChatButton chatOption={chat} key={chat} />
					))}
			</div>
		</div>
	);
}
