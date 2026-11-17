import { describe, expect, it } from 'vitest';
import { createRng } from '../rng';
import { generateCards } from '../cards/generate';
import {
  buzzMultiplier,
  canHold,
  closeUp,
  createShow,
  digFromStock,
  holdBuyer,
  previewPitch,
  pitch,
  quotaForShow,
  remainingInventory,
  remainingQueue,
  tableFeeForShow,
  toggleSelection,
  type ShowDeps,
  type ShowState,
} from './showEngine';
import {
  BUYERS_PER_SHOW,
  BUYER_PATIENCE,
  BUZZ_MAX,
  BUZZ_STEP,
  DISPLAY_CASE_SIZE,
  GOODWILL_COST_DIG,
  GOODWILL_COST_HOLD,
  HOLD_PATIENCE,
  MAX_PITCH_CARDS,
  QUOTA_BASE,
  QUOTA_GROWTH,
  RESTOCK_PER_SALE,
  SHOW_GOODWILL,
  TABLE_SEATS,
} from '../constants';
import { buyer, raw } from '../testing/factories';
import type { Buyer } from '../types';

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

/** The buyer who has been at the table longest. */
const first = (state: ShowState): string => state.seats[0]!.buyer.id;

/** Sells `n` cards to whoever has waited longest. */
function sellToFirst(state: ShowState, d: ShowDeps, n: number): ShowState {
  return pitch(selectFirst(state, n), d, first(state));
}

/**
 * A show with a hand-built table, for the rules that depend on exactly who is
 * standing there. Buyers default to inert: no wants, no refusals.
 */
function tableOf(buyers: readonly Buyer[], patience: readonly number[], line: readonly Buyer[] = []) {
  const { state, deps: d } = newShow('table');
  const seated: ShowState = {
    ...state,
    config: { ...state.config, buyerCount: buyers.length + line.length, seats: buyers.length },
    queue: [...buyers, ...line],
    queueIndex: buyers.length,
    seats: buyers.map((b, i) => ({ buyer: b, patience: patience[i] ?? 3 })),
  };
  return { state: seated, deps: d };
}

const pleasedBy = (id: string): Buyer =>
  buyer({ id, label: id, wants: [{ kind: 'volume', minCards: 1, interestPerCard: 1 }] });

describe('escalation', () => {
  it('grows the quota and the table fee from show 1', () => {
    expect(quotaForShow(1)).toBe(QUOTA_BASE);
    expect(quotaForShow(2)).toBe(Math.round(QUOTA_BASE * QUOTA_GROWTH));
    expect(tableFeeForShow(1)).toBe(50);
    expect(tableFeeForShow(2)).toBe(70);
  });

  it('softens quota growth after the crossover show', () => {
    const before = quotaForShow(13) / quotaForShow(12);
    expect(before).toBeCloseTo(1.3, 2);
  });
});

describe('show setup', () => {
  it('fills the case and the table, and leaves the rest in line', () => {
    const { state } = newShow();

    expect(state.displayCase).toHaveLength(DISPLAY_CASE_SIZE);
    expect(state.seats).toHaveLength(TABLE_SEATS);
    expect(state.config.buyerCount).toBe(BUYERS_PER_SHOW);
    expect(remainingQueue(state)).toHaveLength(BUYERS_PER_SHOW - TABLE_SEATS);
    expect(state.buzz).toBe(0);
    expect(state.goodwill).toBe(SHOW_GOODWILL);
    expect(state.phase).toBe('pitching');
  });

  it('seats each buyer with the patience of their kind', () => {
    const { state } = newShow();
    for (const seat of state.seats) {
      expect(seat.patience).toBe(BUYER_PATIENCE[seat.buyer.archetype]);
    }
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
    const card = state.displayCase[0]!;
    const on = toggleSelection(state, card.id);
    expect(toggleSelection(on, card.id).selection).toEqual([]);
  });
});

describe('pricing the same cards for everyone at the table', () => {
  it('quotes each seated buyer separately', () => {
    const collector = buyer({
      id: 'collector',
      wants: [{ kind: 'franchise', franchiseId: 'pocketBeasts', interestPerCard: 4 }],
    });
    const nobody = buyer({ id: 'nobody' });
    const { state, deps: d } = tableOf([collector, nobody], [3, 3]);

    const withCard: ShowState = {
      ...state,
      displayCase: [raw({ id: 'beast', franchise: 'pocketBeasts', rarity: 'rare' })],
      selection: ['beast'],
    };

    const wanted = previewPitch(withCard, d, 'collector')!;
    const shrugged = previewPitch(withCard, d, 'nobody')!;
    expect(wanted.offer).toBeGreaterThan(shrugged.offer);
    expect(wanted.pleased).toBe(true);
    expect(shrugged.pleased).toBe(false);
  });

  it('has nothing to quote for someone who is not at the table', () => {
    const { state, deps: d } = newShow();
    expect(previewPitch(selectFirst(state, 2), d, 'not-here')).toBeNull();
    expect(previewPitch(state, d, first(state))).toBeNull();
  });
});

describe('making a sale', () => {
  it('pays the previewed offer, with no second decision in between', () => {
    // Haggling used to sit here: an offer you could push on for a goodwill
    // pip. It was cut because the offer is visible before you commit, so the
    // push asked the player to decide twice on the same information.
    const { state, deps: d } = newShow();
    const selected = selectFirst(state, 3);
    const expected = previewPitch(selected, d, first(state))!.offer;

    const after = pitch(selected, d, first(state));

    expect(after.earned).toBe(expected);
    expect(after.selection).toEqual([]);
    expect(after.stats.buyersServed).toBe(1);
  });

  it('sends the served buyer off and brings the next one up from the line', () => {
    const { state, deps: d } = newShow();
    const served = first(state);
    const nextInLine = remainingQueue(state)[0]!.id;

    const after = sellToFirst(state, d, 2);

    const ids = after.seats.map((s) => s.buyer.id);
    expect(ids).not.toContain(served);
    expect(ids).toContain(nextInLine);
    expect(after.seats).toHaveLength(TABLE_SEATS);
    expect(remainingQueue(after)).toHaveLength(BUYERS_PER_SHOW - TABLE_SEATS - 1);
  });

  it('records the sale so the table can replay it', () => {
    const { state, deps: d } = newShow();
    const label = state.seats[0]!.buyer.label;
    const after = sellToFirst(state, d, 3);

    expect(after.lastSale).not.toBeNull();
    expect(after.lastSale!.cards).toHaveLength(3);
    expect(after.lastSale!.amount).toBe(after.earned);
    expect(after.lastSale!.buyerLabel).toBe(label);
    expect(after.lastSale!.result.offer).toBe(after.earned);
  });

  it('removes sold cards from the run permanently', () => {
    const { state, deps: d } = newShow();
    const selected = selectFirst(state, 3);
    const soldIds = selected.selection;
    const after = pitch(selected, d, first(state));

    const surviving = remainingInventory(after).map((c) => c.id);
    for (const id of soldIds) expect(surviving).not.toContain(id);
    expect(after.sold.map((c) => c.id).sort()).toEqual([...soldIds].sort());
  });

  it('does nothing without a selection, or without that buyer', () => {
    const { state, deps: d } = newShow();
    expect(pitch(state, d, first(state))).toBe(state);
    const selected = selectFirst(state, 2);
    expect(pitch(selected, d, 'not-here')).toBe(selected);
  });
});

describe('restocking', () => {
  it('brings up a few cards after a sale rather than refilling the case', () => {
    // A five-card pitch used to cost nothing: the case was whole again a
    // moment later. Now it leaves the table thinner for whoever is next.
    const { state, deps: d } = newShow();
    const after = sellToFirst(state, d, 5);
    expect(after.displayCase).toHaveLength(DISPLAY_CASE_SIZE - 5 + RESTOCK_PER_SALE);
  });

  it('never overfills the case after a small sale', () => {
    const { state, deps: d } = newShow();
    expect(sellToFirst(state, d, 1).displayCase).toHaveLength(DISPLAY_CASE_SIZE);
  });
});

describe('patience', () => {
  it('costs everyone else a pip when somebody is served', () => {
    const { state, deps: d } = tableOf([buyer({ id: 'a' }), buyer({ id: 'b' })], [3, 3]);
    const after = pitch(selectFirst(state, 1), d, 'a');

    expect(after.seats.map((s) => s.buyer.id)).toEqual(['b']);
    expect(after.seats[0]!.patience).toBe(2);
  });

  it('walks a buyer who runs out, and counts them', () => {
    const { state, deps: d } = tableOf(
      [buyer({ id: 'a' }), buyer({ id: 'b', label: 'Fed Up' }), buyer({ id: 'c' })],
      [3, 1, 3],
    );
    const after = pitch(selectFirst(state, 1), d, 'a');

    expect(after.seats.map((s) => s.buyer.id)).toEqual(['c']);
    expect(after.stats.buyersWalked).toBe(1);
    expect(after.lastSale!.walked).toEqual(['Fed Up']);
    expect(after.log.some((l) => l.tone === 'walk' && l.text.includes('Fed Up'))).toBe(true);
  });

  it('gives the freed place to the next person in line', () => {
    const { state, deps: d } = tableOf(
      [buyer({ id: 'a' }), buyer({ id: 'b' })],
      [3, 1],
      [buyer({ id: 'c' }), buyer({ id: 'e' })],
    );
    const after = pitch(selectFirst(state, 1), d, 'a');
    // One served, one walked: both places are refilled.
    expect(after.seats.map((s) => s.buyer.id)).toEqual(['c', 'e']);
  });
});

describe('holding a buyer', () => {
  it('buys patience with goodwill', () => {
    const { state } = tableOf([buyer({ id: 'a' }), buyer({ id: 'b' })], [1, 3]);
    const after = holdBuyer(state, 'a');

    expect(after.seats[0]!.patience).toBe(1 + HOLD_PATIENCE);
    expect(after.goodwill).toBe(state.goodwill - GOODWILL_COST_HOLD);
  });

  it('draws on the same pool digging does, so the two really compete', () => {
    const { state } = newShow();
    const held = holdBuyer(state, first(state));
    const dug = digFromStock(state, state.displayCase[0]!.id, state.inventory[0]!.id);
    expect(held.goodwill).toBe(dug.goodwill);
  });

  it('is refused when the goodwill for it is gone', () => {
    const { state } = newShow();
    const broke: ShowState = { ...state, goodwill: 0 };
    expect(canHold(broke, first(broke))).toBe(false);
    expect(holdBuyer(broke, first(broke))).toBe(broke);
  });
});

describe('buzz', () => {
  it('grows when a buyer leaves with something they came for', () => {
    const { state, deps: d } = tableOf([pleasedBy('a'), buyer({ id: 'b' })], [3, 3]);
    const after = pitch(selectFirst(state, 1), d, 'a');
    expect(after.buzz).toBe(1);
    expect(after.stats.peakBuzz).toBe(1);
  });

  it('stays put on a sale the buyer did not care about', () => {
    const { state, deps: d } = tableOf([buyer({ id: 'a' }), buyer({ id: 'b' })], [3, 3]);
    expect(pitch(selectFirst(state, 1), d, 'a').buzz).toBe(0);
  });

  it('thins out when a buyer walks off empty-handed', () => {
    const { state, deps: d } = tableOf([buyer({ id: 'a' }), buyer({ id: 'b' }), buyer({ id: 'c' })], [3, 1, 3]);
    const after = pitch(selectFirst({ ...state, buzz: 3 }, 1), d, 'a');
    expect(after.buzz).toBe(2);
  });

  it('never leaves its range', () => {
    const top = tableOf([pleasedBy('a'), buyer({ id: 'b' })], [3, 3]);
    expect(pitch(selectFirst({ ...top.state, buzz: BUZZ_MAX }, 1), top.deps, 'a').buzz).toBe(BUZZ_MAX);

    const bottom = tableOf([buyer({ id: 'a' }), buyer({ id: 'b' })], [3, 1]);
    expect(pitch(selectFirst(bottom.state, 1), bottom.deps, 'a').buzz).toBe(0);
  });

  it('multiplies what the next sale pays', () => {
    const { state, deps: d } = tableOf([buyer({ id: 'a' }), buyer({ id: 'b' })], [3, 3]);
    const selected = selectFirst(state, 3);
    const quiet = previewPitch(selected, d, 'a')!;
    const packed = previewPitch({ ...selected, buzz: 3 }, d, 'a')!;

    expect(packed.buzzMult).toBeCloseTo(buzzMultiplier(3));
    expect(buzzMultiplier(3)).toBeCloseTo(1 + 3 * BUZZ_STEP);
    expect(packed.baseOffer).toBe(quiet.baseOffer);
    expect(packed.offer).toBe(Math.round(quiet.baseOffer * buzzMultiplier(3)));
  });
});

describe('show completion', () => {
  it('ends once everybody has been served or has walked', () => {
    const { state, deps: d } = newShow();
    let next = state;
    let guard = 0;
    while (next.phase !== 'over' && guard++ < 30) next = sellToFirst(next, d, 2);

    expect(next.phase).toBe('over');
    expect(next.seats).toHaveLength(0);
    expect(remainingQueue(next)).toHaveLength(0);
    expect(next.stats.buyersServed + next.stats.buyersWalked).toBe(BUYERS_PER_SHOW);
    expect(next.outcome).toBe(next.earned >= next.config.quota ? 'cleared' : 'failed');
  });

  it('ends the show when there is nothing left to put on the table', () => {
    // Two cards, sold in one pitch: no case, no inventory, no legal action left.
    const d = deps('soldout');
    const inventory = generateCards(createRng('soldout-inv'), 2, 'inv');
    const state = createShow(1, inventory, d);
    expect(state.displayCase).toHaveLength(2);

    const after = sellToFirst(state, d, 2);

    expect(after.phase).toBe('over');
    expect(after.log.some((l) => l.text.includes('sold out'))).toBe(true);
  });

  it('can be packed up early, keeping what is unsold', () => {
    const { state, deps: d } = newShow();
    const owned = remainingInventory(state).length;
    const after = closeUp(state, d);

    expect(after.phase).toBe('over');
    expect(after.outcome).toBe('failed');
    expect(remainingInventory(after)).toHaveLength(owned);
  });

  it('refuses further actions once the show is over', () => {
    const { state, deps: d } = newShow();
    const over = closeUp(state, d);

    expect(pitch(selectFirst(over, 1), d, first(state))).toBe(over);
    expect(holdBuyer(over, first(state))).toBe(over);
    expect(closeUp(over, d)).toBe(over);
    expect(previewPitch(over, d, first(state))).toBeNull();
  });
});

describe('determinism', () => {
  it('replays a show identically from the same seed', () => {
    const play = () => {
      const { state, deps: d } = newShow('replay');
      let next = state;
      let guard = 0;
      while (next.phase !== 'over' && guard++ < 30) next = sellToFirst(next, d, 3);
      return next;
    };

    expect(play().earned).toBe(play().earned);
    expect(play().log.map((l) => l.text)).toEqual(play().log.map((l) => l.text));
  });
});

describe('digging through the box', () => {
  it('swaps a chosen case card for a chosen stock card without costing anyone patience', () => {
    const { state } = newShow();
    const out = state.displayCase[0]!;
    const wanted = state.inventory[0]!;

    const after = digFromStock(state, out.id, wanted.id);

    expect(after.displayCase.map((c) => c.id)).toContain(wanted.id);
    expect(after.displayCase.map((c) => c.id)).not.toContain(out.id);
    expect(after.inventory.map((c) => c.id)).toContain(out.id);
    // The whole point: everyone you might be fetching for is still there.
    expect(after.seats).toEqual(state.seats);
  });

  it('spends goodwill from the show pool', () => {
    const { state } = newShow();
    const after = digFromStock(state, state.displayCase[0]!.id, state.inventory[0]!.id);
    expect(after.goodwill).toBe(state.goodwill - GOODWILL_COST_DIG);
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
