import React from "react";

import { BaseRegistrationInput } from "./BaseRegistrationInput";
import styles from "./NicknameSelection.module.css";

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
			info="You can update it later from Profile"
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
