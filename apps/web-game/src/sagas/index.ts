import { all, call } from "redux-saga/effects";
import { put } from "typed-redux-saga";
import { ConnectionStatus } from "~/services/connection-status";
import { PlayerListCommands } from "~/store/game/playerList/state";
import { SettingsCommands } from "~/store/game/settings/state";
import {
	setInGameCommand,
	updateConnectionStatus,
} from "~/store/game/ui/actions";

import { BoardSlice } from "@shoki/board";

import { RoundInfoCommands, PlayerCommands } from "@creature-chess/gamemode";
import { PieceModel } from "@creature-chess/models";
import { GameServerToClient } from "@creature-chess/networking";

import { clientBattleSaga } from "./battle";
import { clickPieceSaga } from "./board/clickPieceSaga";
import { clickTileSaga } from "./board/clickTileSaga";
import { handleQuickChat } from "./chat/quickChat";
import { closeShopOnFirstBuySaga } from "./closeShopOnFirstBuySaga";
import { finishGame } from "./finishGame";
import { preventAccidentalClose } from "./preventAccidentalClose";
import { roundUpdateSaga } from "./roundUpdate";
import { uiSaga } from "./ui";

export const gameSaga = function* (
	payload: GameServerToClient.GameConnectionPacket,
	slices: {
		boardSlice: BoardSlice<PieceModel>;
		benchSlice: BoardSlice<PieceModel>;
	}
) {
	const {
		players,
		game: { phase, phaseStartedAtSeconds },
		settings,
		playerId,
	} = payload;
	yield put(PlayerListCommands.updatePlayerListCommand(players));

	// Restore own inventory from playerList data after reconnect
	const ownPlayer = players.find((p) => p.id === playerId);
	if (ownPlayer?.inventory && ownPlayer.inventory.length > 0) {
		for (const itemId of ownPlayer.inventory) {
			yield put(
				PlayerCommands.playerInfoCommands.addItemToInventoryCommand(itemId)
			);
		}
	}

	const update = { phase, startedAt: phaseStartedAtSeconds };
	yield put(RoundInfoCommands.setRoundInfoCommand(update));

	yield put(SettingsCommands.setSettingsCommand(settings));

	yield put(
		slices.benchSlice.commands.setBoardSizeCommand({
			width: settings.benchSize,
			height: 1,
		})
	);

	yield put(
		slices.boardSlice.commands.setBoardSizeCommand({
			width: settings.boardWidth,
			height: settings.boardHalfHeight,
		})
	);

	yield put(setInGameCommand());
	yield put(updateConnectionStatus(ConnectionStatus.CONNECTED));

	// everything is initialized, so start the client's "game loop"

	yield all([
		call(finishGame),
		call(preventAccidentalClose),
		call(closeShopOnFirstBuySaga),
		call(clickTileSaga),
		call(clickPieceSaga),
		call(roundUpdateSaga),
		call(clientBattleSaga),
		call(uiSaga),
		call(handleQuickChat),
	]);
};
