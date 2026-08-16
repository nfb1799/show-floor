/**
 * The binder a buyer opens when your pitch is worth more than their cash.
 *
 * Two things have to hold: it never hands over more value than the shortfall it
 * stands in for, and it actually gets close to that shortfall. The first is
 * correctness; the second is the whole mechanic — an early version drew on the
 * ordinary rarity weights, so a $400 trade arrived as five $2 commons and paid
 * out a tenth of what the tally had promised.
 */

import { describe, expect, it } from 'vitest';
import { createRng } from '../rng';
import { cardValue } from '../cards/value';
import { generateTradeOffer, tradeOfferValue } from './tradeStock';
import { TRADE_MAX_CARDS } from '../constants';
import { buyer } from '../testing/factories';
import type { Buyer } from '../types';

const TARGETS = [20, 50, 100, 200, 400];

function offerFor(seed: string, target: number, b: Buyer = buyer()) {
  return generateTradeOffer(createRng(seed), b, target, 'trade');
}

describe('what the binder offers', () => {
  it('never offers more than the shortfall', () => {
    for (const target of TARGETS) {
      for (let i = 0; i < 25; i++) {
        const cards = offerFor(`cap-${target}-${i}`, target);
        expect(tradeOfferValue(cards), `$${target} seed ${i}`).toBeLessThanOrEqual(target);
      }
    }
  });

  it('gets close to the shortfall rather than a tenth of it', () => {
    for (const target of TARGETS) {
      const samples = Array.from({ length: 30 }, (_, i) =>
        tradeOfferValue(offerFor(`fill-${target}-${i}`, target)) / target,
      );
      const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
      expect(mean, `$${target}`).toBeGreaterThan(0.8);
    }
  });

  it('keeps the pile small enough to choose between', () => {
    for (const target of TARGETS) {
      expect(offerFor(`size-${target}`, target).length).toBeLessThanOrEqual(TRADE_MAX_CARDS);
    }
  });

  it('offers nothing when there is no shortfall', () => {
    expect(offerFor('none', 0)).toEqual([]);
    expect(offerFor('negative', -50)).toEqual([]);
  });

  it('replays identically from a seed', () => {
    const a = offerFor('same', 200);
    const b = offerFor('same', 200);
    expect(a.map((c) => c.id)).toEqual(b.map((c) => c.id));
    expect(a.map(cardValue)).toEqual(b.map(cardValue));
  });
});

describe('whose binder it is', () => {
  it('hands over the franchise a collector collects', () => {
    const collector = buyer({
      wants: [{ kind: 'franchise', franchiseId: 'grimoire', interestPerCard: 4 }],
    });
    for (let i = 0; i < 12; i++) {
      const cards = generateTradeOffer(createRng(`fr-${i}`), collector, 200, 'trade');
      for (const card of cards) expect(card.franchise).toBe('grimoire');
    }
  });

  it('hands over cards from the set a set builder is chasing', () => {
    const builder = buyer({
      wants: [{ kind: 'fromSets', setIds: ['pb-origin'], interestPerCard: 6 }],
    });
    for (let i = 0; i < 12; i++) {
      const cards = generateTradeOffer(createRng(`set-${i}`), builder, 200, 'trade');
      for (const card of cards) expect(card.setId).toBe('pb-origin');
    }
  });

  it('hands over slabs when the buyer deals in graded cards', () => {
    const investor = buyer({ wants: [{ kind: 'minGrade', minGrade: 8, interestPerCard: 5 }] });
    for (let i = 0; i < 12; i++) {
      const cards = generateTradeOffer(createRng(`slab-${i}`), investor, 300, 'trade');
      for (const card of cards) {
        expect(card.slabbed).toBe(true);
        if (card.slabbed) expect(card.grade).toBeGreaterThanOrEqual(8);
      }
    }
  });

  it('hands over holos to a holo buyer', () => {
    const kid = buyer({ wants: [{ kind: 'holo', interestPerCard: 6 }] });
    for (let i = 0; i < 12; i++) {
      for (const card of generateTradeOffer(createRng(`holo-${i}`), kid, 300, 'trade')) {
        expect(['rareHolo', 'ultra']).toContain(card.rarity);
      }
    }
  });
});
