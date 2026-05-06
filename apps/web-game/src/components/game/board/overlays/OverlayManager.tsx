import React from "react";

import { useSelector } from "react-redux";
import { useLocalPlayerId } from "~/auth/context";
import { ConnectionStatus } from "~/services/connection-status";
import { AppState } from "~/store";

import { GamePhase } from "@creature-chess/models";

import { DefeatOverlay } from "./DefeatOverlay";
import { MatchRewardsOverlay } from "./MatchRewardsOverlay";
import { ReconnectOverlay } from "./reconnectOverlay";
import { VictoryOverlay } from "./VictoryOverlay";
import { WhirlpoolSpawn } from "./WhirlpoolSpawn";

type OverlayType = "reconnect" | "victory" | "defeat" | "matchRewards" | null;

function useActiveOverlay(): OverlayType {
    const connectionStatus = useSelector<AppState, ConnectionStatus>(
        (state) => state.game.ui.connectionStatus
    );
    const winnerId = useSelector<AppState, string | null>(
        (state) => state.game.ui.winnerId
    );
    const localPlayerId = useLocalPlayerId();
    const localPlayer = useSelector((state: AppState) =>
        state.game.playerList.find((p) => p.id === localPlayerId)
    );
    const matchRewards = useSelector(
        (state: AppState) => state.game.playerInfo.matchRewards
    );
    // const phase = useSelector<AppState, GamePhase | null>(
    //     (state) => state.game.roundInfo.phase
    // );
    const isSpectating = useSelector<AppState, boolean>(
        (state) => state.game.spectating.id !== null
    );

    // Priority cao → thấp
    if (connectionStatus === ConnectionStatus.DISCONNECTED) return "reconnect";
    if (winnerId) return "victory";
    if (localPlayer && localPlayer.health <= 0 && !winnerId && !isSpectating) return "defeat";
    if (matchRewards && !winnerId && !isSpectating) return "matchRewards";
    return null;
}

export function OverlayManager() {
    const active = useActiveOverlay();

    return (
        <>
            {active === "reconnect" && <ReconnectOverlay />}
            {active === "victory" && <VictoryOverlay />}
            {active === "defeat" && <DefeatOverlay />}
            {active === "matchRewards" && <MatchRewardsOverlay />}

            {/* WhirlpoolSpawn tự quản state internal, luôn mount */}
            <WhirlpoolSpawn />
        </>
    );
}
