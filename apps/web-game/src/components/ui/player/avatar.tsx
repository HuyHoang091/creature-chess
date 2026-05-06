import * as React from "react";

import classnames from "classnames";

import { PlayerListPlayer } from "@creature-chess/models/game/playerList";
import styles from "./Player.module.css";

function getCreatureUrl(definitionId: number) {
	return `${APP_IMAGE_ROOT}/creatures/front/${definitionId}.png`;
}

export function PlayerAvatar({
	player,
	className,
}: {
	player: Pick<PlayerListPlayer, "profile">;
	className?: string;
}) {
	if (!player || !player.profile?.picture) {
		return null;
	}

	return (
		<img
			className={classnames(styles.image, "avatar", className)}
			src={getCreatureUrl(player.profile.picture)}
		/>
	);
}
