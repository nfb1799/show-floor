/**
 * The full Booth Upgrade pool.
 *
 * Upgrades are data plus hook handlers. Nothing in scoring or the show engine
 * knows any of these ids exist — they are only ever folded through the hooks.
 */

import type { Rng } from '../rng';
import type { UpgradeDef, UpgradeTier } from '../types';
import { TIER_1 } from './tier1';
import { TIER_2 } from './tier2';
import { TIER_3 } from './tier3';

export const ALL_UPGRADES: readonly UpgradeDef[] = [...TIER_1, ...TIER_2, ...TIER_3];

const BY_ID = new Map(ALL_UPGRADES.map((u) => [u.id, u]));

export function getUpgrade(id: string): UpgradeDef {
  const found = BY_ID.get(id);
  if (!found) throw new Error(`Unknown upgrade: ${id}`);
  return found;
}

export function getUpgrades(ids: readonly string[]): UpgradeDef[] {
  return ids.map(getUpgrade);
}

/**
 * Higher tiers unlock as the run progresses, so show 1 shops do not offer a
 * $700 upgrade the player cannot afford and will never see again.
 */
export function tierAvailableAt(showIndex: number): UpgradeTier {
  if (showIndex >= 7) return 3;
  if (showIndex >= 3) return 2;
  return 1;
}

/** Picks `count` upgrades the player does not already own. */
export function offerUpgrades(
  rng: Rng,
  showIndex: number,
  ownedIds: readonly string[],
  count: number,
): UpgradeDef[] {
  const maxTier = tierAvailableAt(showIndex);
  const pool = ALL_UPGRADES.filter((u) => u.tier <= maxTier && !ownedIds.includes(u.id));
  return rng.shuffle(pool).slice(0, count);
}
