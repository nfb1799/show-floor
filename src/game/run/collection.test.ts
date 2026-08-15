import { describe, expect, it } from 'vitest';
import { activeDepth, collectionDepth, collectionModifiers } from './collection';
import { COLLECTION_DEPTH_TIERS } from '../constants';
import { resolvePitch } from '../pitch/resolvePitch';
import { createRng } from '../rng';
import { buyer, franchiseSpread, raw } from '../testing/factories';
import type { Card } from '../types';

/** `count` cards of one franchise. */
function holding(franchise: string, count: number): Card[] {
  return Array.from({ length: count }, (_, i) =>
    raw({ franchise, subject: `S${i}`, setNumber: i + 1 }),
  );
}

describe('collection depth', () => {
  it('pays nothing below the first tier', () => {
    const shallow = holding('grimoire', COLLECTION_DEPTH_TIERS[0]!.minCards - 1);
    expect(activeDepth(shallow)).toHaveLength(0);
  });

  it('pays out once a franchise is deep enough', () => {
    const deep = holding('grimoire', COLLECTION_DEPTH_TIERS[0]!.minCards);
    const [entry] = activeDepth(deep);

    expect(entry?.franchiseId).toBe('grimoire');
    expect(entry?.interestPerCard).toBe(COLLECTION_DEPTH_TIERS[0]!.interestPerCard);
  });

  it('climbs through the tiers', () => {
    const top = COLLECTION_DEPTH_TIERS[COLLECTION_DEPTH_TIERS.length - 1]!;
    const [entry] = activeDepth(holding('grimoire', top.minCards));
    expect(entry?.interestPerCard).toBe(top.interestPerCard);
  });

  it('reports how far off the next tier is, and stops at the top', () => {
    const first = COLLECTION_DEPTH_TIERS[0]!;
    const top = COLLECTION_DEPTH_TIERS[COLLECTION_DEPTH_TIERS.length - 1]!;

    expect(collectionDepth(holding('grimoire', 1))[0]?.nextAt).toBe(first.minCards);
    expect(collectionDepth(holding('grimoire', top.minCards))[0]?.nextAt).toBeNull();
  });

  it('ranks franchises by how many you hold', () => {
    const mixed = [...holding('grimoire', 9), ...holding('pocketBeasts', 3)];
    expect(collectionDepth(mixed).map((e) => e.franchiseId)).toEqual([
      'grimoire',
      'pocketBeasts',
    ]);
  });
});

describe('depth in play', () => {
  const pitchWith = (cards: Card[], stock: Card[]) =>
    resolvePitch({
      cards,
      buyer: buyer(),
      upgrades: collectionModifiers(stock),
      conditions: [],
      rng: createRng('depth'),
    });

  it('raises interest for cards of a franchise you are deep in', () => {
    const pitch = franchiseSpread('grimoire', ['A', 'B', 'C'], { rarity: 'rare' });
    const shallow = pitchWith(pitch, holding('grimoire', 2));
    const deep = pitchWith(pitch, holding('grimoire', COLLECTION_DEPTH_TIERS[0]!.minCards));

    expect(deep.interest).toBeGreaterThan(shallow.interest);
    expect(deep.offer).toBeGreaterThan(shallow.offer);
  });

  it('only pays for the cards of that franchise, not the whole pitch', () => {
    const stock = holding('grimoire', COLLECTION_DEPTH_TIERS[0]!.minCards);
    const mixed = [
      raw({ franchise: 'grimoire', subject: 'A', rarity: 'rare' }),
      raw({ franchise: 'pocketBeasts', subject: 'B', rarity: 'rare' }),
    ];
    const line = pitchWith(mixed, stock).interestAddLines.find((l) => l.label.includes('depth'));

    expect(line?.amount).toBe(COLLECTION_DEPTH_TIERS[0]!.interestPerCard);
  });

  it('does nothing for a franchise you are shallow in', () => {
    const stock = holding('grimoire', COLLECTION_DEPTH_TIERS[0]!.minCards);
    const offFranchise = franchiseSpread('chromeRacers', ['A', 'B'], { rarity: 'rare' });
    expect(
      pitchWith(offFranchise, stock).interestAddLines.filter((l) => l.label.includes('depth')),
    ).toHaveLength(0);
  });
});
