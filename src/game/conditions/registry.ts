/**
 * Show Conditions — the "boss blind".
 *
 * Structurally identical to upgrades: same Modifier shape, same hooks. The only
 * differences are that they are imposed rather than bought, and they mostly
 * push numbers the wrong way.
 */

import {
  CONDITION_EVERY_N_SHOWS,
  CONDITION_ORDER,
  CONDITION_STACK_FROM_SHOW,
} from '../constants';
import { conditionRank } from '../cards/value';
import { createRng, type Rng } from '../rng';
import type { ConditionDef } from '../types';

const condition = (
  id: string,
  name: string,
  text: string,
  minShow: number,
  hooks: ConditionDef['hooks'],
): ConditionDef => ({ id, name, kind: 'condition', text, minShow, hooks });

export const ALL_CONDITIONS: readonly ConditionDef[] = [
  condition('snobCrowd', 'Snob Crowd', 'Any pitch containing a raw card takes x0.5 Interest.', 3, {
    onPitchScore: (ctx, fx) => {
      if (ctx.cards.some((c) => !c.slabbed)) fx.multiplyInterest(0.5, 'Snob Crowd');
    },
  }),

  condition('slowSaturday', 'Slow Saturday', 'One fewer buyer than usual.', 3, {
    onShowStart: (_ctx, fx) => fx.addBuyers(-1, 'Slow Saturday'),
  }),

  condition('conventionCenter', 'Convention Center', 'The table fee is tripled.', 3, {
    onShowStart: (_ctx, fx) => fx.multiplyTableFee(3, 'Convention Center'),
  }),

  condition('noBulkBins', 'No Bulk Bins', 'Pitches of 1 or 2 cards pay nothing.', 6, {
    onOfferFinalize: (ctx, fx) => {
      if (ctx.cards.length <= 2) fx.multiplyOffer(0, 'No Bulk Bins');
    },
  }),

  condition('undercutter', 'Undercutter', 'The booth next door drops your starting offer to 0.50.', 6, {
    onShowStart: (_ctx, fx) => fx.addOfferRatio(-0.2, 'Undercutter'),
  }),

  condition('impatientFloor', 'Impatient Floor', 'The crowd has only 2 goodwill all show.', 6, {
    onShowStart: (_ctx, fx) => fx.setGoodwill(2, 'Impatient Floor'),
  }),

  condition('cashOnly', 'Cash Only', 'All budgets are halved.', 9, {
    onBuyerArrive: (_ctx, fx) => fx.multiplyBudget(0.5, 'Cash Only'),
  }),

  condition(
    'dampHall',
    'Damp Hall',
    "Every unsold raw card loses a condition step at the show's end.",
    9,
    {
      onShowEnd: (ctx, fx) => {
        for (const card of ctx.unsoldCase) {
          if (card.slabbed) continue;
          if (card.toploaded) {
            // The toploader is spent protecting it.
            fx.replaceCard(
              card.id,
              { ...card, toploaded: false },
              `${card.subject} was in a toploader`,
            );
            continue;
          }
          const next = CONDITION_ORDER[Math.max(0, conditionRank(card.condition) - 1)];
          if (!next || next === card.condition) continue;
          fx.replaceCard(card.id, { ...card, condition: next }, `${card.subject} took on damp`);
        }
      },
    },
  ),

  condition('caseInspection', 'Case Inspection', 'The Display Case is cut to 5 slots.', 9, {
    onShowStart: (_ctx, fx) => fx.addDisplayCaseSlots(-3, 'Case Inspection'),
  }),

  condition(
    'grailHunters',
    'Grail Hunters',
    'Every buyer names a chase card. Pitches without it take x0.5.',
    12,
    {
      onBuyerArrive: (ctx, fx) => {
        if (ctx.buyer.chaseCard) return;
        const pool = [...ctx.inventory, ...ctx.displayCase];
        if (pool.length === 0) return;
        fx.setChaseCard(ctx.rng.pick(pool).subject, 'Grail Hunters name a card');
      },
      onPitchScore: (ctx, fx) => {
        const chase = ctx.buyer.chaseCard;
        if (!chase) return;
        if (!ctx.cards.some((c) => c.subject === chase)) {
          fx.multiplyInterest(0.5, 'No grail in the pitch');
        }
      },
    },
  ),
];

const BY_ID = new Map(ALL_CONDITIONS.map((c) => [c.id, c]));

export function getCondition(id: string): ConditionDef {
  const found = BY_ID.get(id);
  if (!found) throw new Error(`Unknown show condition: ${id}`);
  return found;
}

export function getConditions(ids: readonly string[]): ConditionDef[] {
  return ids.map(getCondition);
}

export function isConditionShow(showIndex: number): boolean {
  return showIndex % CONDITION_EVERY_N_SHOWS === 0;
}

/** Later shows stack two conditions. */
export function conditionCountForShow(showIndex: number): number {
  if (!isConditionShow(showIndex)) return 0;
  return showIndex >= CONDITION_STACK_FROM_SHOW ? 2 : 1;
}

/**
 * A show's conditions, derived from the run seed and show number alone.
 *
 * Deliberately not forked off the live run RNG: `fork()` mixes the stream's
 * *current* state, so the shop (which predicts the next fee) and setup (which
 * rolls it for real) would disagree the moment the player opened a pack or
 * rerolled in between. A tripled Convention Center fee could then arrive after
 * the shop had already let them spend down past it.
 */
export function conditionsForShow(seed: string, showIndex: number): ConditionDef[] {
  return rollConditions(createRng(`${seed}:conditions:${showIndex}`), showIndex);
}

export function rollConditions(rng: Rng, showIndex: number): ConditionDef[] {
  const count = conditionCountForShow(showIndex);
  if (count === 0) return [];
  const pool = ALL_CONDITIONS.filter((c) => c.minShow <= showIndex);
  return rng.shuffle(pool).slice(0, count);
}
