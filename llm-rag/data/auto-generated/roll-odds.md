# Roll Odds & Economy Data (Auto-Generated from Game Engine)

> Source: `cardDeck.ts` — CARD_COST_CHANCES and CARD_DEFINITION_QUANTITIES

## Shop Roll Odds by Level

Each shop gives 5 cards. This table shows the % chance each card is a given cost tier.

| Level | Cost 1 | Cost 2 | Cost 3 | Cost 4 | Cost 5 |
|-------|--------|--------|--------|--------|--------|
| 1 | 100% | 0% | 0% | 0% | 0% |
| 2 | 70% | 30% | 0% | 0% | 0% |
| 3 | 60% | 35% | 5% | 0% | 0% |
| 4 | 50% | 35% | 15% | 2% | 0% |
| 5 | 40% | 35% | 23% | 5% | 1% |
| 6 | 33% | 30% | 30% | 9% | 3% |
| 7 | 30% | 30% | 30% | 12% | 5% |
| 8 | 24% | 30% | 30% | 16% | 7% |
| 9 | 22% | 30% | 25% | 20% | 10% |
| 10 | 19% | 25% | 25% | 25% | 14% |

## Unit Pool Sizes

Each creature definition has a fixed number of copies in the shared pool.

| Cost | Copies per creature | # Creatures at this cost | Total cards in pool |
|------|-------------------|------------------------|-------------------|
| 1 | 29 | 9 | 261 |
| 2 | 22 | 7 | 154 |
| 3 | 18 | 11 | 198 |
| 4 | 10 | 9 | 90 |
| 5 | 9 | 11 | 99 |

## Probability of Finding a Specific Unit

Chance of seeing at least 1 copy of a specific unit in a single shop (5 cards),
assuming full pool (no other players holding copies).

| Level | Specific Cost 1 | Specific Cost 2 | Specific Cost 3 | Specific Cost 4 | Specific Cost 5 |
|-------|----------------|----------------|----------------|----------------|----------------|
| 1 | 44.5% | 0% | 0% | 0% | 0% |
| 2 | 33.3% | 19.7% | 0% | 0% | 0% |
| 3 | 29.2% | 22.6% | 2.3% | 0% | 0% |
| 4 | 24.9% | 22.6% | 6.6% | 1.1% | 0% |
| 5 | 20.3% | 22.6% | 10.0% | 2.7% | 0.5% |
| 6 | 17.0% | 19.7% | 12.9% | 4.9% | 1.4% |
| 7 | 15.6% | 19.7% | 12.9% | 6.5% | 2.3% |
| 8 | 12.6% | 19.7% | 12.9% | 8.6% | 3.1% |
| 9 | 11.6% | 19.7% | 10.9% | 10.6% | 4.5% |
| 10 | 10.1% | 16.6% | 10.9% | 13.1% | 6.2% |

## Reroll Cost Analysis

How much gold (rerolls × 2g) to find a specific unit with >50% probability:

| Level | Specific Cost 3 | Specific Cost 4 | Specific Cost 5 |
|-------|----------------|----------------|----------------|
| 4 | 22g (11 rerolls) | 126g (63 rerolls) | ∞ |
| 5 | 14g (7 rerolls) | 50g (25 rerolls) | 306g (153 rerolls) |
| 6 | 12g (6 rerolls) | 28g (14 rerolls) | 102g (51 rerolls) |
| 7 | 12g (6 rerolls) | 22g (11 rerolls) | 62g (31 rerolls) |
| 8 | 12g (6 rerolls) | 16g (8 rerolls) | 44g (22 rerolls) |
| 9 | 14g (7 rerolls) | 14g (7 rerolls) | 32g (16 rerolls) |
| 10 | 14g (7 rerolls) | 10g (5 rerolls) | 22g (11 rerolls) |

## Upgrade Math

- **★★ (2-star)**: Need 3 copies of same creature
- **★★★ (3-star)**: Need 9 copies total (3 × ★★)

| Cost | Pool per creature | Needed for ★★★ | Remaining in pool after ★★★ |
|------|------------------|----------------|----------------------------|
| 1 | 29 | 9 | 20 (✅ Possible) |
| 2 | 22 | 9 | 13 (✅ Possible) |
| 3 | 18 | 9 | 9 (✅ Possible) |
| 4 | 10 | 9 | 1 (✅ Possible) |
| 5 | 9 | 9 | 0 (✅ Possible) |
