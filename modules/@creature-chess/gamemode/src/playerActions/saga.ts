import { all, call } from "redux-saga/effects";

import { buyCardPlayerActionSaga } from "./buyCard";
import { buyXpPlayerActionSaga } from "./buyXp";
import { craftItemInventoryPlayerActionSaga } from "./craftItem";
import { dropPiecePlayerActionSaga } from "./dropPiece";
import { equipItemPlayerActionSaga } from "./equipItem";
import { quickChatPlayerActionSaga } from "./quickChat";
import { readyUpPlayerActionSaga } from "./readyUp";
import { rerollCardsPlayerActionSaga } from "./rerollCards";
import { sellPiecePlayerActionSaga } from "./sellPiece";
import { spectatePlayerActionSaga } from "./spectate";
import { swapPiecePlayerActionSaga } from "./swapPiece";
import { toggleShopLockPlayerActionSaga } from "./toggleShopLock";

export const playerActionsSaga = function* () {
	yield all([
		call(buyXpPlayerActionSaga),
		call(buyCardPlayerActionSaga),
		call(rerollCardsPlayerActionSaga),
		call(toggleShopLockPlayerActionSaga),
		call(sellPiecePlayerActionSaga),
		call(dropPiecePlayerActionSaga),
		call(swapPiecePlayerActionSaga),
		call(spectatePlayerActionSaga),
		call(readyUpPlayerActionSaga),
		call(quickChatPlayerActionSaga),
		call(equipItemPlayerActionSaga),
		call(craftItemInventoryPlayerActionSaga),
	]);
};
