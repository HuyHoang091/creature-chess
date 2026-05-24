import { Action, ReducersMapObject } from "@reduxjs/toolkit";
import { configureStore } from "@reduxjs/toolkit";
import createSagaMiddleware from "redux-saga";

import { Saga, Task } from "../effects";
import {
	createVariableStore,
	GetVariableFn,
	UpdateVariablesFn,
} from "./variablesStore";

export type Entity<TState, TVariables> = {
	readonly id: string;
	select: <T>(selector: (state: TState) => T) => T;
	runSaga: <S extends Saga>(saga: S, ...args: Parameters<S>) => Task;
	getVariable: GetVariableFn<TVariables>;
	put: (action: Action) => void;
	destroy: () => void;
};

type EntitySagaContext<TDependencies, TVariables> = {
	id: string;
	dependencies: TDependencies;
	getVariable: GetVariableFn<TVariables>;
	updateVariables: UpdateVariablesFn<TVariables>;
};

type EntityStaticProperties<TState> = {
	reducers: ReducersMapObject<TState>;
	rootSaga?: Saga;
};

export const entity = <
	TState,
	TDependencies extends {} = {},
	TVariables extends {} = {},
>(
	{ reducers, rootSaga }: EntityStaticProperties<TState>,
	id: string,
	dependencies: TDependencies = {} as TDependencies,
	initialVariables: TVariables = {} as TVariables
): Entity<TState, TVariables> => {
	const variableStore = createVariableStore<TVariables>(initialVariables);

	const sagaMiddleware = createSagaMiddleware<
		EntitySagaContext<TDependencies, TVariables>
	>({
		context: {
			id,
			dependencies,
			getVariable: variableStore.getVariable,
			updateVariables: variableStore.updateVariables,
		},
	});

	const store = configureStore({
		reducer: reducers,
		middleware: (getDefaultMiddleware) =>
			getDefaultMiddleware({
				thunk: false,
				serializableCheck: false,
			}).concat(sagaMiddleware),
	});

	const tasks: Task[] = [];

	if (rootSaga) {
		tasks.push(sagaMiddleware.run(rootSaga));
	}

	return {
		id,
		select: <T>(selector: (state: TState) => T) => selector(store.getState()),
		getVariable: variableStore.getVariable,
		runSaga: <S extends Saga>(saga: S, ...args: Parameters<S>) => {
			const task = sagaMiddleware.run(saga, ...args);
			tasks.push(task);
			return task;
		},
		put: (action: Action) => store.dispatch(action),
		destroy: () => {
			tasks.forEach(task => task.cancel());
		}
	};
};

export const entityFactory =
	<TState, TDependencies extends {} = {}, TVariables extends {} = {}>(
		statics:
			| EntityStaticProperties<TState>
			| ((dependencies: TDependencies) => EntityStaticProperties<TState>)
	) =>
	(
		id: string,
		dependencies: TDependencies = {} as TDependencies,
		initialVariables: TVariables = {} as TVariables
	) => {
		if (typeof statics === "function") {
			return entity(statics(dependencies), id, dependencies, initialVariables);
		}

		return entity(statics, id, dependencies, initialVariables);
	};
