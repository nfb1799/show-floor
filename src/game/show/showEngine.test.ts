import { describe, expect, it } from 'vitest';
import { createRng } from '../rng';
import { generateCards } from '../cards/generate';
import {
  createShow,
  digFromStock,
  previewPitch,
  pitch,
  quotaForShow,
  remainingInventory,
  tableFeeForShow,
  toggleSelection,
  turnAway,
  type ShowDeps,
  type ShowState,
} from './showEngine';
import {
  DISPLAY_CASE_SIZE,
  BUYERS_PER_SHOW,
  MAX_PITCH_CARDS,
  TURN_AWAYS_PER_SHOW,
} from '../constants';

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
    const expected = previewPitch(selected, d)!.offer;

    const after = pitch(selected, d);

    expect(after.phase).toBe('pitching');
    expect(after.earned).toBe(expected);
    expect(after.queueIndex).toBe(1);
    expect(after.selection).toEqual([]);
    expect(after.displayCase).toHaveLength(DISPLAY_CASE_SIZE);
    expect(after.buyer!.id).not.toBe(state.buyer!.id);
  });

  it('records the sale so the table can animate the change', () => {
    const { state, deps: d } = newShow();
    const selected = selectFirst(state, 3);
    const after = pitch(selected, d);

    expect(after.lastSale).not.toBeNull();
    expect(after.lastSale!.cards).toHaveLength(3);
    expect(after.lastSale!.amount).toBe(after.earned);
    expect(after.lastSale!.buyerLabel).toBe(state.buyer!.label);
  });

  it('removes sold cards from the run permanently', () => {
    const { state, deps: d } = newShow();
    const selected = selectFirst(state, 3);
    const soldIds = selected.selection;
    const after = pitch(selected, d);

    const surviving = remainingInventory(after).map((c) => c.id);
    for (const id of soldIds) expect(surviving).not.toContain(id);
    expect(after.sold.map((c) => c.id).sort()).toEqual([...soldIds].sort());
  });
});

describe('selling outright', () => {
  it('takes the previewed offer, with no second decision in between', () => {
    // Haggling used to sit here: an offer you could push on for a goodwill
    // pip. It was cut because the offer is visible before you commit, so the
    // push asked the player to decide twice on the same information — and
    // against a capped buyer the only right answer was always to take it.
    const { state, deps: d } = newShow();
    const selected = selectFirst(state, 3);

    expect(pitch(selected, d).earned).toBe(previewPitch(selected, d)!.offer);
  });

  it('leaves the goodwill pool for digging', () => {
    const { state, deps: d } = newShow();
    const after = pitch(selectFirst(state, 3), d);
    expect(after.goodwill).toBe(state.goodwill);
  });

  it('does nothing without a selection', () => {
    const { state, deps: d } = newShow();
    expect(pitch(state, d)).toBe(state);
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
      next = pitch(selectFirst(next, 5), d);
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

    const after = pitch(selectFirst(state, 2), d);

    expect(after.phase).toBe('over');
    expect(after.queueIndex).toBeLessThan(after.config.buyerCount);
    expect(after.log.some((l) => l.text.includes('sold out'))).toBe(true);
  });

  it('refuses further actions once the show is over', () => {
    const { state, deps: d } = newShow();
    let next = state;
    while (next.phase !== 'over') {
      next = pitch(selectFirst(next, 5), d);
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
        next = pitch(selectFirst(next, 4), d);
      }
      return next;
    };

    expect(play().earned).toBe(play().earned);
    expect(play().log.map((l) => l.text)).toEqual(play().log.map((l) => l.text));
  });
});

describe('digging through the box', () => {
  it('swaps a chosen case card for a chosen stock card without losing the buyer', () => {
    const { state } = newShow();
    const out = state.displayCase[0]!;
    const wanted = state.inventory[0]!;

    const after = digFromStock(state, out.id, wanted.id);

    expect(after.displayCase.map((c) => c.id)).toContain(wanted.id);
    expect(after.displayCase.map((c) => c.id)).not.toContain(out.id);
    expect(after.inventory.map((c) => c.id)).toContain(out.id);
    // The whole point: the buyer you are fetching for is still standing there.
    expect(after.buyer!.id).toBe(state.buyer!.id);
    expect(after.queueIndex).toBe(state.queueIndex);
  });

  it('spends goodwill from the show pool', () => {
    const { state } = newShow();
    const after = digFromStock(state, state.displayCase[0]!.id, state.inventory[0]!.id);
    expect(after.goodwill).toBe(state.goodwill - 1);
  });

  it('is refused with no goodwill left', () => {
    const { state } = newShow();
    const broke: ShowState = { ...state, goodwill: 0 };
    expect(digFromStock(broke, broke.displayCase[0]!.id, broke.inventory[0]!.id)).toBe(broke);
  });

  it('keeps the case the same size', () => {
    const { state } = newShow();
    const after = digFromStock(state, state.displayCase[0]!.id, state.inventory[0]!.id);
    expect(after.displayCase).toHaveLength(state.displayCase.length);
  });

  it('lands the dug card in the first slot, already in the pitch', () => {
    const { state } = newShow();
    const wanted = state.inventory[0]!;
    const after = digFromStock(state, state.displayCase[3]!.id, wanted.id);

    expect(after.displayCase[0]!.id).toBe(wanted.id);
    expect(after.selection).toContain(wanted.id);
  });

  it('leaves a full pitch alone rather than shuffling a card out of it', () => {
    const { state } = newShow();
    const full: ShowState = {
      ...state,
      selection: state.displayCase.slice(0, MAX_PITCH_CARDS).map((c) => c.id),
    };
    const wanted = full.inventory[0]!;
    // The swapped-out card is not in the pitch, so there is no room to add.
    const after = digFromStock(full, full.displayCase[MAX_PITCH_CARDS]!.id, wanted.id);

    expect(after.selection).toEqual(full.selection);
  });
});
