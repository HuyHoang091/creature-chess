// import 'react-app-polyfill/ie11';
// import 'react-app-polyfill/stable';
// import 'core-js/stable';
// import 'regenerator-runtime/runtime';
// import { enableES5 } from 'immer';

// enableES5();

import * as React from "react";

import "pepjs";
import { createRoot } from "react-dom/client";
import { Provider as ReduxProvider } from "react-redux";
import { App } from "~/app";
import "~/assets/styles/global.css";
import { SessionBootstrapProvider } from "~/auth/SessionBootstrapProvider";
import { AUTH0_ENABLED } from "~/auth/auth0/config";
import { Auth0AuthProvider } from "~/auth/auth0/provider";

import { createAppStore } from "./store";

const AppRoot = () => {
	const store = createAppStore();

	const content = (
		<SessionBootstrapProvider>
			<App />
		</SessionBootstrapProvider>
	);

	return (
		<ReduxProvider store={store}>
			{AUTH0_ENABLED ? <Auth0AuthProvider>{content}</Auth0AuthProvider> : content}
		</ReduxProvider>
	);
};

const container = document.getElementById("approot");
const root = createRoot(container!);

root.render(<AppRoot />);
