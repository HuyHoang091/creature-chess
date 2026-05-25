import React from "react";

import styles from "./PictureSelection.module.css";

import { AVAILABLE_PROFILE_PICTURES } from "@creature-chess/user/profile";

import { CreatureImage } from "../../../ui/creatureImage";
import { BaseRegistrationInput } from "./BaseRegistrationInput";

const PictureSelection: React.FunctionComponent<{
	currentImage: number;
	onChange: (picture: number) => void;
}> = ({ currentImage, onChange }) => (
		<BaseRegistrationInput
			heading="Profile Picture"
			info="Choose a profile picture - more can be unlocked!"
		>
			<div className={styles.pictureGrid}>
				{Object.entries(AVAILABLE_PROFILE_PICTURES).map(
					([pictureString, creatureName]) => {
						const picture = parseInt(pictureString, 10);
						const selected = currentImage === picture;

						return (
							<button
								type="button"
								className={`${styles.pictureCard} ${
									selected ? styles.pictureSelected : ""
								}`}
								key={picture}
								onClick={() => onChange(picture)}
								aria-pressed={selected}
								title={creatureName}
							>
								<span className={styles.pictureImage}>
									<CreatureImage definitionId={picture} />
								</span>
								<span className={styles.pictureName}>{creatureName}</span>
							</button>
						);
					}
				)}
			</div>
		</BaseRegistrationInput>
);

export { PictureSelection };
