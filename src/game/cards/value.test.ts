import { describe, expect, it } from 'vitest';
import { cardValue, gradeMultiplier, isHolo, totalCardValue } from './value';
import { raw, slab } from '../testing/factories';

describe('raw card value', () => {
  it('multiplies rarity base by condition', () => {
    expect(cardValue(raw({ rarity: 'common', condition: 'played' }))).toBeCloseTo(0.8);
    expect(cardValue(raw({ rarity: 'rare', condition: 'nearMint' }))).toBeCloseTo(12);
    expect(cardValue(raw({ rarity: 'ultra', condition: 'mint' }))).toBeCloseTo(117);
  });
});

describe('slab value', () => {
  it('multiplies rarity base by grade', () => {
    expect(cardValue(slab({ rarity: 'rare', grade: 8 }))).toBeCloseTo(24);
    expect(cardValue(slab({ rarity: 'ultra', grade: 10 }))).toBeCloseTo(540);
  });

  it('flattens every grade at or below 6 to the same multiplier', () => {
    expect(gradeMultiplier(1)).toBe(0.8);
    expect(gradeMultiplier(6)).toBe(0.8);
    expect(gradeMultiplier(7)).toBe(1.4);
    expect(gradeMultiplier(10)).toBe(6);
  });

  it('makes grading a played card a value gain even at the floor', () => {
    // played is x0.4 raw; the slab floor is x0.8. Worth knowing while tuning.
    const before = cardValue(raw({ rarity: 'rare', condition: 'played' }));
    const after = cardValue(slab({ rarity: 'rare', grade: 3 }));
    expect(after).toBeGreaterThan(before);
  });
});

describe('holo', () => {
  it('treats rareHolo and above as holo', () => {
    expect(isHolo('rare')).toBe(false);
    expect(isHolo('rareHolo')).toBe(true);
    expect(isHolo('ultra')).toBe(true);
  });
});

describe('totalCardValue', () => {
  it('sums a pitch', () => {
    expect(
      totalCardValue([raw({ rarity: 'rare' }), slab({ rarity: 'rare', grade: 8 })]),
    ).toBeCloseTo(36);
  });
});
