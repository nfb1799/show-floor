/**
 * The between-show shop. Pure: every function takes state plus an RNG and
 * returns the next state, so the whole economy is testable without React.
 */

import {
  CASE_UPGRADE_COSTS,
  PACK_TIERS,
  SHOP_MIN_PRICE,
  SHOP_PRICE_MARKUP,
  SHOP_REROLL_BASE,
  SHOP_REROLL_STEP,
  SELL_ONLINE_RATE,
  SHOP_SINGLES_COUNT,
  SHOP_UPGRADES_COUNT,
  SUPPLIES,
  TABLE_TIERS,
  type PackTier,
  type SupplyDef,
} from '../constants';
import { cardValue } from '../cards/value';
import { generateCard } from '../cards/generate';
import { offerUpgrades } from '../upgrades/registry';
import type { Rng } from '../rng';
import type { Card, Rarity, UpgradeDef } from '../types';

export interface ShopSingle {
  readonly card: Card;
  readonly price: number;
  readonly sold: boolean;
}

export interface ShopStock {
  readonly showIndex: number;
  readonly singles: readonly ShopSingle[];
  readonly upgrades: readonly UpgradeDef[];
  readonly purchasedUpgradeIds: readonly string[];
  readonly rerolls: number;
}

export function priceForCard(card: Card): number {
  return Math.max(SHOP_MIN_PRICE, Math.round(cardValue(card) * SHOP_PRICE_MARKUP));
}

export function rerollCost(stock: ShopStock): number {
  return SHOP_REROLL_BASE + stock.rerolls * SHOP_REROLL_STEP;
}

function rollSingles(rng: Rng, showIndex: number, salt: number): ShopSingle[] {
  return Array.from({ length: SHOP_SINGLES_COUNT }, (_, i) => {
    const card = generateCard(rng, `shop-s${showIndex}-r${salt}-${i}`);
    return { card, price: priceForCard(card), sold: false };
  });
}

export function openShop(
  rng: Rng,
  showIndex: number,
  ownedUpgradeIds: readonly string[],
): ShopStock {
  return {
    showIndex,
    singles: rollSingles(rng, showIndex, 0),
    upgrades: offerUpgrades(rng, showIndex, ownedUpgradeIds, SHOP_UPGRADES_COUNT),
    purchasedUpgradeIds: [],
    rerolls: 0,
  };
}

/** Rerolls the singles only. Upgrade offers are fixed for the visit. */
export function rerollSingles(stock: ShopStock, rng: Rng): ShopStock {
  return {
    ...stock,
    singles: rollSingles(rng, stock.showIndex, stock.rerolls + 1),
    rerolls: stock.rerolls + 1,
  };
}

export function markSingleSold(stock: ShopStock, cardId: string): ShopStock {
  return {
    ...stock,
    singles: stock.singles.map((s) => (s.card.id === cardId ? { ...s, sold: true } : s)),
  };
}

export function markUpgradePurchased(stock: ShopStock, upgradeId: string): ShopStock {
  return { ...stock, purchasedUpgradeIds: [...stock.purchasedUpgradeIds, upgradeId] };
}

// ---------------------------------------------------------------------------
// Packs
// ---------------------------------------------------------------------------

export function getPackTier(id: string): PackTier {
  const found = PACK_TIERS.find((p) => p.id === id);
  if (!found) throw new Error(`Unknown pack tier: ${id}`);
  return found;
}

/**
 * Packs bypass the standard generation weights so a Hobby Box actually feels
 * different from a Bulk Lot.
 */
export function openPack(tier: PackTier, rng: Rng, idPrefix: string): Card[] {
  const rarityEntries = Object.entries(tier.rarityWeights) as [Rarity, number][];

  return Array.from({ length: tier.cardCount }, (_, i) => {
    // The base card supplies identity (franchise, set, subject); the pack tier
    // overrides rarity and slab odds so a Hobby Box actually feels different.
    const base = generateCard(rng, `${idPrefix}-${i}`);
    const core = {
      id: base.id,
      subject: base.subject,
      franchise: base.franchise,
      setId: base.setId,
      setNumber: base.setNumber,
      rarity: rng.weighted(rarityEntries),
    };

    return rng.next() < tier.slabChance
      ? { ...core, slabbed: true, grade: rng.int(7, 10) }
      : { ...core, slabbed: false, condition: base.slabbed ? 'nearMint' : base.condition };
  });
}

// ---------------------------------------------------------------------------
// Supplies and capacity
// ---------------------------------------------------------------------------

export function getSupply(id: string): SupplyDef {
  const found = SUPPLIES.find((s) => s.id === id);
  if (!found) throw new Error(`Unknown supply: ${id}`);
  return found;
}

/** Cost of the next table tier, or null when maxed. */
export function nextTableCost(tableTier: number): number | null {
  return TABLE_TIERS[tableTier + 1]?.cost ?? null;
}

export function upgradeSlotsFor(tableTier: number): number {
  return TABLE_TIERS[Math.min(tableTier, TABLE_TIERS.length - 1)]?.slots ?? TABLE_TIERS[0]!.slots;
}

/** Cost of the next permanent case slot, or null when maxed. */
export function nextCaseCost(casesBought: number): number | null {
  return CASE_UPGRADE_COSTS[casesBought] ?? null;
}

// ---------------------------------------------------------------------------
// Listing cards rather than pitching them
// ---------------------------------------------------------------------------

/**
 * What a card fetches if you list it online instead of selling it at the table.
 * Always below face value, so dumping stock is a real option and never a
 * better one than finding the buyer who wants it.
 */
export function onlineValue(card: Card): number {
  return Math.max(1, Math.round(cardValue(card) * SELL_ONLINE_RATE));
}

export function onlineValueOf(cards: readonly Card[]): number {
  return cards.reduce((sum, card) => sum + onlineValue(card), 0);
}
