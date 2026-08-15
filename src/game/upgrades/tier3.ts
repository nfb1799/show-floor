/**
 * Tier 3 — People. Expensive, swingy, and several of them can hurt you.
 *
 * Two of these need a decision made when a buyer arrives to still be true when
 * the pitch is scored. They use `fx.mark` rather than holding state, which is
 * what keeps every upgrade a plain data object.
 */

import { WANT_INTEREST } from '../constants';
import { generateCard } from '../cards/generate';
import { getFranchise } from '../cards/catalog';
import { budgetForShow } from '../buyers/generate';
import { gradeCard } from '../shop/grading';
import { PITCH_TYPES } from '../constants';
import type { Buyer, Card, PitchTypeId, UpgradeDef } from '../types';

const upgrade = (
  id: string,
  name: string,
  cost: number,
  text: string,
  hooks: UpgradeDef['hooks'],
): UpgradeDef => ({ id, name, kind: 'upgrade', tier: 3, cost, text, hooks });

/** Franchise the player holds most of, for The Regular. */
function mostHeldFranchise(cards: readonly Card[]): string | null {
  const counts = new Map<string, number>();
  for (const card of cards) counts.set(card.franchise, (counts.get(card.franchise) ?? 0) + 1);

  let best: string | null = null;
  let bestCount = 0;
  for (const [subject, count] of counts) {
    if (count > bestCount) {
      best = subject;
      bestCount = count;
    }
  }
  return best;
}

export const TIER_3: readonly UpgradeDef[] = [
  upgrade(
    'uncleGary',
    'Uncle Gary',
    600,
    'A quarter of buyers leave on sight. The ones who stay pay double.',
    {
      onBuyerArrive: (ctx, fx) => {
        if (ctx.rng.next() < 0.25) fx.scareOff('Uncle Gary talks a buyer out of it');
        else fx.mark('gary:blessed', 'Uncle Gary works the table');
      },
      onOfferFinalize: (ctx, fx) => {
        if (ctx.buyer.marks?.includes('gary:blessed')) fx.multiplyOffer(2, 'Uncle Gary');
      },
    },
  ),

  upgrade(
    'theRegular',
    'The Regular',
    550,
    'Every fourth buyer is a Personal Collector for whichever franchise you hold most of.',
    {
      onBuyerArrive: (ctx, fx) => {
        if ((ctx.buyerIndex + 1) % 4 !== 0) return;
        const franchiseId = mostHeldFranchise([...ctx.inventory, ...ctx.displayCase]);
        if (!franchiseId) return;
        const franchise = getFranchise(franchiseId);

        const regular: Buyer = {
          id: `${ctx.buyer.id}-regular`,
          archetype: 'personalCollector',
          label: 'The Regular',
          budget: Math.round(budgetForShow('personalCollector', ctx.showIndex) * 1.2),
          wants: [
            {
              kind: 'franchise',
              franchiseId,
              interestPerCard: WANT_INTEREST.personalCollector,
            },
          ],
        };
        fx.replaceWith(regular, `The Regular turns up asking about ${franchise.name}`);
      },
    },
  ),

  upgrade(
    'gradingGuy',
    'Guy Who Only Asks About Grading',
    500,
    'Each raw card you sell has a 20% chance to come back as a slab.',
    {
      onSale: (ctx, fx) => {
        for (const card of ctx.cards) {
          if (card.slabbed) continue;
          if (ctx.rng.next() >= 0.2) continue;
          fx.returnCardToInventory(
            gradeCard(card, ctx.rng),
            `${card.subject} comes back in a case`,
          );
        }
      },
    },
  ),

  upgrade(
    'rivalVendor',
    'Rival Vendor',
    480,
    'You see their pitch first. Match the type for +5 Interest, differ for -2.',
    {
      onBuyerArrive: (ctx, fx) => {
        const type = ctx.rng.pick(PITCH_TYPES).id;
        fx.mark(`rival:${type}`, 'The rival vendor makes their pitch');
      },
      onPitchScore: (ctx, fx) => {
        const mark = ctx.buyer.marks?.find((m) => m.startsWith('rival:'));
        if (!mark) return;
        const rivalType = mark.slice('rival:'.length) as PitchTypeId;
        if (rivalType === ctx.pitchType) fx.addInterest(5, 'Matched the rival');
        else fx.addInterest(-2, 'Undercut by the rival');
      },
    },
  ),

  upgrade('mallKid', 'Mall Kid With A Binder', 420, 'After each sale, swap one case card free.', {
    onSale: (_ctx, fx) => fx.swapCaseCards(1, 'Mall Kid swaps you a card'),
  }),

  upgrade(
    'promotersNephew',
    "Show Promoter's Nephew",
    450,
    'Table fee halved. Quota raised 15%.',
    {
      onShowStart: (_ctx, fx) => {
        fx.multiplyTableFee(0.5, "Promoter's Nephew halves the fee");
        fx.multiplyQuota(1.15, "Promoter's Nephew raises the quota");
      },
    },
  ),

  upgrade('theWhale', 'The Whale', 700, 'One buyer each show arrives with triple the budget.', {
    onBuyerArrive: (ctx, fx) => {
      // Deterministic rather than rolled: the arrival RNG advances between
      // buyers, so a roll here could pick a different whale each time.
      if (ctx.buyerIndex === ctx.showIndex % 4) fx.multiplyBudget(3, 'The Whale');
    },
  }),

  upgrade(
    'shopOwner',
    'Card Shop Owner',
    560,
    'Pitches containing 3 or more slabs pay 50% more.',
    {
      onOfferFinalize: (ctx, fx) => {
        if (ctx.cards.filter((c) => c.slabbed).length >= 3) {
          fx.multiplyOffer(1.5, 'Card Shop Owner');
        }
      },
    },
  ),

  upgrade('oldTeacher', 'Your Old Teacher', 520, 'Nostalgia Buyers pay 80% more.', {
    onOfferFinalize: (ctx, fx) => {
      if (ctx.buyer.archetype === 'nostalgia') fx.multiplyOffer(1.8, 'Your Old Teacher');
    },
  }),

  upgrade('completionist', 'The Completionist', 580, 'Set Run pitches pay double.', {
    onOfferFinalize: (ctx, fx) => {
      if (ctx.pitchType === 'setRun') fx.multiplyOffer(2, 'The Completionist');
    },
  }),

  upgrade('guyWithAVan', 'Guy With A Van', 640, 'Two more case slots and one more buyer.', {
    onShowStart: (_ctx, fx) => {
      fx.addDisplayCaseSlots(2, 'Guy With A Van');
      fx.addBuyers(1, 'Guy With A Van');
    },
  }),

  upgrade('theGrinder', 'The Grinder', 380, 'The crowd starts each show with +3 goodwill.', {
    onShowStart: (_ctx, fx) => fx.addGoodwill(3, 'The Grinder'),
  }),

  upgrade('auctionScout', 'Auction Scout', 600, 'Offers are 35% higher. Budgets are 15% lower.', {
    onBuyerArrive: (_ctx, fx) => fx.multiplyBudget(0.85, 'Auction Scout'),
    onOfferFinalize: (_ctx, fx) => fx.multiplyOffer(1.35, 'Auction Scout'),
  }),

  upgrade(
    'estateSale',
    'Estate Sale Contact',
    520,
    'Three random cards arrive in your inventory before each show.',
    {
      onShowStart: (ctx, fx) => {
        const cards = Array.from({ length: 3 }, (_, i) =>
          generateCard(ctx.rng, `estate-s${ctx.showIndex}-${i}`),
        );
        fx.addInventoryCards(cards, 'Estate Sale Contact drops off a box');
      },
    },
  ),
];
