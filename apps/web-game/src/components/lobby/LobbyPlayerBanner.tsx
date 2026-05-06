import * as React from "react";

import classNames from "classnames";

import { LobbyPlayer } from "@creature-chess/models/lobby";

import { PlayerAvatar, Title } from "../ui/player";
import styles from "./LobbyPlayerBanner.module.css";

type Props = {
	player: LobbyPlayer | null;
};

const NO_PLAYER_IMAGE = `${APP_IMAGE_ROOT}/ui/no_player_img.png`;

const LobbyPlayerBanner: React.FunctionComponent<Props> = ({ player }) => {
	if (!player) {
		return (
			<div className={classNames(styles.player, styles.bot)}>
				<div className={styles.avatarWrapper}>
					<img
						src={NO_PLAYER_IMAGE}
						alt="no player image"
						className={styles.avatar}
					/>
					<span>empty</span>
				</div>
			</div>
		);
	}

	return (
		<div className={styles.player}>
			<div className={styles.avatarWrapper}>
				<PlayerAvatar player={player} className={styles.avatar} />
				<span>{player.name}</span>
			</div>
			<Title title={player.profile?.title} />
		</div>
	);
};

export { LobbyPlayerBanner };
