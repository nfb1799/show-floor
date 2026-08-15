/**
 * Tier 1 — Gear. Grounded, cheap, additive. The stuff an actual vendor owns.
 */

import { CONDITION_MULT, HOLO_MIN_RARITY } from '../constants';
import { cardValue, conditionRank, isHolo, rarityBase, rarityRank } from '../cards/value';
import type { UpgradeDef } from '../types';

const upgrade = (
  id: string,
  name: string,
  cost: number,
  text: string,
  hooks: UpgradeDef['hooks'],
): UpgradeDef => ({ id, name, kind: 'upgrade', tier: 1, cost, text, hooks });

export const TIER_1: readonly UpgradeDef[] = [
  upgrade(
    'uvDisplayCase',
    'UV Display Case',
    150,
    'Rare Holo and Ultra cards give +2 Interest each.',
    {
      onPitchScore: (ctx, fx) => {
        const count = ctx.cards.filter((c) => isHolo(c.rarity)).length;
        if (count > 0) fx.addInterest(count * 2, `UV Display Case x${count}`);
      },
    },
  ),

  upgrade(
    'toploaderStack',
    'Box of Toploaders',
    200,
    'Every raw card sells as if it were Near Mint, however beaten it actually is.',
    {
      onPitchScore: (ctx, fx) => {
        let gained = 0;
        for (const card of ctx.cards) {
          if (card.slabbed) continue;
          if (CONDITION_MULT[card.condition] >= 1) continue;
          gained += rarityBase(card.rarity) * (1 - CONDITION_MULT[card.condition]);
        }
        if (gained > 0) fx.addValue(gained, 'Toploader Stack');
      },
    },
  ),

  upgrade(
    'priceGuideBinder',
    'Price Guide Binder',
    120,
    "See everyone still in line, and what wins them, before you pitch.",
    {
      onShowStart: (_ctx, fx) => fx.revealNextBuyer('Price Guide Binder'),
    },
  ),

  upgrade('backupShowcase', 'Backup Showcase', 250, 'Display Case gains 2 slots.', {
    onShowStart: (_ctx, fx) => fx.addDisplayCaseSlots(2, 'Backup Showcase'),
  }),

  upgrade('cardLadder', 'Card Ladder Subscription', 175, 'Earn $15 extra per slab sold.', {
    onSale: (ctx, fx) => {
      const slabs = ctx.cards.filter((c) => c.slabbed).length;
      if (slabs > 0) fx.addMoney(slabs * 15, `Card Ladder x${slabs}`);
    },
  }),

  upgrade('foldingChair', 'Folding Chair', 100, 'One extra turn-away per show.', {
    onShowStart: (_ctx, fx) => fx.addTurnAways(1, 'Folding Chair'),
  }),

  upgrade(
    'pennySleeves',
    'Penny Sleeves',
    90,
    'Raw cards at Near Mint or better give +1 Interest each.',
    {
      onPitchScore: (ctx, fx) => {
        const count = ctx.cards.filter(
          (c) => !c.slabbed && conditionRank(c.condition) >= conditionRank('nearMint'),
        ).length;
        if (count > 0) fx.addInterest(count, `Penny Sleeves x${count}`);
      },
    },
  ),

  upgrade('binderPages', 'Binder Pages', 130, 'Pair and Set Run pitches gain +2 Interest.', {
    onPitchScore: (ctx, fx) => {
      if (ctx.pitchType === 'pair' || ctx.pitchType === 'setRun') {
        fx.addInterest(2, 'Binder Pages');
      }
    },
  }),

  upgrade('businessCards', 'Business Cards', 160, 'Every offer is 5% higher.', {
    onOfferFinalize: (_ctx, fx) => fx.multiplyOffer(1.05, 'Business Cards'),
  }),

  upgrade('sortingTray', 'Sorting Tray', 110, 'Pitches of 4 or 5 cards gain +1 Interest.', {
    onPitchScore: (ctx, fx) => {
      if (ctx.cards.length >= 4) fx.addInterest(1, 'Sorting Tray');
    },
  }),

  upgrade('brightLamp', 'Bright Lamp', 180, 'Holo cards are worth 25% more.', {
    onPitchScore: (ctx, fx) => {
      const bonus = ctx.cards
        .filter((c) => rarityRank(c.rarity) >= rarityRank(HOLO_MIN_RARITY))
        .reduce((sum, c) => sum + cardValue(c) * 0.25, 0);
      if (bonus > 0) fx.addValue(bonus, 'Bright Lamp');
    },
  }),

  upgrade('cashBox', 'Cash Box', 140, 'Earn $8 extra per card sold.', {
    onSale: (ctx, fx) => fx.addMoney(ctx.cards.length * 8, `Cash Box x${ctx.cards.length}`),
  }),
];
