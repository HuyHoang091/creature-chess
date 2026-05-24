import { Card, PieceModel } from "@creature-chess/models";

import { getAllDefinitions } from "../definitions";
import { CardDeck } from "./cardDeck";

const COPIES_PER_DEFINITION = [29, 22, 18, 10, 9];

const createDeck = () =>
	new CardDeck({
		error: jest.fn(),
	} as any);

const getDeckCardsForCost = (deck: CardDeck, cost: number): Card[] =>
	((deck.decks[cost - 1] as unknown as { deck: Card[] }).deck ?? []);

const countDefinitionCopies = (deck: CardDeck, definitionId: number) =>
	deck.decks.reduce((total, costDeck) => {
		const cards = (costDeck as unknown as { deck: Card[] }).deck ?? [];

		return (
			total +
			cards.filter((card) => card.definitionId === definitionId).length
		);
	}, 0);

const createPiece = (definitionId: number, stage: number): PieceModel =>
	({
		id: `piece-${definitionId}-${stage}`,
		ownerId: "player-1",
		definitionId,
		definition: getAllDefinitions().find((d) => d.id === definitionId)!,
		facingAway: false,
		maxHealth: 100,
		currentHealth: 100,
		maxMana: 100,
		currentMana: 0,
		traits: [],
		items: [],
		stage,
		lastBattleStats: null,
	});

describe("CardDeck", () => {
	test("should seed each definition with the correct number of copies", () => {
		const deck = createDeck();

		getAllDefinitions().forEach((definition) => {
			expect(countDefinitionCopies(deck, definition.id)).toBe(
				COPIES_PER_DEFINITION[definition.cost - 1]
			);
		});
	});

	test("should seed the correct total number of cards per cost", () => {
		const deck = createDeck();

		const definitionsPerCost = getAllDefinitions().reduce<number[]>(
			(counts, definition) => {
				counts[definition.cost - 1] += 1;
				return counts;
			},
			[0, 0, 0, 0, 0]
		);

		COPIES_PER_DEFINITION.forEach((copies, costIndex) => {
			const cost = costIndex + 1;

			expect(getDeckCardsForCost(deck, cost)).toHaveLength(
				definitionsPerCost[costIndex] * copies
			);
		});
	});

	test("should return the correct number of copies when a piece goes back into the pool", () => {
		const deck = createDeck();
		const definitionId = 1;
		const before = countDefinitionCopies(deck, definitionId);

		deck.addPiece(createPiece(definitionId, 0));
		expect(countDefinitionCopies(deck, definitionId) - before).toBe(1);

		deck.addPiece(createPiece(definitionId, 1));
		expect(countDefinitionCopies(deck, definitionId) - before).toBe(4);

		deck.addPiece(createPiece(definitionId, 2));
		expect(countDefinitionCopies(deck, definitionId) - before).toBe(13);
	});
});
