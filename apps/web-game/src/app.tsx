import * as React from "react";
import { useEffect } from "react";
import { withErrorBoundary, useErrorBoundary } from "react-use-error-boundary";
import { AppRouter } from "./router/AppRouter";

export const App = withErrorBoundary(() => {
	const [error, resetError] = useErrorBoundary();

	useEffect(() => {
		// document.cookie.split(";").forEach((c) => {
		// 	document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
		// });
	}, []);

	if (error) {
		return (
			<div>
				<p>{(error as Error).message}</p>

				<p>{(error as Error).stack}</p>

				<button onClick={() => window.location.reload()}>Try again</button>
			</div>
		);
	}

	return <AppRouter />;
});
