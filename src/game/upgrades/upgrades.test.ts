import { describe, expect, it } from 'vitest';
import { ALL_UPGRADES, getUpgrade, offerUpgrades, tierAvailableAt } from './registry';
import { resolvePitch } from '../pitch/resolvePitch';
import { createRng } from '../rng';
import { buyer, franchiseSpread, raw, slab } from '../testing/factories';
import type { Buyer, Card, Modifier } from '../types';

function score(cards: Card[], upgrades: Modifier[], b: Buyer = buyer()) {
  return resolvePitch({
    cards,
    buyer: b,
    upgrades,
    conditions: [],
    rng: createRng('upgrade-test'),
  });
}

const u = (id: string) => getUpgrade(id);

describe('the pool as a whole', () => {
  it('ships roughly 40 upgrades across three tiers', () => {
    expect(ALL_UPGRADES.length).toBeGreaterThanOrEqual(38);
    for (const tier of [1, 2, 3] as const) {
      expect(ALL_UPGRADES.filter((up) => up.tier === tier).length).toBeGreaterThanOrEqual(10);
    }
  });

  it('has unique ids, real costs, and rules text', () => {
    const ids = ALL_UPGRADES.map((up) => up.id);
    expect(new Set(ids).size).toBe(ids.length);

    for (const up of ALL_UPGRADES) {
      expect(up.cost, up.id).toBeGreaterThan(0);
      expect(up.text.length, up.id).toBeGreaterThan(10);
      expect(up.kind).toBe('upgrade');
      expect(Object.keys(up.hooks).length, `${up.id} registers no hooks`).toBeGreaterThan(0);
    }
  });

  it('gates higher tiers behind run progress', () => {
    expect(tierAvailableAt(1)).toBe(1);
    expect(tierAvailableAt(3)).toBe(2);
    expect(tierAvailableAt(7)).toBe(3);

    const early = offerUpgrades(createRng('shop'), 1, [], 2);
    expect(early.every((up) => up.tier === 1)).toBe(true);
  });

  it('never offers something already owned', () => {
    const owned = ALL_UPGRADES.filter((up) => up.tier === 1).map((up) => up.id);
    expect(offerUpgrades(createRng('shop'), 1, owned, 2)).toHaveLength(0);
  });
});

describe('tier 1 effects', () => {
  it('UV Display Case pays per holo card', () => {
    const cards = [raw({ rarity: 'rareHolo' }), raw({ rarity: 'ultra', subject: 'B' })];
    const plain = score(cards, []);
    const boosted = score(cards, [u('uvDisplayCase')]);
    expect(boosted.interest - plain.interest).toBe(4);
  });

  it('Toploader Stack erases the condition penalty on raw value', () => {
    const cards = [raw({ rarity: 'rare', condition: 'played' })];
    const plain = score(cards, []);
    const boosted = score(cards, [u('toploaderStack')]);
    // rare base 12: played pays 4.8, near mint would pay 12.
    expect(plain.cardValue).toBeCloseTo(4.8);
    expect(boosted.value - plain.value).toBeCloseTo(7.2);
  });

  it('Toploader Stack does not downgrade a mint card', () => {
    const cards = [raw({ rarity: 'rare', condition: 'mint' })];
    expect(score(cards, [u('toploaderStack')]).value).toBeCloseTo(score(cards, []).value);
  });

  it('Comp Sheet is a sale-time effect, not a scoring one', () => {
    const cards = [slab({ rarity: 'rare', grade: 9 })];
    expect(score(cards, [u('cardLadder')]).offer).toBe(score(cards, []).offer);
  });
});

describe('tier 2 effects', () => {
  it('Half-Price Bin rewards width', () => {
    const five = franchiseSpread('grimoire', ['A', 'B', 'C', 'D', 'E'], { rarity: 'rare' });
    expect(score(five, [u('halfPriceBin')]).interest).toBeGreaterThan(score(five, []).interest);
  });

  it('Half-Price Bin only punishes singles that were above the interest floor', () => {
    const one = [raw({ rarity: 'rare', subject: 'Emberclaw' })];

    // A bare Loose Single sits at base interest 1, which is also MIN_INTEREST,
    // so the -2 is absorbed entirely. The downside is real only once a want or
    // another upgrade has lifted interest off the floor.
    const bare = buyer();
    expect(score(one, [u('halfPriceBin')], bare).interest).toBe(score(one, [], bare).interest);

    const keen = buyer({
      wants: [{ kind: 'subject', subject: 'Emberclaw', interestPerCard: 4 }],
    });
    expect(score(one, [u('halfPriceBin')], keen).interest).toBe(
      score(one, [], keen).interest - 2,
    );
  });

  it('Consignment Deal only fires when the budget actually caps you', () => {
    const cards = franchiseSpread('grimoire', ['A', 'B', 'C', 'D', 'E'], { rarity: 'rareHolo' });
    const uncapped = score(cards, [u('consignmentDeal')], buyer({ budget: 1_000_000 }));
    const capped = score(cards, [u('consignmentDeal')], buyer({ budget: 100 }));

    expect(uncapped.offerLines).toHaveLength(0);
    expect(capped.offer).toBeGreaterThan(100);
  });

  it('Consignment Deal recovery is bounded at one more budget', () => {
    // Appeal here is enormous relative to a $20 budget; without the bound this
    // single upgrade would cover the entire late-game shortfall by itself.
    const cards = franchiseSpread('grimoire', ['A', 'B', 'C', 'D', 'E'], {
      rarity: 'ultra',
      condition: 'mint',
    });
    const result = score(cards, [u('consignmentDeal')], buyer({ budget: 20 }));
    expect(result.offer).toBeLessThanOrEqual(40);
  });
});

describe('tier 3 effects', () => {
  it('Uncle Gary doubles only the buyers he did not scare off', () => {
    const cards = [raw({ rarity: 'rare' })];
    const blessed = buyer({ marks: ['gary:blessed'] });
    const plain = buyer();

    expect(score(cards, [u('uncleGary')], blessed).offer).toBe(
      score(cards, [], plain).offer * 2,
    );
    expect(score(cards, [u('uncleGary')], plain).offer).toBe(score(cards, [], plain).offer);
  });

  it('Rival Vendor reads the mark left when the buyer arrived', () => {
    const cards = [raw({ rarity: 'rare' })];
    const matched = buyer({ marks: ['rival:looseCards'] });
    const missed = buyer({ marks: ['rival:holoWall'] });

    expect(score(cards, [u('rivalVendor')], matched).interest).toBe(6); // 1 + 5
    expect(score(cards, [u('rivalVendor')], missed).interest).toBe(1); // 1 - 2, floored
  });

  it('The Completionist pays double on a Set Run', () => {
    const run = [
      raw({ setId: 'gr-codex', setNumber: 4, subject: 'A', rarity: 'rare' }),
      raw({ setId: 'gr-codex', setNumber: 5, subject: 'B', rarity: 'rare' }),
      raw({ setId: 'gr-codex', setNumber: 6, subject: 'C', rarity: 'rare' }),
    ];
    const plain = score(run, []);
    const boosted = score(run, [u('completionist')]);

    expect(plain.pitchType).toBe('setRun');
    expect(boosted.offer).toBe(plain.offer * 2);
  });
});

describe('the cap-breaking budget', () => {
  it('a full stack clears the 2.67x the late game demands', () => {
    // The wall documented in constants.ts plateaus at 2.67x from show 12 on.
    // If this drops below that, endless becomes unwinnable by construction.
    const stack = [
      'businessCards',
      'loudNeighbor',
      'neonOpenSign',
      'auctionScout',
      'consignmentDeal',
      'shopOwner',
    ].map(u);

    const cards = [
      slab({ franchise: 'grimoire', grade: 10, subject: 'A', rarity: 'ultra' }),
      slab({ franchise: 'grimoire', grade: 9, subject: 'B', rarity: 'ultra' }),
      slab({ franchise: 'grimoire', grade: 8, subject: 'C', rarity: 'ultra' }),
    ];
    const budget = 200;
    const result = score(cards, stack, buyer({ budget }));

    expect(result.cappedByBudget).toBe(true);
    expect(result.offer / budget).toBeGreaterThanOrEqual(2.67);
  });
});
