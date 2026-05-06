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

import { createAppStore } from "./store";

const AppRoot = () => {
	const store = createAppStore();

	return (
		<ReduxProvider store={store}>
			<App />
		</ReduxProvider>
	);
};

const container = document.getElementById("approot");
const root = createRoot(container!);

root.render(<AppRoot />);
