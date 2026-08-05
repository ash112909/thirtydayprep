export type ShopItemKind = "food" | "toy";

export interface ShopItem {
  id: string;
  name: string;
  icon: string;
  cost: number;
  kind: ShopItemKind;
}

// Food is consumable (buy adds to a count, feeding spends one). Toys are a
// one-time permanent unlock — once owned, always playable, and they show up
// as decorations in the background scene.
export const SHOP_ITEMS: ShopItem[] = [
  { id: "kibble", name: "Kibble", icon: "🍖", cost: 15, kind: "food" },
  { id: "treat", name: "Treat", icon: "🍪", cost: 25, kind: "food" },
  { id: "ball", name: "Ball", icon: "🎾", cost: 40, kind: "toy" },
  { id: "yarn", name: "Yarn Ball", icon: "🧶", cost: 40, kind: "toy" },
  { id: "bone_toy", name: "Chew Toy", icon: "🦴", cost: 60, kind: "toy" },
];
