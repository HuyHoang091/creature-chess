export interface TraitInfo {
  id: string;
  nameEn: string;
  nameVi: string;
  iconUrl: string;
}

const TRAIT_DATA: Record<string, TraitInfo> = {
  fire:    { id: "fire",    nameEn: "Fire",    nameVi: "Hỏa",   iconUrl: `${APP_IMAGE_ROOT}/ui/traits/trait-fire.svg` },
  water:   { id: "water",   nameEn: "Water",   nameVi: "Thủy",  iconUrl: `${APP_IMAGE_ROOT}/ui/traits/trait-water.svg` },
  earth:   { id: "earth",   nameEn: "Earth",   nameVi: "Thổ",   iconUrl: `${APP_IMAGE_ROOT}/ui/traits/trait-earth.svg` },
  wood:    { id: "wood",    nameEn: "Wood",    nameVi: "Mộc",   iconUrl: `${APP_IMAGE_ROOT}/ui/traits/trait-wood.svg` },
  metal:   { id: "metal",   nameEn: "Metal",   nameVi: "Kim",   iconUrl: `${APP_IMAGE_ROOT}/ui/traits/trait-metal.svg` },
  valiant: { id: "valiant", nameEn: "Valiant", nameVi: "Dũng",  iconUrl: `${APP_IMAGE_ROOT}/ui/traits/trait-valiant.svg` },
  arcane:  { id: "arcane",  nameEn: "Arcane",  nameVi: "Phép",  iconUrl: `${APP_IMAGE_ROOT}/ui/traits/trait-arcane.svg` },
  cunning: { id: "cunning", nameEn: "Cunning", nameVi: "Xảo",   iconUrl: `${APP_IMAGE_ROOT}/ui/traits/trait-cunning.svg` },
};

const nameLookup: Record<string, TraitInfo> = {};
for (const t of Object.values(TRAIT_DATA)) {
  nameLookup[t.id.toLowerCase()] = t;
  nameLookup[t.nameEn.toLowerCase()] = t;
  nameLookup[t.nameVi.toLowerCase()] = t;
}

export function lookupTrait(name: string): TraitInfo | null {
  const key = name.toLowerCase().trim();
  if (nameLookup[key]) return nameLookup[key];
  for (const t of Object.values(TRAIT_DATA)) {
    if (key.includes(t.id) || t.id.includes(key)) return t;
    if (key.includes(t.nameEn.toLowerCase()) || t.nameEn.toLowerCase().includes(key)) return t;
    if (key.includes(t.nameVi.toLowerCase()) || t.nameVi.toLowerCase().includes(key)) return t;
  }
  return null;
}

export function getTraitIconUrl(traitId: string): string {
  return TRAIT_DATA[traitId]?.iconUrl ?? "";
}
