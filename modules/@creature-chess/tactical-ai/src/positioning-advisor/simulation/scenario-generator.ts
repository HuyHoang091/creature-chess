import { BoardSelectors, BoardState } from "@shoki/board";
import { PieceModel } from "@creature-chess/models";
import { getRandomBaseItem } from "@creature-chess/models/src/itemCatalog";

export interface EnemyScenario {
  name: string;
  board: BoardState<PieceModel>;
}

const swapPositions = (
  board: BoardState<PieceModel>
): BoardState<PieceModel> => {
  const positions = Object.entries(board.piecePositions);
  if (positions.length < 2) return board;

  const idx1 = Math.floor(Math.random() * positions.length);
  let idx2 = Math.floor(Math.random() * (positions.length - 1));
  if (idx2 >= idx1) idx2++;

  const [key1, pieceId1] = positions[idx1];
  const [key2, pieceId2] = positions[idx2];

  return {
    ...board,
    piecePositions: {
      ...board.piecePositions,
      [key1]: pieceId2,
      [key2]: pieceId1,
    },
  };
};

const swapPieceDefinitions = (
  board: BoardState<PieceModel>
): BoardState<PieceModel> => {
  const pieceIds = Object.keys(board.pieces);
  if (pieceIds.length < 2) return board;

  const idx1 = Math.floor(Math.random() * pieceIds.length);
  let idx2 = Math.floor(Math.random() * (pieceIds.length - 1));
  if (idx2 >= idx1) idx2++;

  const piece1 = board.pieces[pieceIds[idx1]];
  const piece2 = board.pieces[pieceIds[idx2]];

  return {
    ...board,
    pieces: {
      ...board.pieces,
      [pieceIds[idx1]]: {
        ...piece1,
        definitionId: piece2.definitionId,
        definition: piece2.definition,
        traits: piece2.traits,
        stage: piece2.stage,
        maxHealth: piece2.maxHealth,
        currentHealth: piece2.maxHealth,
        maxMana: piece2.maxMana,
        currentMana: 0,
      },
      [pieceIds[idx2]]: {
        ...piece2,
        definitionId: piece1.definitionId,
        definition: piece1.definition,
        traits: piece1.traits,
        stage: piece1.stage,
        maxHealth: piece1.maxHealth,
        currentHealth: piece1.maxHealth,
        maxMana: piece1.maxMana,
        currentMana: 0,
      },
    },
  };
};

const addRandomItem = (
  board: BoardState<PieceModel>
): BoardState<PieceModel> => {
  const pieceIds = Object.keys(board.pieces);
  if (pieceIds.length === 0) return board;

  const targetId = pieceIds[Math.floor(Math.random() * pieceIds.length)];
  const piece = board.pieces[targetId];

  if (piece.items.length >= 3) return board;

  const item = getRandomBaseItem();

  return {
    ...board,
    pieces: {
      ...board.pieces,
      [targetId]: {
        ...piece,
        items: [...piece.items, { itemId: item.id }],
      },
    },
  };
};

export const generateEnemyScenarios = (
  enemyBoard: BoardState<PieceModel>,
  numScenarios: number
): EnemyScenario[] => {
  const scenarios: EnemyScenario[] = [
    { name: "baseline", board: enemyBoard },
  ];

  const generators: Array<{
    name: string;
    fn: (b: BoardState<PieceModel>) => BoardState<PieceModel>;
  }> = [
    { name: "swap_positions", fn: swapPositions },
    { name: "swap_pieces", fn: swapPieceDefinitions },
    { name: "add_item", fn: addRandomItem },
  ];

  while (scenarios.length < numScenarios) {
    const gen = generators[(scenarios.length - 1) % generators.length];
    scenarios.push({
      name: `${gen.name}_${scenarios.length}`,
      board: gen.fn(enemyBoard),
    });
  }

  return scenarios;
};
