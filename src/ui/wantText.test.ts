/**
 * Buyer demands are the one place the UI has to agree with the card face. A
 * want reading "Cards from Storm Cycle" said nothing about whether Storm Cycle
 * was a set or a franchise, so digging for it meant checking both lines on
 * every card in the box. The mark on the want is the same glyph the card prints
 * against the matching line, and these keep the two from drifting apart.
 */

import { describe, expect, it } from 'vitest';
import { describeWant, wantMark } from './wantText';
import { FRANCHISE_MARK, SET_MARK } from './card/artSpec';
import type { Want } from '../game/types';

describe('want marks', () => {
  it('marks a named set with the set glyph', () => {
    const want: Want = { kind: 'fromSets', setIds: ['pb-origin'], interestPerCard: 6 };
    expect(wantMark(want)?.mark).toBe(SET_MARK);
    expect(wantMark(want)?.label).toBe('Set');
  });

  it('marks a franchise with the franchise glyph', () => {
    const want: Want = { kind: 'franchise', franchiseId: 'grimoire', interestPerCard: 4 };
    expect(wantMark(want)?.mark).toBe(FRANCHISE_MARK);
    expect(wantMark(want)?.label).toBe('Franchise');
  });

  it('leaves the vintage want unmarked, since it spans many sets', () => {
    // There is no one set to point at, so a set glyph here would send the
    // player looking for a specific name that does not exist.
    const want: Want = {
      kind: 'fromSets',
      setIds: ['pb-origin', 'dl-76', 'cr-s1'],
      interestPerCard: 5,
    };
    expect(wantMark(want)).toBeNull();
  });

  it('marks nothing on wants that are about neither', () => {
    const wants: Want[] = [
      { kind: 'holo', interestPerCard: 4 },
      { kind: 'minGrade', minGrade: 8, interestPerCard: 5 },
      { kind: 'volume', minCards: 4, interestPerCard: 2 },
      { kind: 'distinctFranchises', interestPerCard: 4 },
      { kind: 'rawMinCondition', minCondition: 'nearMint', interestPerCard: 5 },
    ];
    for (const want of wants) {
      expect(wantMark(want), want.kind).toBeNull();
    }
  });

  it('keeps the two glyphs distinguishable', () => {
    expect(FRANCHISE_MARK).not.toBe(SET_MARK);
  });

  it('still describes every want in words', () => {
    const want: Want = { kind: 'franchise', franchiseId: 'grimoire', interestPerCard: 4 };
    // The mark is an aid, not a replacement: the name still has to be readable
    // on its own for anyone who does not spot the glyph.
    expect(describeWant(want)).toContain('cards');
  });
});
