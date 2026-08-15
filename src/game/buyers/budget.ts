import { BUYER_BASE_BUDGET, BUYER_BUDGET_GROWTH } from '../constants';
import type { BuyerArchetypeId } from '../types';

/** Show-1 budget grown by the run's escalation curve. */
export function budgetForShow(archetype: BuyerArchetypeId, showIndex: number): number {
  return BUYER_BASE_BUDGET[archetype] * Math.pow(BUYER_BUDGET_GROWTH, showIndex - 1);
}
