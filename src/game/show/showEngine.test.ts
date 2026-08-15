import { describe, expect, it } from 'vitest';
import { createRng } from '../rng';
import { generateCards } from '../cards/generate';
import {
  accept,
  createShow,
  previewPitch,
  previewPush,
  pitch,
  push,
  quotaForShow,
  remainingInventory,
  tableFeeForShow,
  toggleSelection,
  turnAway,
  type ShowDeps,
  type ShowState,
} from './showEngine';
import { DISPLAY_CASE_SIZE, BUYERS_PER_SHOW, TURN_AWAYS_PER_SHOW } from '../constants';

function deps(seed = 'show-test'): ShowDeps {
  return { rng: createRng(seed), upgrades: [], conditions: [] };
}

function newShow(seed = 'show-test', inventorySize = 40) {
  const d = deps(seed);
  const inventory = generateCards(createRng(`${seed}-inv`), inventorySize, 'inv');
  return { state: createShow(1, inventory, d), deps: d };
}

/** Selects up to `n` cards from the case. */
function selectFirst(state: ShowState, n: number): ShowState {
  let next = state;
  for (const card of state.displayCase.slice(0, n)) {
    next = toggleSelection(next, card.id);
  }
  return next;
}

describe('escalation', () => {
  it('grows the quota and the table fee from show 1', () => {
    expect(quotaForShow(1)).toBe(180);
    expect(quotaForShow(2)).toBe(248);
    expect(tableFeeForShow(1)).toBe(50);
    expect(tableFeeForShow(2)).toBe(70);
  });

  it('softens quota growth after the crossover show', () => {
    const before = quotaForShow(13) / quotaForShow(12);
    expect(before).toBeCloseTo(1.3, 2);
  });
});

describe('show setup', () => {
  it('fills the display case and seats the first buyer', () => {
    const { state } = newShow();

    expect(state.displayCase).toHaveLength(DISPLAY_CASE_SIZE);
    expect(state.buyer).not.toBeNull();
    expect(state.config.buyerCount).toBe(BUYERS_PER_SHOW);
    expect(state.turnAwaysLeft).toBe(TURN_AWAYS_PER_SHOW);
    expect(state.phase).toBe('pitching');
  });

  it('runs the case short rather than failing when inventory is thin', () => {
    const { state } = newShow('thin', 3);
    expect(state.displayCase).toHaveLength(3);
    expect(state.inventory).toHaveLength(0);
  });
});

describe('selection', () => {
  it('caps a pitch at five cards', () => {
    const { state } = newShow();
    expect(selectFirst(state, 7).selection).toHaveLength(5);
  });

  it('toggles a card back off', () => {
    const { state } = newShow();
    const first = state.displayCase[0]!;
    const on = toggleSelection(state, first.id);
    expect(toggleSelection(on, first.id).selection).toEqual([]);
  });
});

describe('resolving a buyer', () => {
  it('pays out, refills the case and seats the next buyer in one step', () => {
    const { state, deps: d } = newShow();
    const selected = selectFirst(state, 3);
    const offered = pitch(selected, d);

    expect(offered.phase).toBe('haggling');
    expect(offered.pending).not.toBeNull();

    const after = accept(offered, d);

    expect(after.phase).toBe('pitching');
    expect(after.earned).toBe(offered.pending!.offer);
    expect(after.queueIndex).toBe(1);
    expect(after.selection).toEqual([]);
    expect(after.displayCase).toHaveLength(DISPLAY_CASE_SIZE);
    expect(after.buyer!.id).not.toBe(state.buyer!.id);
  });

  it('records the sale so the table can animate the change', () => {
    const { state, deps: d } = newShow();
    const selected = selectFirst(state, 3);
    const after = accept(pitch(selected, d), d);

    expect(after.lastSale).not.toBeNull();
    expect(after.lastSale!.cards).toHaveLength(3);
    expect(after.lastSale!.amount).toBe(after.earned);
    expect(after.lastSale!.buyerLabel).toBe(state.buyer!.label);
  });

  it('removes sold cards from the run permanently', () => {
    const { state, deps: d } = newShow();
    const selected = selectFirst(state, 3);
    const soldIds = selected.selection;
    const after = accept(pitch(selected, d), d);

    const surviving = remainingInventory(after).map((c) => c.id);
    for (const id of soldIds) expect(surviving).not.toContain(id);
    expect(after.sold.map((c) => c.id).sort()).toEqual([...soldIds].sort());
  });
});

describe('haggling', () => {
  it('spends goodwill to raise the offer ratio', () => {
    const { state, deps: d } = newShow();
    // Find a show where the first buyer has goodwill to spend.
    const withGoodwill = state.buyer!.goodwill > 0 ? state : newShow('patient').state;
    const d2 = withGoodwill === state ? d : deps('patient');

    const offered = pitch(selectFirst(withGoodwill, 3), d2);
    const pushed = push(offered, d2);

    expect(pushed.offerRatio).toBeCloseTo(offered.offerRatio + 0.15);
    expect(pushed.buyer!.goodwill).toBe(offered.buyer!.goodwill - 1);
    expect(pushed.phase).toBe('haggling');
  });

  it('shrinks the wallet on every push, so pushing is a real decision', () => {
    // Without this the optimal line is always "push to zero goodwill, then
    // accept" — goodwill would only gate how many free raises you get.
    const { state, deps: d } = newShow();
    const offered = pitch(selectFirst(state, 3), d);
    const pushed = push(offered, d);

    expect(pushed.buyer!.budget).toBeLessThan(offered.buyer!.budget);
    expect(pushed.buyer!.goodwill).toBe(offered.buyer!.goodwill - 1);
  });

  it('pays a capped buyer strictly less for being pushed', () => {
    const { state, deps: d } = newShow();
    // A tiny budget guarantees the cap binds before and after the push.
    const capped: ShowState = { ...state, buyer: { ...state.buyer!, budget: 8, goodwill: 3 } };
    const offered = pitch(selectFirst(capped, 3), d);
    const pushed = push(offered, d);

    expect(offered.pending!.cappedByBudget).toBe(true);
    expect(pushed.pending!.offer).toBeLessThan(offered.pending!.offer);
  });

  it('previews what a push would pay before the player commits', () => {
    const { state, deps: d } = newShow();
    const offered = pitch(selectFirst(state, 3), d);

    const projected = previewPush(offered, d);
    expect(projected).not.toBeNull();
    expect(push(offered, d).pending!.offer).toBe(projected);
  });

  it('offers no push preview once goodwill is gone', () => {
    const { state, deps: d } = newShow();
    const seeded: ShowState = { ...state, buyer: { ...state.buyer!, goodwill: 0 } };
    expect(previewPush(pitch(selectFirst(seeded, 2), d), d)).toBeNull();
  });

  it('loses the buyer when pushed at zero goodwill', () => {
    const { state, deps: d } = newShow();
    const seeded: ShowState = { ...state, buyer: { ...state.buyer!, goodwill: 0 } };
    const offered = pitch(selectFirst(seeded, 2), d);
    const walked = push(offered, d);

    expect(walked.earned).toBe(0);
    expect(walked.queueIndex).toBe(1);
    expect(walked.log.some((l) => l.tone === 'walk')).toBe(true);
  });

  it('does not sell the cards when a buyer walks', () => {
    const { state, deps: d } = newShow();
    const seeded: ShowState = { ...state, buyer: { ...state.buyer!, goodwill: 0 } };
    const selected = selectFirst(seeded, 2);
    const pitchedIds = selected.selection;
    const walked = push(pitch(selected, d), d);

    const surviving = remainingInventory(walked).map((c) => c.id);
    for (const id of pitchedIds) expect(surviving).toContain(id);
    expect(walked.sold).toHaveLength(0);
  });
});

describe('turning a buyer away', () => {
  it('does not consume a buyer slot', () => {
    const { state, deps: d } = newShow();
    const after = turnAway(state, d);

    expect(after.queueIndex).toBe(0);
    expect(after.turnAwaysLeft).toBe(TURN_AWAYS_PER_SHOW - 1);
    expect(after.buyer).not.toBeNull();
  });

  it('swaps the selected cards back into the inventory and redraws', () => {
    const { state, deps: d } = newShow();
    const selected = selectFirst(state, 3);
    const swappedIds = selected.selection;
    const after = turnAway(selected, d);

    expect(after.displayCase).toHaveLength(DISPLAY_CASE_SIZE);
    for (const id of swappedIds) {
      expect(after.inventory.map((c) => c.id)).toContain(id);
    }
    expect(after.selection).toEqual([]);
  });

  it('is refused once the allowance is gone', () => {
    const { state, deps: d } = newShow();
    let next = state;
    for (let i = 0; i < TURN_AWAYS_PER_SHOW; i++) next = turnAway(next, d);

    expect(next.turnAwaysLeft).toBe(0);
    expect(turnAway(next, d)).toBe(next);
  });
});

describe('show completion', () => {
  it('ends after the buyer count and judges against the quota', () => {
    const { state, deps: d } = newShow();
    let next = state;

    while (next.phase !== 'over') {
      next = accept(pitch(selectFirst(next, 5), d), d);
    }

    expect(next.queueIndex).toBe(BUYERS_PER_SHOW);
    expect(next.buyer).toBeNull();
    expect(next.outcome).toBe(next.earned >= next.config.quota ? 'cleared' : 'failed');
  });

  it('ends the show when the case and inventory both run dry', () => {
    // Two cards, sold in one pitch: no case, no inventory, no legal action left.
    const d = deps('soldout');
    const inventory = generateCards(createRng('soldout-inv'), 2, 'inv');
    const state = createShow(1, inventory, d);
    expect(state.displayCase).toHaveLength(2);

    const after = accept(pitch(selectFirst(state, 2), d), d);

    expect(after.phase).toBe('over');
    expect(after.queueIndex).toBeLessThan(after.config.buyerCount);
    expect(after.log.some((l) => l.text.includes('sold out'))).toBe(true);
  });

  it('refuses further actions once the show is over', () => {
    const { state, deps: d } = newShow();
    let next = state;
    while (next.phase !== 'over') {
      next = accept(pitch(selectFirst(next, 5), d), d);
    }

    expect(pitch(next, d)).toBe(next);
    expect(turnAway(next, d)).toBe(next);
    expect(previewPitch(next, d)).toBeNull();
  });
});

describe('determinism', () => {
  it('replays a show identically from the same seed', () => {
    const play = () => {
      const { state, deps: d } = newShow('replay');
      let next = state;
      while (next.phase !== 'over') {
        next = accept(pitch(selectFirst(next, 4), d), d);
      }
      return next;
    };

    expect(play().earned).toBe(play().earned);
    expect(play().log.map((l) => l.text)).toEqual(play().log.map((l) => l.text));
  });
});
