import { describe, expect, it } from 'vitest';
import {
  markSingleSold,
  nextCaseCost,
  nextTableCost,
  openPack,
  openShop,
  priceForCard,
  rerollCost,
  rerollSingles,
  upgradeSlotsFor,
} from './shop';
import { asSlab, gradeCard, gradingFee, gradingOutcomeRange, rollGrade } from './grading';
import { cardValue } from '../cards/value';
import { createRng } from '../rng';
import { GRADE_ROLL, PACK_TIERS, SHOP_SINGLES_COUNT, TABLE_TIERS } from '../constants';
import { raw } from '../testing/factories';
import type { Condition } from '../types';

describe('singles', () => {
  it('prices above computed value, which is the shop margin', () => {
    const card = raw({ rarity: 'rare', condition: 'nearMint' });
    expect(priceForCard(card)).toBeGreaterThan(cardValue(card));
  });

  it('stocks a full shelf and marks sold items', () => {
    const stock = openShop(createRng('shop'), 1, []);
    expect(stock.singles).toHaveLength(SHOP_SINGLES_COUNT);
    expect(stock.singles.every((s) => !s.sold)).toBe(true);

    const first = stock.singles[0]!;
    const after = markSingleSold(stock, first.card.id);
    expect(after.singles[0]!.sold).toBe(true);
  });

  it('charges more for each reroll', () => {
    const rng = createRng('shop');
    const stock = openShop(rng, 1, []);
    const once = rerollSingles(stock, rng);

    expect(rerollCost(once)).toBeGreaterThan(rerollCost(stock));
    expect(once.singles.map((s) => s.card.id)).not.toEqual(stock.singles.map((s) => s.card.id));
  });

  it('keeps upgrade offers fixed across a reroll', () => {
    const rng = createRng('shop');
    const stock = openShop(rng, 8, []);
    expect(rerollSingles(stock, rng).upgrades).toEqual(stock.upgrades);
  });
});

describe('packs', () => {
  it('deals the advertised number of cards', () => {
    for (const tier of PACK_TIERS) {
      expect(openPack(tier, createRng(tier.id), 'p')).toHaveLength(tier.cardCount);
    }
  });

  it('pulls better cards from better packs', () => {
    const average = (tierId: string): number => {
      const tier = PACK_TIERS.find((t) => t.id === tierId)!;
      let total = 0;
      const runs = 60;
      for (let i = 0; i < runs; i++) {
        const cards = openPack(tier, createRng(`${tierId}-${i}`), `p${i}`);
        total += cards.reduce((sum, card) => sum + cardValue(card), 0) / cards.length;
      }
      return total / runs;
    };

    expect(average('retail')).toBeGreaterThan(average('bulkLot'));
    expect(average('hobby')).toBeGreaterThan(average('retail'));
  });
});

describe('grading', () => {
  it('rolls only grades the condition allows', () => {
    for (const condition of Object.keys(GRADE_ROLL) as Condition[]) {
      const allowed = GRADE_ROLL[condition].map(([grade]) => grade);
      for (let i = 0; i < 40; i++) {
        expect(allowed).toContain(rollGrade(condition, createRng(`${condition}-${i}`)));
      }
    }
  });

  it('returns a slab that keeps the card identity', () => {
    const card = raw({ rarity: 'rare', condition: 'nearMint', subject: 'Tidefin' });
    const slabbed = gradeCard(card, createRng('grade'));

    expect(slabbed.slabbed).toBe(true);
    expect(slabbed.id).toBe(card.id);
    expect(slabbed.subject).toBe('Tidefin');
    expect(slabbed.rarity).toBe('rare');
  });

  it('charges a fee that scales with the card', () => {
    const cheap = raw({ rarity: 'common', condition: 'played' });
    const dear = raw({ rarity: 'ultra', condition: 'mint' });
    expect(gradingFee(dear)).toBeGreaterThan(gradingFee(cheap));
  });

  it('shows an honest outcome range', () => {
    const card = raw({ rarity: 'rare', condition: 'nearMint' });
    const { low, high } = gradingOutcomeRange(card);

    expect(low).toBeCloseTo(cardValue(asSlab(card, 7)));
    expect(high).toBeCloseTo(cardValue(asSlab(card, 10)));
    expect(high).toBeGreaterThan(low);
  });

  it('has a wide spread of outcomes on a near mint card', () => {
    const card = raw({ rarity: 'ultra', condition: 'nearMint' });
    const { low, high } = gradingOutcomeRange(card);
    expect(high / low).toBeGreaterThan(4); // grade 7 pays x1.4, grade 10 pays x6
  });

  it('has no variance at all on a played card', () => {
    // played rolls 1-6, and GRADE_MULT_FLOOR_AT flattens every one of those to
    // the same multiplier. So grading a played card is a guaranteed doubling
    // (x0.4 raw -> x0.8 slab), with no risk at all. The fee keeps it honest.
    const card = raw({ rarity: 'ultra', condition: 'played' });
    const { low, high } = gradingOutcomeRange(card);

    expect(low).toBe(high);
    expect(low).toBeCloseTo(cardValue(card) * 2);
  });

  it('prices the played-card doubling so it is barely worth doing', () => {
    const card = raw({ rarity: 'ultra', condition: 'played' });
    const gain = gradingOutcomeRange(card).low - cardValue(card);
    expect(gain).toBeGreaterThan(gradingFee(card)); // profitable at the top end
    expect(gain - gradingFee(card)).toBeLessThan(cardValue(card)); // but not by much
  });
});

describe('permanent capacity', () => {
  it('walks the table tiers from the design doc', () => {
    expect(upgradeSlotsFor(0)).toBe(3);
    expect(upgradeSlotsFor(1)).toBe(5);
    expect(upgradeSlotsFor(2)).toBe(7);
    expect(nextTableCost(0)).toBe(TABLE_TIERS[1]!.cost);
    expect(nextTableCost(2)).toBeNull();
  });

  it('charges more for each case slot and eventually stops selling them', () => {
    expect(nextCaseCost(1)!).toBeGreaterThan(nextCaseCost(0)!);
    expect(nextCaseCost(99)).toBeNull();
  });
});
