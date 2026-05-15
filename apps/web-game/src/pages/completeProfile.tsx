import React from "react";
import { useDispatch, useSelector } from "react-redux";

import { Page } from "~/components/Page";
import { RegistrationPage } from "~/components/menu/registration";
import { updateCurrentUser } from "~/services/authApi";
import { AppShellCommands } from "~/store/appShell/state";
import { AuthCommands } from "~/store/auth/state";
import { ProfileCommands } from "~/store/profile/state";
import { AppState } from "~/store/state";

export const CompleteProfilePage = () => {
	const dispatch = useDispatch();
	const token = useSelector((state: AppState) => state.auth.accessToken);

	return (
		<Page hasBackground>
			<RegistrationPage
				updateUser={async (nickname, image) => {
					if (!token) {
						return { error: "Missing access token" };
					}

					try {
						const updatedUser = await updateCurrentUser(token, {
							nickname,
							picture: image.toString(),
						});

						dispatch(ProfileCommands.setCurrentUser(updatedUser));
						dispatch(AuthCommands.setRequiresProfileCompletion(false));
						dispatch(AppShellCommands.setScreen("home"));

						return {};
					} catch (error) {
						return { error: (error as Error).message };
					}
				}}
			/>
		</Page>
	);
};
