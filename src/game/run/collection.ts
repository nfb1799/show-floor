/**
 * Collection bonuses — the reason to curate rather than hoard.
 *
 * A run's collection only ever shrinks: cards sold are gone, and the shop deals
 * random singles, so buying is a lateral move. Nothing made a deck feel like it
 * was becoming *something*. Depth fixes that: hold enough of one franchise and
 * every card of it pitches harder, so selling off-franchise stock online reads
 * as sharpening rather than losing.
 *
 * Implemented as synthesised Modifiers so scoring needs no new concept — they
 * ride the same onPitchScore hook every upgrade uses.
 */

import { COLLECTION_DEPTH_TIERS } from '../constants';
import { getFranchise } from '../cards/catalog';
import type { Card, Modifier } from '../types';

export interface DepthEntry {
  readonly franchiseId: string;
  readonly name: string;
  readonly count: number;
  /** Interest each card of this franchise adds to a pitch. Zero below tier 1. */
  readonly interestPerCard: number;
  /** Cards needed for the next tier, or null at the top. */
  readonly nextAt: number | null;
}

function bonusFor(count: number): number {
  let bonus = 0;
  for (const tier of COLLECTION_DEPTH_TIERS) {
    if (count >= tier.minCards) bonus = tier.interestPerCard;
  }
  return bonus;
}

function nextThreshold(count: number): number | null {
  for (const tier of COLLECTION_DEPTH_TIERS) {
    if (count < tier.minCards) return tier.minCards;
  }
  return null;
}

/** Every franchise the player holds, deepest first. */
export function collectionDepth(cards: readonly Card[]): DepthEntry[] {
  const counts = new Map<string, number>();
  for (const card of cards) {
    counts.set(card.franchise, (counts.get(card.franchise) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([franchiseId, count]) => ({
      franchiseId,
      name: getFranchise(franchiseId).name,
      count,
      interestPerCard: bonusFor(count),
      nextAt: nextThreshold(count),
    }))
    .sort((a, b) => b.count - a.count);
}

/** Only the franchises deep enough to actually pay out. */
export function activeDepth(cards: readonly Card[]): DepthEntry[] {
  return collectionDepth(cards).filter((entry) => entry.interestPerCard > 0);
}

/**
 * Turns collection depth into modifiers the pitch scorer already understands.
 * Fed alongside the equipped upgrades, so nothing in resolvePitch changes.
 */
export function collectionModifiers(cards: readonly Card[]): Modifier[] {
  return activeDepth(cards).map((entry) => ({
    id: `collection:${entry.franchiseId}`,
    name: `${entry.name} depth`,
    kind: 'upgrade' as const,
    hooks: {
      onPitchScore: (ctx, fx) => {
        const matching = ctx.cards.filter((c) => c.franchise === entry.franchiseId).length;
        if (matching === 0) return;
        fx.addInterest(
          matching * entry.interestPerCard,
          `${entry.name} depth x${matching}`,
        );
      },
    },
  }));
}
