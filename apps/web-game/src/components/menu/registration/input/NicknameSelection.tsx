import React from "react";

import styles from "./NicknameSelection.module.css";

import { BaseRegistrationInput } from "./BaseRegistrationInput";

export function NicknameSelection({
	nickname,
	maxLength,
	onChange,
	loading,
}: {
	nickname: string;
	maxLength: number;
	onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
	loading: boolean;
}) {
	return (
		<BaseRegistrationInput
			heading="Nickname"
			info="This nickname is permanent and cannot be changed"
		>
			<input
				className={styles.nameInput}
				maxLength={maxLength}
				disabled={loading}
				value={nickname}
				placeholder="Nickname"
				onChange={onChange}
			/>
		</BaseRegistrationInput>
	);
}
