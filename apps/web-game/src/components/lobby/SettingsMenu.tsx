import React from "react";

import { useDispatch } from "react-redux";
import { lobbyStartNowEvent } from "~/store/lobby/actions";

import { GamemodeSettings } from "@creature-chess/models/settings";

import { Button } from "../ui/Button";
import { LobbySettingInput } from "./LobbySettingInput";
import styles from "./SettingsMenu.module.css";

// const settings = [
// 	["startingLevel", "startingMoney", "healthLostPerPiece"],
// 	["rerollCost", "rerollMultiplier", "buyXpCost", "buyXpAmount"],
// 	["boardWidth", "boardHalfHeight", "benchSize"],
// 	["battleTurnDuration"],
// ];

const settings = [["healthLostPerPiece"]];

export function SettingsMenu() {
	const dispatch = useDispatch();

	const onStartNow = React.useCallback(() => {
		dispatch(lobbyStartNowEvent());
	}, [dispatch]);

	return (
		<div className={styles.settingsMenu}>
			<h2 className={styles.header}>Super Secret Settings</h2>
			<div>
				<Button onClick={onStartNow}>Start Now</Button>
			</div>

			{settings.map((group, index) => (
				<div key={index}>
					{group.map((settingKey) => (
						<LobbySettingInput
							key={settingKey}
							type="number"
							settingsKey={settingKey as keyof GamemodeSettings}
						/>
					))}
				</div>
			))}
		</div>
	);
}
