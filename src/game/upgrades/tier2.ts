/**
 * Tier 2 — Booth. Odd, and most of them cost you something.
 */

import type { UpgradeDef } from '../types';

const upgrade = (
  id: string,
  name: string,
  cost: number,
  text: string,
  hooks: UpgradeDef['hooks'],
): UpgradeDef => ({ id, name, kind: 'upgrade', tier: 2, cost, text, hooks });

export const TIER_2: readonly UpgradeDef[] = [
  upgrade('freeCandyBowl', 'Free Candy Bowl', 350, 'One extra buyer, but all budgets drop 10%.', {
    onShowStart: (_ctx, fx) => fx.addBuyers(1, 'Free Candy Bowl'),
    onBuyerArrive: (_ctx, fx) => fx.multiplyBudget(0.9, 'Free Candy Bowl'),
  }),

  upgrade(
    'nostalgiaPlaylist',
    'Nostalgia Playlist',
    300,
    'Nostalgia Buyers and Personal Collectors give +4 Interest.',
    {
      onPitchScore: (ctx, fx) => {
        if (ctx.buyer.archetype === 'nostalgia' || ctx.buyer.archetype === 'personalCollector') {
          fx.addInterest(4, 'Nostalgia Playlist');
        }
      },
    },
  ),

  upgrade(
    'loudNeighbor',
    'Loud Neighbor',
    450,
    'The crowd has 3 less goodwill all show. All offers are 50% higher.',
    {
      onShowStart: (_ctx, fx) => fx.addGoodwill(-3, 'Loud Neighbor'),
      onOfferFinalize: (_ctx, fx) => fx.multiplyOffer(1.5, 'Loud Neighbor'),
    },
  ),

  upgrade(
    'fakeGrailDisplay',
    'Fake Grail Display',
    280,
    'One case slot is held by an unsellable card. Every pitch gains +1 Interest.',
    {
      onShowStart: (_ctx, fx) => fx.lockCaseSlots(1, 'Fake Grail Display'),
      onPitchScore: (_ctx, fx) => fx.addInterest(1, 'Fake Grail Display'),
    },
  ),

  upgrade(
    'handwrittenSignage',
    'Handwritten Signage',
    260,
    'Kid and Bulk Guy budgets are doubled.',
    {
      onBuyerArrive: (ctx, fx) => {
        if (ctx.buyer.archetype === 'kid' || ctx.buyer.archetype === 'bulkGuy') {
          fx.multiplyBudget(2, 'Handwritten Signage');
        }
      },
    },
  ),

  upgrade(
    'halfPriceBin',
    'Half-Price Bin',
    240,
    'Pitches of 5 cards gain +3 Interest. Pitches of 1 lose 2.',
    {
      onPitchScore: (ctx, fx) => {
        if (ctx.cards.length === 5) fx.addInterest(3, 'Half-Price Bin');
        if (ctx.cards.length === 1) fx.addInterest(-2, 'Half-Price Bin');
      },
    },
  ),

  upgrade('glassCounter', 'Glass Counter', 320, 'Slabs give +3 Interest each.', {
    onPitchScore: (ctx, fx) => {
      const slabs = ctx.cards.filter((c) => c.slabbed).length;
      if (slabs > 0) fx.addInterest(slabs * 3, `Glass Counter x${slabs}`);
    },
  }),

  upgrade(
    'gradingSign',
    '"Ask Me About Grading" Sign',
    300,
    'Grader and Investor budgets are 60% higher.',
    {
      onBuyerArrive: (ctx, fx) => {
        if (ctx.buyer.archetype === 'grader' || ctx.buyer.archetype === 'investor') {
          fx.multiplyBudget(1.6, 'Grading Sign');
        }
      },
    },
  ),

  upgrade(
    'tableExtension',
    'Folding Table Extension',
    380,
    'Display Case gains 3 slots, but you lose a turn-away.',
    {
      onShowStart: (_ctx, fx) => {
        fx.addDisplayCaseSlots(3, 'Table Extension');
        fx.addTurnAways(-1, 'Table Extension');
      },
    },
  ),

  upgrade('crowdBarrier', 'Crowd Barrier', 220, 'The crowd starts each show with +2 goodwill.', {
    onShowStart: (_ctx, fx) => fx.addGoodwill(2, 'Crowd Barrier'),
  }),

  upgrade('neonOpenSign', 'Neon Open Sign', 400, 'Every offer is 20% higher.', {
    onOfferFinalize: (_ctx, fx) => fx.multiplyOffer(1.2, 'Neon Open Sign'),
  }),

  upgrade(
    'bulkBin',
    'Bulk Bin',
    290,
    'Pitches of 4 or more gain +2 Interest for each card past the third.',
    {
      onPitchScore: (ctx, fx) => {
        if (ctx.cards.length < 4) return;
        const extra = ctx.cards.length - 3;
        fx.addInterest(extra * 2, `Bulk Bin x${extra}`);
      },
    },
  ),

  upgrade(
    'consignmentDeal',
    'Consignment Deal',
    420,
    'When a budget caps you, recover 25% of what the cap ate — up to the budget again.',
    {
      onOfferFinalize: (ctx, fx) => {
        if (!ctx.cappedByBudget) return;
        // Late on, appeal routinely dwarfs budgets, so an uncapped 25% of the
        // gap would quietly solve the whole endgame. Bounded at one more
        // budget's worth, this is a strong cap-breaker rather than the answer.
        const recovered = Math.min((ctx.uncappedOffer - ctx.cappedOffer) * 0.25, ctx.buyer.budget);
        fx.addOffer(recovered, 'Consignment Deal');
      },
    },
  ),

  upgrade('tableRunner', 'Table Runner', 340, 'Full Case and Holo Wall pitches gain +5 Interest.', {
    onPitchScore: (ctx, fx) => {
      if (ctx.pitchType === 'fullCase' || ctx.pitchType === 'holoWall') {
        fx.addInterest(5, 'Table Runner');
      }
    },
  }),
];
