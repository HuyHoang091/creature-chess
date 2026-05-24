import React from "react";

import { ShieldCheck, Swords, Trophy } from "lucide-react";
import { useDispatch, useSelector } from "react-redux";
import { CreatureImage } from "~/components/ui/creatureImage";
import { updateCurrentUser } from "~/services/authApi";
import { ProfileCommands } from "~/store/profile/state";
import { AppState } from "~/store/state";

import {
	AVAILABLE_PROFILE_PICTURES,
	MAX_NAME_LENGTH,
	validateNicknameFormat,
} from "@creature-chess/user/profile";

import styles from "./ProfilePage.module.css";

export const ProfilePage = () => {
	const dispatch = useDispatch();
	const token = useSelector((state: AppState) => state.auth.accessToken);
	const currentUser = useSelector(
		(state: AppState) => state.profile.currentUser
	);
	const [nickname, setNickname] = React.useState(currentUser?.nickname || "");
	const [picture, setPicture] = React.useState(
		currentUser?.profile?.picture || 1
	);
	const [personalInfo, setPersonalInfo] = React.useState(
		currentUser?.profile?.personalInfo || ""
	);
	const [saving, setSaving] = React.useState(false);
	const [message, setMessage] = React.useState<string | null>(null);
	const [error, setError] = React.useState<string | null>(null);

	React.useEffect(() => {
		setNickname(currentUser?.nickname || "");
		setPicture(currentUser?.profile?.picture || 1);
		setPersonalInfo(currentUser?.profile?.personalInfo || "");
	}, [currentUser?.id]);

	const onSave = async () => {
		if (!token) {
			setError("Account session is missing");
			return;
		}

		const nicknameError = validateNicknameFormat(nickname.trim());
		if (nicknameError) {
			setError(nicknameError);
			return;
		}

		setSaving(true);
		setError(null);
		setMessage(null);
		try {
			const updated = await updateCurrentUser(token, {
				nickname: nickname.trim(),
				picture: picture.toString(),
				personalInfo,
			});
			dispatch(ProfileCommands.setCurrentUser(updated));
			setMessage("Profile updated");
		} catch (saveError) {
			setError((saveError as Error).message);
		} finally {
			setSaving(false);
		}
	};

	if (!currentUser) {
		return (
			<div className={styles.empty}>
				Profile management requires an account.
			</div>
		);
	}

	return (
		<div className={styles.root}>
			<div className={styles.hero}>
				<div className={styles.portrait}>
					<CreatureImage definitionId={picture} />
				</div>
				<div className={styles.heroText}>
					<div className={styles.kicker}>Player Profile</div>
					<h2>{currentUser.nickname || "New Player"}</h2>
					<div className={styles.stats}>
						<span>
							<Trophy size={14} />
							{currentUser.stats.wins} wins
						</span>
						<span>
							<Swords size={14} />
							{currentUser.stats.gamesPlayed} games
						</span>
						<span>
							<ShieldCheck size={14} />
							{currentUser.role === "admin" ? "Admin" : "Player"}
						</span>
					</div>
				</div>
			</div>

			<label className={styles.field}>
				<span>Nickname</span>
				<input
					value={nickname}
					maxLength={MAX_NAME_LENGTH}
					onChange={(event) => setNickname(event.target.value)}
				/>
			</label>

			<label className={styles.field}>
				<span>Personal Info</span>
				<textarea
					value={personalInfo}
					maxLength={280}
					onChange={(event) => setPersonalInfo(event.target.value)}
					placeholder="Short note shown on your profile"
				/>
				<small>{personalInfo.length}/280</small>
			</label>

			<div className={styles.avatarSection}>
				<div className={styles.sectionTitle}>Avatar</div>
				<div className={styles.avatarGrid}>
					{Object.entries(AVAILABLE_PROFILE_PICTURES).map(([id, name]) => {
						const imageId = parseInt(id, 10);
						const active = picture === imageId;

						return (
							<button
								key={id}
								className={`${styles.avatarOption} ${
									active ? styles.avatarActive : ""
								}`}
								onClick={() => setPicture(imageId)}
								title={name}
							>
								<CreatureImage definitionId={imageId} />
							</button>
						);
					})}
				</div>
			</div>

			{error && <div className={styles.error}>{error}</div>}
			{message && <div className={styles.success}>{message}</div>}

			<button className={styles.saveButton} onClick={onSave} disabled={saving}>
				{saving ? "Saving..." : "Save Profile"}
			</button>
		</div>
	);
};
