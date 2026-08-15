import { describe, expect, it } from 'vitest';
import { createRng } from '../rng';
import { InvalidPitchError, resolvePitch, type PitchInput } from './resolvePitch';
import { buyer, franchiseSpread, modifier, raw, slab } from '../testing/factories';
import type { Buyer, Card, Modifier } from '../types';

function pitch(
  cards: Card[],
  o: {
    buyer?: Buyer;
    upgrades?: Modifier[];
    conditions?: Modifier[];
    offerRatio?: number;
  } = {},
): PitchInput {
  return {
    cards,
    buyer: o.buyer ?? buyer(),
    upgrades: o.upgrades ?? [],
    conditions: o.conditions ?? [],
    ...(o.offerRatio !== undefined ? { offerRatio: o.offerRatio } : {}),
    rng: createRng('test'),
  };
}

/** Five holo-tier cards of one franchise, non-consecutive so Set Run misses. */
function holoWallCards() {
  return franchiseSpread('pocketBeasts', ['A', 'B', 'C', 'D', 'E'], {
    rarity: 'rareHolo',
  }).map((c, i) => ({ ...c, setNumber: i * 2 + 1 }));
}

describe('Appeal arithmetic', () => {
  it('computes (pitchValue + cardValues) x interest x offerRatio', () => {
    // common (base 2) x played (0.4) = 0.8; Loose Single adds 5, interest 1.
    const result = resolvePitch(pitch([raw({ rarity: 'common', condition: 'played' })]));

    expect(result.pitchType).toBe('looseCards');
    expect(result.pitchTypeLabel).toBe('Loose Single');
    expect(result.cardValue).toBeCloseTo(0.8);
    expect(result.value).toBeCloseTo(5.8);
    expect(result.interest).toBe(1);
    expect(result.appeal).toBeCloseTo(5.8);
    expect(result.uncappedOffer).toBeCloseTo(4.06);
    expect(result.offer).toBe(4); // rounded once, at the end
  });

  it('caps the offer at the buyer budget', () => {
    const result = resolvePitch(
      pitch([raw({ rarity: 'common', condition: 'played' })], { buyer: buyer({ budget: 3 }) }),
    );

    expect(result.uncappedOffer).toBeCloseTo(4.06);
    expect(result.cappedByBudget).toBe(true);
    expect(result.offer).toBe(3);
  });

  it('pays more when the player pushes the offer ratio up', () => {
    const cards = [raw({ rarity: 'common', condition: 'played' })];
    const base = resolvePitch(pitch(cards, { offerRatio: 0.7 }));
    const pushed = resolvePitch(pitch(cards, { offerRatio: 0.85 }));

    expect(base.offer).toBe(4);
    expect(pushed.offer).toBe(5); // 5.8 x 0.85 = 4.93
  });
});

describe('pitch type precedence', () => {
  it('picks the highest-scoring valid type', () => {
    // These cards are simultaneously Loose Cards, Rainbow, Full Case and Holo Wall.
    const result = resolvePitch(pitch(holoWallCards()));

    expect(result.pitchType).toBe('holoWall');
    // 5 rareHolo near mint = 175; (130 + 175) x 8 x 0.7
    expect(result.offer).toBe(1708);
  });

  it('breaks a tie toward the stronger type in table order', () => {
    // A tight budget caps every candidate at the same number.
    const result = resolvePitch(pitch(holoWallCards(), { buyer: buyer({ budget: 50 }) }));

    expect(result.offer).toBe(50);
    expect(result.pitchType).toBe('holoWall');
  });

  it('lets a modifier change which type wins', () => {
    // Rival Vendor's shape: a hook that rewards one specific pitch type. This is
    // why every candidate is scored in full rather than read off the table order.
    const rainbowLover = modifier('rainbowLover', 'upgrade', {
      onPitchScore: (ctx, fx) => {
        if (ctx.pitchType === 'rainbow') fx.addInterest(1000, 'Rival Vendor');
      },
    });

    const plain = resolvePitch(pitch(holoWallCards()));
    const boosted = resolvePitch(pitch(holoWallCards(), { upgrades: [rainbowLover] }));

    expect(plain.pitchType).toBe('holoWall');
    expect(boosted.pitchType).toBe('rainbow');
    expect(boosted.offer).toBeGreaterThan(plain.offer);
  });

  it('never leaves a legal pitch unscoreable', () => {
    const unrelated = [
      raw({ subject: 'Tidefin', franchise: 'pocketBeasts', setId: 'pb-origin' }),
      raw({ subject: 'Hal Brennan', franchise: 'diamondLeague', setId: 'dl-76', rarity: 'rare' }),
    ];
    const result = resolvePitch(pitch(unrelated));

    expect(result.pitchType).toBe('looseCards');
    expect(result.offer).toBeGreaterThan(0);
  });
});

describe('buyer wants', () => {
  it('adds interest per matching card', () => {
    const collector = buyer({
      wants: [{ kind: 'subject', subject: 'Emberclaw', interestPerCard: 4 }],
    });
    const cards = [
      raw({ subject: 'Emberclaw', setNumber: 1 }),
      raw({ subject: 'Emberclaw', setNumber: 2 }),
    ];

    const result = resolvePitch(pitch(cards, { buyer: collector }));

    expect(result.pitchType).toBe('pair');
    expect(result.interest).toBe(10); // base 2 + (4 x 2)
    expect(result.offer).toBe(112); // (12 + 4) x 10 x 0.7
  });

  it('only pays the volume bonus once the pitch is big enough', () => {
    const bulk = buyer({ wants: [{ kind: 'volume', minCards: 4, interestPerCard: 2 }] });
    const three = resolvePitch(pitch(holoWallCards().slice(0, 3), { buyer: bulk }));
    const five = resolvePitch(pitch(holoWallCards(), { buyer: bulk }));

    expect(three.interestAddLines).toHaveLength(0);
    expect(five.interestAddLines.map((l) => l.amount)).toEqual([10]);
  });

  it('applies a refusal as a multiplier, once per pitch', () => {
    const kid = buyer({ turnoff: { kind: 'anySlab', interestMult: 0.25 } });
    const result = resolvePitch(pitch([slab({ rarity: 'common', grade: 7 })], { buyer: kid }));

    expect(result.interestMultLines).toEqual([
      { label: 'Refuses slabs', amount: 0.25, source: 'turnoff' },
    ]);
    expect(result.interest).toBe(0.25);
    expect(result.offer).toBe(1); // (5 + 2.8) x 0.25 x 0.7 = 1.365
  });
});

describe('Flipper', () => {
  const flipper = (budget = 1_000_000) =>
    buyer({ archetype: 'flipper', budget, wants: [{ kind: 'valueOnly' }] });

  /**
   * The doc's Flipper ("card value must reach 2x the offer, or x0.5 Interest")
   * is unsatisfiable: the offer contains the card value, so the test reduces to
   * V >= 1.4(P + V), which has no solution for any positive pitch value. He sat
   * permanently at x0.5. He now prices the cards and ignores the packaging.
   */
  it('pays nothing for the pitch type', () => {
    const cards = franchiseSpread('grimoire', ['A', 'B', 'C', 'D', 'E'], { rarity: 'rare' });
    const result = resolvePitch(pitch(cards, { buyer: flipper() }));

    expect(result.pitchType).toBe('fullCase'); // 85 value for anyone else
    expect(result.pitchValue).toBe(0);
    expect(result.value).toBeCloseTo(result.cardValue);
  });

  it('still counts the cards, and interest still applies', () => {
    const cards = franchiseSpread('grimoire', ['A', 'B', 'C', 'D', 'E'], { rarity: 'rare' });
    const result = resolvePitch(pitch(cards, { buyer: flipper() }));

    // 5 rare near mint = 60 card value, Full Case interest 5, ratio 0.7.
    expect(result.cardValue).toBeCloseTo(60);
    expect(result.interest).toBe(5);
    expect(result.offer).toBe(210);
  });

  it('never applies a blanket penalty', () => {
    const junk = [raw({ rarity: 'common', condition: 'played' })];
    expect(resolvePitch(pitch(junk, { buyer: flipper() })).interestMultLines).toHaveLength(0);
  });

  it('pays far less for junk dressed up as a good pitch type', () => {
    const junk = franchiseSpread('grimoire', ['A', 'B', 'C', 'D', 'E'], {
      rarity: 'common',
      condition: 'played',
    });
    const good = franchiseSpread('grimoire', ['A', 'B', 'C', 'D', 'E'], {
      rarity: 'ultra',
      condition: 'mint',
    });

    const toFlipper = (cards: typeof junk) =>
      resolvePitch(pitch(cards, { buyer: flipper() })).offer;
    const toAnyone = (cards: typeof junk) => resolvePitch(pitch(cards)).offer;

    // Both are a Full Case, but the Flipper prices what is actually in it.
    expect(toFlipper(junk) / toAnyone(junk)).toBeLessThan(0.1);
    expect(toFlipper(good) / toAnyone(good)).toBeGreaterThan(0.8);
  });
});

describe('interest floor', () => {
  it('floors additive interest at 1 before multipliers apply', () => {
    const drain = modifier('drain', 'condition', {
      onPitchScore: (_ctx, fx) => fx.addInterest(-10, 'Half-Price Bin'),
    });
    const result = resolvePitch(
      pitch([raw({ rarity: 'common', condition: 'played' })], { conditions: [drain] }),
    );

    expect(result.interest).toBe(1);
    expect(result.offer).toBe(4);
  });
});

describe('modifier hooks', () => {
  it('adds value, interest and interest multipliers', () => {
    const mods = [
      modifier('v', 'upgrade', { onPitchScore: (_c, fx) => fx.addValue(10, 'UV Case') }),
      modifier('i', 'upgrade', { onPitchScore: (_c, fx) => fx.addInterest(3, 'Playlist') }),
      modifier('m', 'condition', {
        onPitchScore: (_c, fx) => fx.multiplyInterest(0.5, 'Snob Crowd'),
      }),
    ];
    const result = resolvePitch(
      pitch([raw({ rarity: 'common', condition: 'played' })], {
        upgrades: [mods[0]!, mods[1]!],
        conditions: [mods[2]!],
      }),
    );

    expect(result.value).toBeCloseTo(15.8); // 5 + 0.8 + 10
    expect(result.interest).toBe(2); // (1 + 3) x 0.5
    expect(result.offer).toBe(22); // 15.8 x 2 x 0.7 = 22.12
  });

  it('can pay past the budget cap through onOfferFinalize', () => {
    // This channel is the only escape from budgets scaling slower than quota.
    const loudNeighbor = modifier('loud', 'upgrade', {
      onOfferFinalize: (_c, fx) => fx.multiplyOffer(2, 'Loud Neighbor'),
    });
    const result = resolvePitch(
      pitch([raw({ rarity: 'common', condition: 'played' })], {
        buyer: buyer({ budget: 3 }),
        upgrades: [loudNeighbor],
      }),
    );

    expect(result.cappedByBudget).toBe(true);
    expect(result.offer).toBe(6);
    expect(result.offer).toBeGreaterThan(result.budget);
  });

  it('exposes the gap the budget cap ate, for cap-recovery upgrades', () => {
    // Cap-breaking is the chosen answer to quota outrunning budgets, so this is
    // the shape those upgrades take: pay back a fraction of the lost appeal.
    let seenGap = 0;
    const recover = modifier('recover', 'upgrade', {
      onOfferFinalize: (ctx, fx) => {
        if (!ctx.cappedByBudget) return;
        seenGap = ctx.uncappedOffer - ctx.cappedOffer;
        fx.addOffer(seenGap * 0.5, 'Cap recovery');
      },
    });

    const result = resolvePitch(
      pitch(holoWallCards(), { buyer: buyer({ budget: 400 }), upgrades: [recover] }),
    );

    // Uncapped was 1708; the cap took 1308, half of which comes back.
    expect(seenGap).toBeCloseTo(1308);
    expect(result.offer).toBe(1054);
    expect(result.offer).toBeGreaterThan(result.budget);
  });

  it('never returns a negative offer', () => {
    const thief = modifier('thief', 'condition', {
      onOfferFinalize: (_c, fx) => fx.addOffer(-1000, 'Undercutter'),
    });
    const result = resolvePitch(
      pitch([raw({ rarity: 'common' })], { conditions: [thief] }),
    );

    expect(result.offer).toBe(0);
  });

  it('treats upgrades and conditions identically', () => {
    const hooks: Modifier['hooks'] = {
      onPitchScore: (_c, fx) => fx.addInterest(5, 'Same Effect'),
    };
    const asUpgrade = resolvePitch(
      pitch([raw({ rarity: 'rare' })], { upgrades: [modifier('x', 'upgrade', hooks)] }),
    );
    const asCondition = resolvePitch(
      pitch([raw({ rarity: 'rare' })], { conditions: [modifier('x', 'condition', hooks)] }),
    );

    expect(asUpgrade.offer).toBe(asCondition.offer);
    expect(asUpgrade.interestAddLines[0]?.source).toBe('upgrade');
    expect(asCondition.interestAddLines[0]?.source).toBe('condition');
  });
});

describe('purity', () => {
  it('returns the same result for the same input', () => {
    const cards = holoWallCards();
    const a = resolvePitch(pitch(cards));
    const b = resolvePitch(pitch(cards));
    expect(a).toEqual(b);
  });

  it('does not advance the caller RNG stream', () => {
    const rng = createRng('shared');
    const before = rng.state;
    resolvePitch({ ...pitch(holoWallCards()), rng });
    expect(rng.state).toBe(before);
  });
});

describe('invalid pitches', () => {
  it('rejects an empty pitch', () => {
    expect(() => resolvePitch(pitch([]))).toThrow(InvalidPitchError);
  });

  it('rejects more than five cards', () => {
    const six = Array.from({ length: 6 }, (_, i) => raw({ subject: `S${i}` }));
    expect(() => resolvePitch(pitch(six))).toThrow(InvalidPitchError);
  });

  it('rejects the same card pitched twice', () => {
    const card = raw({ id: 'dupe' });
    expect(() => resolvePitch(pitch([card, card]))).toThrow(InvalidPitchError);
  });
});
