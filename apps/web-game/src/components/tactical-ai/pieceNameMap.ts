export interface PieceInfo {
  id: number;
  name: string;
  cost: number;
  traits: [string, string];
}

const PIECE_DATA: Record<number, PieceInfo> = {
  1:  { id: 1,  name: "Budaye",       cost: 1, traits: ["wood", "valiant"] },
  2:  { id: 2,  name: "Anoleaf",      cost: 1, traits: ["wood", "cunning"] },
  3:  { id: 3,  name: "Rockitten",    cost: 1, traits: ["earth", "valiant"] },
  4:  { id: 4,  name: "Aardorn",      cost: 1, traits: ["earth", "cunning"] },
  5:  { id: 5,  name: "Nut",          cost: 1, traits: ["metal", "valiant"] },
  6:  { id: 6,  name: "Puparmor",     cost: 1, traits: ["metal", "valiant"] },
  7:  { id: 7,  name: "Embra",        cost: 1, traits: ["fire", "arcane"] },
  8:  { id: 8,  name: "Tweesher",     cost: 1, traits: ["water", "arcane"] },
  9:  { id: 9,  name: "Bamboon",      cost: 2, traits: ["wood", "valiant"] },
  10: { id: 10, name: "Chenipode",    cost: 2, traits: ["earth", "cunning"] },
  11: { id: 11, name: "Bolt",         cost: 2, traits: ["metal", "valiant"] },
  12: { id: 12, name: "Weavifly",     cost: 1, traits: ["metal", "arcane"] },
  13: { id: 13, name: "Cardiling",    cost: 2, traits: ["fire", "cunning"] },
  14: { id: 14, name: "Agnite",       cost: 2, traits: ["fire", "valiant"] },
  15: { id: 15, name: "Elowind",      cost: 2, traits: ["water", "arcane"] },
  16: { id: 16, name: "Fluttaflap",   cost: 2, traits: ["water", "valiant"] },
  17: { id: 17, name: "Velocitile",   cost: 3, traits: ["wood", "cunning"] },
  18: { id: 18, name: "Sapsnap",      cost: 3, traits: ["wood", "valiant"] },
  19: { id: 19, name: "Rockat",       cost: 3, traits: ["earth", "cunning"] },
  20: { id: 20, name: "Grintot",      cost: 3, traits: ["earth", "valiant"] },
  21: { id: 21, name: "Propellorcat", cost: 3, traits: ["metal", "cunning"] },
  22: { id: 22, name: "Sumchon",      cost: 3, traits: ["metal", "valiant"] },
  23: { id: 23, name: "Ignibus",      cost: 3, traits: ["fire", "valiant"] },
  24: { id: 24, name: "Ruption",      cost: 3, traits: ["fire", "arcane"] },
  25: { id: 25, name: "Noctalo",      cost: 3, traits: ["water", "cunning"] },
  26: { id: 26, name: "Lightmare",    cost: 3, traits: ["water", "valiant"] },
  27: { id: 27, name: "Narcileaf",    cost: 4, traits: ["wood", "arcane"] },
  28: { id: 28, name: "Coleorus",     cost: 4, traits: ["wood", "cunning"] },
  29: { id: 29, name: "Aardart",      cost: 4, traits: ["earth", "cunning"] },
  30: { id: 30, name: "Hubursa",      cost: 4, traits: ["earth", "arcane"] },
  31: { id: 31, name: "Sampsack",     cost: 4, traits: ["metal", "valiant"] },
  32: { id: 32, name: "Cairfrey",     cost: 3, traits: ["metal", "arcane"] },
  33: { id: 33, name: "Prophetoise",  cost: 4, traits: ["fire", "arcane"] },
  34: { id: 34, name: "Tikorch",      cost: 4, traits: ["fire", "cunning"] },
  35: { id: 35, name: "Nudimind",     cost: 4, traits: ["water", "arcane"] },
  36: { id: 36, name: "Dollfin",      cost: 4, traits: ["water", "valiant"] },
  37: { id: 37, name: "Arbelder",     cost: 5, traits: ["wood", "valiant"] },
  38: { id: 38, name: "Viviphyta",    cost: 5, traits: ["wood", "cunning"] },
  39: { id: 39, name: "Grintrock",    cost: 5, traits: ["earth", "valiant"] },
  40: { id: 40, name: "Jemuar",       cost: 5, traits: ["earth", "cunning"] },
  41: { id: 41, name: "Pyraminx",     cost: 5, traits: ["metal", "valiant"] },
  42: { id: 42, name: "AV8R",         cost: 5, traits: ["metal", "cunning"] },
  43: { id: 43, name: "Agnigon",      cost: 5, traits: ["fire", "valiant"] },
  44: { id: 44, name: "Cardinale",    cost: 5, traits: ["fire", "cunning"] },
  45: { id: 45, name: "Nudikill",     cost: 5, traits: ["water", "valiant"] },
  46: { id: 46, name: "Eaglace",      cost: 5, traits: ["water", "cunning"] },
  47: { id: 47, name: "Kirkanon",     cost: 5, traits: ["metal", "arcane"] },
};

const nameToId: Record<string, number> = {};
for (const p of Object.values(PIECE_DATA)) {
  nameToId[p.name.toLowerCase()] = p.id;
}

export function lookupPieceId(name: string): number | null {
  return nameToId[name.toLowerCase().trim()] ?? null;
}

export function lookupPieceInfo(definitionId: number): PieceInfo | null {
  return PIECE_DATA[definitionId] ?? null;
}
