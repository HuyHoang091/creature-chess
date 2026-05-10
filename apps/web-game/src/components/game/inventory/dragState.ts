type Listener = () => void;

let globalDraggingItemId: string | null = null;
let listeners: Listener[] = [];

export const setGlobalDraggingItemId = (id: string | null) => {
	globalDraggingItemId = id;
	listeners.forEach((fn) => fn());
};

export const getGlobalDraggingItemId = (): string | null => globalDraggingItemId;

export const subscribeToDragState = (fn: Listener): (() => void) => {
	listeners = [...listeners, fn];
	return () => {
		listeners = listeners.filter((l) => l !== fn);
	};
};
