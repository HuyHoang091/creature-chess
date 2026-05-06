// ============================================================================
// @shoki/card-deck — BỘ BÀI CƠ BẢN (CARD DECK)
// ============================================================================
//
// Module cung cấp class CardDeck<T> — một bộ bài generic.
// THUẬT TOÁN: Fisher-Yates Shuffle (qua lodash.shuffle)
//
// File duy nhất, không có thư mục con.
//
// Được sử dụng bởi:
//   @creature-chess/gamemode/cardDeck.ts — tạo 5 deck (1 deck/cost level)
//
// HƯỚNG DẪN SỬA:
//   Đổi thuật toán shuffle → hàm shuffle() bên dưới
//   Đổi logic rút bài     → hàm take()
//   Đổi logic thêm bài    → hàm addCards()
// ============================================================================

import shuffle from "lodash.shuffle";

/**
 * Bộ bài generic.
 * - take():     Rút bài từ đầu deck
 * - addCards(): Thêm bài vào deck (mặc định shuffle sau khi thêm)
 * - shuffle():  Xáo trộn deck (Fisher-Yates)
 */
export class CardDeck<TCard> {
  private deck: TCard[];

  public constructor(deck?: TCard[]) {
    this.deck = deck || [];
  }

  /** Rút `count` lá bài từ cuối deck */
  public take(count?: 1): TCard;
  public take(count: number): TCard[];
  public take(count: number = 1): TCard | TCard[] {
    const results = this.deck.splice(this.deck.length - count, count);
    if (count === 1) return results[0];
    return results;
  }

  /** Thêm bài vào deck, mặc định shuffle sau khi thêm */
  public addCards(cards: TCard | TCard[], shouldShuffle: boolean = true) {
    if (Array.isArray(cards)) {
      this.deck.push(...cards);
    } else {
      this.deck.push(cards);
    }
    if (shouldShuffle) this.shuffle();
  }

  /** Xáo trộn deck — Thuật toán Fisher-Yates (O(n)) */
  public shuffle() {
    this.deck = shuffle(this.deck);
  }
}
