/* eslint-disable react/jsx-no-bind */
import React from "react";
import { useDispatch } from "react-redux";
import { useLocalPlayerId } from "~/auth/context";

import { PlayerActions } from "@creature-chess/gamemode";
import { QuickChatOption } from "@creature-chess/models";

import styles from "./QuickChat.module.css";

const QuickChatButton: React.FunctionComponent<{
	chatOption: QuickChatOption;
}> = ({ chatOption }) => {
	const dispatch = useDispatch();

	const sendingPlayerId = useLocalPlayerId();

	const onClick = () => {
		dispatch(
			PlayerActions.quickChatPlayerAction({
				sendingPlayerId,
				chatValue: chatOption,
			})
		);
	};
	return (
		<button onClick={onClick} className={styles.button}>
			{chatOption.toString()}
		</button>
	);
};
export { QuickChatButton };
