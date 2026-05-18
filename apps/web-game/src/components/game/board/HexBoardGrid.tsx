import * as React from "react";

import classNames from "classnames";
import { useDrag, useDrop } from "react-dnd";

import { BoardSelectors, BoardState, HasId, PiecePosition } from "@shoki/board";

import { ClickBoardTileEvent, DropBoardItemEvent } from "@shoki-web/board-react";

import { PieceModel } from "@creature-chess/models";

import { getHexTileBounds } from "./hexLayout";

type RenderResult = {
	item: React.ReactNode | React.ReactNode[];
	draggable?: boolean;
};

type Props = {
	state: BoardState<PieceModel>;
	renderItem: (piece: HasId, x: number, y: number) => RenderResult;
	renderTileBackground?: (position: PiecePosition) => React.ReactNode;
	onDropItem?: (event: DropBoardItemEvent) => void;
	onClickTile?: (event: ClickBoardTileEvent) => void;
	dragDrop?: boolean;
	className?: string;
	lightTileClassName?: string;
	darkTileClassName?: string;
};

function HexDroppableTile({
	board,
	x,
	y,
	onDrop,
	onClick,
}: {
	board: BoardState<PieceModel>;
	x: number;
	y: number;
	onDrop?: (event: DropBoardItemEvent) => void;
	onClick?: (event: ClickBoardTileEvent) => void;
}) {
	const belowPieceLimit =
		board.pieceLimit === null || BoardSelectors.isBelowPieceLimit(board);

	const [{}, drop] = useDrop<{ id: string }, void, {}>({
		accept: "BoardItem",
		drop: ({ id }) => {
			if (!onDrop) {
				return;
			}

			onDrop({ id, x, y });
		},
		canDrop: ({ id }) => belowPieceLimit || Boolean(board.pieces[id]),
		collect: () => ({}),
	});

	const handleClick = React.useCallback(() => {
		onClick?.({ x, y });
	}, [onClick, x, y]);

	return (
		<div
			ref={drop}
			style={{
				position: "absolute",
				inset: 0,
			}}
			onClick={handleClick}
		/>
	);
}

const HexBoardItem = React.forwardRef<
	HTMLDivElement,
	{ x: number; y: number; size: BoardState["size"]; children: React.ReactNode }
>(({ x, y, size, children }, ref) => {
	const bounds = getHexTileBounds(size.width, size.height, x, y);
	const pieceInsetX = size.width === 7 && size.height === 6 ? 12 : 10;
	const pieceInsetTop = size.width === 7 && size.height === 6 ? 11 : 8;
	const pieceWidth = 100 - pieceInsetX * 2;
	const pieceHeight = size.width === 7 && size.height === 6 ? 77 : 82;

	return (
		<div
			ref={ref}
			style={{
				position: "absolute",
				left: `${bounds.left}%`,
				top: `${bounds.top}%`,
				width: `${bounds.width}%`,
				height: `${bounds.height}%`,
				zIndex: 60 + y,
				transition: "all var(--board-item-transition-dur, 0.2s) cubic-bezier(0.65, 0.05, 0.36, 1) 0s",
			}}
		>
			<div
				style={{
					position: "absolute",
					left: `${pieceInsetX}%`,
					top: `${pieceInsetTop}%`,
					width: `${pieceWidth}%`,
					height: `${pieceHeight}%`,
					transformOrigin: "center bottom",
				}}
			>
				{children}
			</div>
		</div>
	);
});

function DraggableHexBoardItem({
	id,
	x,
	y,
	size,
	children,
}: {
	id: string;
	x: number;
	y: number;
	size: BoardState["size"];
	children: React.ReactNode;
}) {
	const [{}, drag] = useDrag<{ id: string }, void, {}>({
		type: "BoardItem",
		item: { id },
	});

	return (
		<HexBoardItem ref={drag} x={x} y={y} size={size}>
			{children}
		</HexBoardItem>
	);
}

export function HexBoardGrid({
	state,
	renderItem,
	renderTileBackground,
	onDropItem,
	onClickTile,
	dragDrop = true,
	className,
	lightTileClassName,
	darkTileClassName,
}: Props) {
	const { size, piecePositions, pieces, locked } = state;

	const tiles = React.useMemo(() => {
		const tileElements: React.ReactNode[] = [];

		for (let y = 0; y < size.height; y++) {
			for (let x = 0; x < size.width; x++) {
				const bounds = getHexTileBounds(size.width, size.height, x, y);
				const isDark = (x + y) % 2 === 1;

				tileElements.push(
					<div
						key={`hex-tile-${x}-${y}`}
						className={classNames(
							isDark ? darkTileClassName : lightTileClassName
						)}
						style={{
							position: "absolute",
							left: `${bounds.left}%`,
							top: `${bounds.top}%`,
							width: `${bounds.width}%`,
							height: `${bounds.height}%`,
							zIndex: 10 + y,
						}}
						touch-action="none"
					>
						{renderTileBackground?.({ x, y })}
						{dragDrop && locked === false ? (
							<HexDroppableTile
								board={state}
								x={x}
								y={y}
								onDrop={onDropItem}
								onClick={onClickTile}
							/>
						) : null}
					</div>
				);
			}
		}

		return tileElements;
	}, [
		darkTileClassName,
		dragDrop,
		lightTileClassName,
		locked,
		onClickTile,
		onDropItem,
		renderTileBackground,
		size.height,
		size.width,
		state,
	]);

	const itemElements = React.useMemo(() => {
		const renderedItems: React.ReactNode[] = [];
		const entries = Object.entries(piecePositions);
		entries.sort(([, aId], [, bId]) => aId.localeCompare(bId));

		for (const [position, id] of entries) {
			if (!id) {
				continue;
			}

			const [x, y] = position.split(",").map((value) => parseInt(value, 10));
			const { item, draggable = false } = renderItem(pieces[id], x, y);

			if (dragDrop && draggable) {
				renderedItems.push(
					<DraggableHexBoardItem key={id} id={id} x={x} y={y} size={size}>
						{item}
					</DraggableHexBoardItem>
				);
			} else {
				renderedItems.push(
					<HexBoardItem key={id} x={x} y={y} size={size}>
						{item}
					</HexBoardItem>
				);
			}
		}

		return renderedItems;
	}, [dragDrop, piecePositions, pieces, renderItem, size]);

	return (
		<div
			className={className}
			style={{
				position: "relative",
				width: "100%",
				height: "100%",
			}}
		>
			{tiles}
			{itemElements}
		</div>
	);
}
