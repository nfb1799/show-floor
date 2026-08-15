/**
 * Run-level state: everything that survives between shows.
 *
 * Deliberately plain, serialisable data — no functions, no class instances, no
 * RNG object. Modifiers are stored as ids and rehydrated from their registries,
 * which is what makes the whole run saveable to localStorage.
 */

import type { Card } from '../types';
import type { ShowState } from '../show/showEngine';
import type { ShopStock } from '../shop/shop';

export type RunPhase = 'title' | 'setup' | 'inShow' | 'showResult' | 'shop' | 'runOver';

export interface RunStats {
  readonly showsCleared: number;
  readonly totalEarned: number;
  readonly cardsSold: number;
  readonly cardsBought: number;
  readonly biggestSale: number;
  readonly buyersWalked: number;
  readonly packsOpened: number;
  readonly cardsGraded: number;
  readonly upgradesBought: number;
}

export const EMPTY_STATS: RunStats = {
  showsCleared: 0,
  totalEarned: 0,
  cardsSold: 0,
  cardsBought: 0,
  biggestSale: 0,
  buyersWalked: 0,
  packsOpened: 0,
  cardsGraded: 0,
  upgradesBought: 0,
};

/** A pack that has been paid for but not yet sorted into stock. */
export interface PendingPack {
  readonly tierName: string;
  readonly cards: readonly Card[];
}

export interface RunSnapshot {
  readonly seed: string;
  readonly rngState: number;
  readonly bankroll: number;
  readonly inventory: readonly Card[];
  readonly ownedUpgradeIds: readonly string[];
  readonly equippedUpgradeIds: readonly string[];
  readonly tableTier: number;
  readonly casesBought: number;
  readonly priceGuides: number;
  readonly showIndex: number;
  readonly conditionIds: readonly string[];
  readonly rumor: string;
  readonly show: ShowState | null;
  readonly shop: ShopStock | null;
  /** Persisted: a paid-for pack must not vanish on reload. */
  readonly pendingPack: PendingPack | null;
  readonly phase: RunPhase;
  readonly runOverReason: string | null;
  readonly stats: RunStats;
}

export function mergeShowStats(stats: RunStats, show: ShowState): RunStats {
  return {
    ...stats,
    totalEarned: stats.totalEarned + show.earned,
    cardsSold: stats.cardsSold + show.stats.cardsSold,
    biggestSale: Math.max(stats.biggestSale, show.stats.biggestSale),
    buyersWalked: stats.buyersWalked + show.stats.buyersWalked,
    showsCleared: stats.showsCleared + (show.outcome === 'cleared' ? 1 : 0),
  };
}
