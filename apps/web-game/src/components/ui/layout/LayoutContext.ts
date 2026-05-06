import * as React from "react";

export interface LayoutContextType {
	isVertical: boolean;
}

export const LayoutContext = React.createContext<LayoutContextType>({
	isVertical: false,
});

export const useLayoutContext = () => React.useContext(LayoutContext);
