import * as React from "react";

import { Mic, MicOff, Volume2, VolumeX } from "lucide-react";
import { useVoiceChat } from "~/services/voiceChat";

import styles from "./VoiceChatControls.module.css";

/**
 * Compact voice-chat bar for the Private Lobby panel.
 * Renders null when the user is not in a private room context.
 */
export const VoiceChatControls: React.FC = () => {
	const { isAvailable, micEnabled, speakerEnabled, toggleMic, toggleSpeaker } =
		useVoiceChat();

	if (!isAvailable) {
		return null;
	}

	return (
		<div className={styles.bar}>
			<span className={styles.barLabel}>Voice</span>
			<div className={styles.btns}>
				{/* Mic toggle */}
				<button
					className={[
						styles.btn,
						micEnabled ? styles.btnOn : styles.btnOff,
					].join(" ")}
					title={micEnabled ? "Tắt mic" : "Bật mic"}
					onClick={() => toggleMic().catch(console.error)}
				>
					{micEnabled ? <Mic size={13} /> : <MicOff size={13} />}
				</button>

				{/* Speaker toggle */}
				<button
					className={[
						styles.btn,
						speakerEnabled ? styles.btnOn : styles.btnOff,
					].join(" ")}
					title={speakerEnabled ? "Tắt loa" : "Bật loa"}
					onClick={toggleSpeaker}
				>
					{speakerEnabled ? <Volume2 size={13} /> : <VolumeX size={13} />}
				</button>
			</div>
		</div>
	);
};
