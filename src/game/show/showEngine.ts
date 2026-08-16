/**
 * The show loop as pure state transitions. Every function takes a state and
 * returns a new one; nothing here imports React or touches a store.
 *
 * The RNG is threaded in by the caller because drawing and buyer generation
 * genuinely advance the run's stream — unlike resolvePitch, which only forks.
 */

import {
  BUYERS_PER_SHOW,
  DISPLAY_CASE_SIZE,
  GOODWILL_COST_DIG,
  MAX_PITCH_CARDS,
  OFFER_RATIO_START,
  QUOTA_BASE,
  QUOTA_GROWTH,
  QUOTA_SOFTEN_AFTER_SHOW,
  QUOTA_SOFT_GROWTH,
  SHOW_GOODWILL,
  TABLE_FEE_BASE,
  TABLE_FEE_GROWTH,
  TURN_AWAYS_PER_SHOW,
  TURN_AWAY_CONSUMES_BUYER_SLOT,
} from '../constants';
import { generateBuyer } from '../buyers/generate';
import { queueRng } from '../run/rumors';
import { resolvePitch } from '../pitch/resolvePitch';
import {
  allModifiers,
  runBuyerArriveHooks,
  runDrawHooks,
  runSaleHooks,
  runShowEndHooks,
  runShowStartHooks,
} from '../pitch/hooks';
import type { Rng } from '../rng';
import type { Buyer, Card, Modifier, PitchResult } from '../types';

export type ShowPhase = 'pitching' | 'over';
export type ShowOutcome = 'inProgress' | 'cleared' | 'failed';

/**
 * What the last sale was, so the table can animate the change in place.
 * `id` changes on every sale, which is what the UI keys its animation off.
 */
export interface SaleRecord {
  readonly id: number;
  readonly buyerLabel: string;
  readonly pitchTypeLabel: string;
  readonly cards: readonly Card[];
  readonly amount: number;
  /** Extra money from onSale hooks, already included in `amount`. */
  readonly bonus: number;
}

export interface LogEntry {
  readonly id: number;
  readonly text: string;
  readonly tone: 'sale' | 'walk' | 'turnAway' | 'info';
}

export interface ShowConfig {
  readonly showIndex: number;
  readonly quota: number;
  readonly tableFee: number;
  readonly caseSize: number;
  readonly buyerCount: number;
  readonly turnAways: number;
  readonly startingOfferRatio: number;
  /** Goodwill the crowd starts the show with. */
  readonly goodwill: number;
  /** Case slots held by an upgrade and unavailable to pitch. */
  readonly lockedSlots: number;
  readonly revealNextBuyer: boolean;
  readonly conditionIds: readonly string[];
}

export interface ShowStats {
  readonly biggestSale: number;
  readonly buyersWalked: number;
  readonly cardsSold: number;
}

export interface ShowState {
  readonly config: ShowConfig;
  readonly earned: number;
  /** Cards not yet drawn into the case. */
  readonly inventory: readonly Card[];
  readonly displayCase: readonly Card[];
  /** Cards in the case that an upgrade is holding hostage. */
  readonly lockedCardIds: readonly string[];
  readonly selection: readonly string[];
  readonly queue: readonly Buyer[];
  readonly queueIndex: number;
  readonly buyer: Buyer | null;
  readonly turnAwaysLeft: number;
  /** Shared across the whole show: spent making a buyer wait while you dig. */
  readonly goodwill: number;
  readonly offerRatio: number;
  readonly phase: ShowPhase;
  /** The sale being shown on the resolve screen. */
  readonly lastSale: SaleRecord | null;
  readonly log: readonly LogEntry[];
  readonly outcome: ShowOutcome;
  /** Cards sold this show. They are gone from the run for good. */
  readonly sold: readonly Card[];
  readonly stats: ShowStats;
  readonly buyerSeq: number;
  readonly logSeq: number;
}

export interface ShowDeps {
  readonly rng: Rng;
  readonly upgrades: readonly Modifier[];
  readonly conditions: readonly Modifier[];
  /** Permanent case slots bought at the shop, on top of the base size. */
  readonly extraCaseSlots?: number;
}

// ---------------------------------------------------------------------------
// Escalation
// ---------------------------------------------------------------------------

export function quotaForShow(showIndex: number): number {
  if (showIndex <= QUOTA_SOFTEN_AFTER_SHOW) {
    return Math.round(QUOTA_BASE * Math.pow(QUOTA_GROWTH, showIndex - 1));
  }
  const atSoftening = QUOTA_BASE * Math.pow(QUOTA_GROWTH, QUOTA_SOFTEN_AFTER_SHOW - 1);
  return Math.round(
    atSoftening * Math.pow(QUOTA_SOFT_GROWTH, showIndex - QUOTA_SOFTEN_AFTER_SHOW),
  );
}

export function tableFeeForShow(showIndex: number): number {
  return Math.round(TABLE_FEE_BASE * Math.pow(TABLE_FEE_GROWTH, showIndex - 1));
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function log(state: ShowState, text: string, tone: LogEntry['tone']): ShowState {
  return {
    ...state,
    log: [...state.log, { id: state.logSeq, text, tone }],
    logSeq: state.logSeq + 1,
  };
}

/** Keeps the locked-slot count satisfied after any change to the case. */
function applyLocks(state: ShowState): ShowState {
  const wanted = state.config.lockedSlots;
  if (wanted <= 0) return state.lockedCardIds.length === 0 ? state : { ...state, lockedCardIds: [] };

  const inCase = new Set(state.displayCase.map((c) => c.id));
  const kept = state.lockedCardIds.filter((id) => inCase.has(id));
  const locked = [...kept];

  for (const card of state.displayCase) {
    if (locked.length >= wanted) break;
    if (!locked.includes(card.id)) locked.push(card.id);
  }

  return {
    ...state,
    lockedCardIds: locked,
    selection: state.selection.filter((id) => !locked.includes(id)),
  };
}

/** Moves random cards from inventory into the case until it is full. */
function drawUp(state: ShowState, deps: ShowDeps): ShowState {
  const mods = allModifiers(deps.upgrades, deps.conditions);
  const wanted = state.config.caseSize - state.displayCase.length;
  if (wanted <= 0) return applyLocks(state);

  const drawHooks = runDrawHooks(mods, {
    showIndex: state.config.showIndex,
    rng: deps.rng,
    requested: wanted,
  });

  const target = wanted + drawHooks.extraCards;
  const inventory = [...state.inventory];
  const drawn: Card[] = [];

  for (let i = 0; i < target && inventory.length > 0; i++) {
    const index = deps.rng.int(0, inventory.length - 1);
    const [card] = inventory.splice(index, 1);
    if (card) drawn.push(card);
  }

  return applyLocks({
    ...state,
    inventory,
    displayCase: [...state.displayCase, ...drawn],
  });
}

/**
 * Replacement buyers (after a turn-away) come from the live stream, so the
 * player cannot predict them. The initial queue comes from a per-show fork —
 * see queueRng — which is what lets the setup-phase rumour be truthful.
 */
function makeBuyer(state: ShowState, deps: ShowDeps): { buyer: Buyer; seq: number } {
  return {
    buyer: generateBuyer(
      deps.rng,
      state.config.showIndex,
      `s${state.config.showIndex}-b${state.buyerSeq}`,
    ),
    seq: state.buyerSeq + 1,
  };
}

/**
 * Seats the next buyer from the queue. A buyer scared off by a hook still
 * consumes their slot, so this walks forward until someone stays or the show
 * runs out of buyers.
 */
function seatBuyer(state: ShowState, deps: ShowDeps): ShowState {
  const mods = allModifiers(deps.upgrades, deps.conditions);
  let next = state;

  // With nothing left to sell there is no legal action, so the show ends here
  // rather than seating a buyer the player cannot pitch to.
  const sellable = next.displayCase.filter((c) => !next.lockedCardIds.includes(c.id));
  if (sellable.length === 0 && next.inventory.length === 0) {
    return finishShow(
      log(next, 'You are sold out. Nothing left to put on the table.', 'info'),
      deps,
    );
  }

  while (next.queueIndex < next.config.buyerCount) {
    const queued = next.queue[next.queueIndex];
    if (!queued) break;

    const arrival = runBuyerArriveHooks(mods, {
      buyer: queued,
      showIndex: next.config.showIndex,
      rng: deps.rng,
      buyerIndex: next.queueIndex,
      inventory: next.inventory,
      displayCase: next.displayCase,
    });

    for (const line of arrival.lines) next = log(next, line.label, 'info');

    if (arrival.scaredOff) {
      next = log(next, `${queued.label} takes one look and keeps walking.`, 'walk');
      next = {
        ...next,
        queueIndex: next.queueIndex + 1,
        stats: { ...next.stats, buyersWalked: next.stats.buyersWalked + 1 },
      };
      continue;
    }

    return {
      ...next,
      buyer: arrival.buyer,
      offerRatio: next.config.startingOfferRatio,
      phase: 'pitching',
      selection: [],
    };
  }

  return finishShow(next, deps);
}

function finishShow(state: ShowState, deps: ShowDeps): ShowState {
  const mods = allModifiers(deps.upgrades, deps.conditions);
  const ended = runShowEndHooks(mods, {
    showIndex: state.config.showIndex,
    rng: deps.rng,
    unsoldCase: state.displayCase,
  });

  const displayCase = state.displayCase.map((c) => ended.replacements.get(c.id) ?? c);
  const cleared = state.earned >= state.config.quota;

  let next: ShowState = {
    ...state,
    displayCase,
    buyer: null,
    selection: [],
    phase: 'over',
    outcome: cleared ? 'cleared' : 'failed',
  };

  for (const line of ended.lines) next = log(next, line.label, 'info');

  return log(
    next,
    cleared
      ? `Show cleared. $${Math.round(state.earned)} against a $${state.config.quota} quota.`
      : `Short of quota: $${Math.round(state.earned)} of $${state.config.quota}.`,
    cleared ? 'sale' : 'walk',
  );
}

function selectedCards(state: ShowState): Card[] {
  // Preserves display-case order rather than click order, so the pitch reads
  // the same as the case looks.
  return state.displayCase.filter((c) => state.selection.includes(c.id));
}

/** Moves `count` random unlocked cards out of the case, then redraws. */
function swapCaseCards(state: ShowState, count: number, deps: ShowDeps): ShowState {
  if (count <= 0) return state;

  const swappable = state.displayCase.filter((c) => !state.lockedCardIds.includes(c.id));
  const chosen = deps.rng.shuffle(swappable).slice(0, count);
  const chosenIds = new Set(chosen.map((c) => c.id));
  if (chosenIds.size === 0) return state;

  return drawUp(
    {
      ...state,
      displayCase: state.displayCase.filter((c) => !chosenIds.has(c.id)),
      inventory: [...state.inventory, ...chosen],
      selection: state.selection.filter((id) => !chosenIds.has(id)),
    },
    deps,
  );
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

/**
 * Resolves the show's shape — quota, fee, slots — without drawing a card or
 * seating a buyer. Safe to call before committing: onShowStart hooks only fork
 * the RNG, so this never advances the caller's stream.
 */
export function planShow(
  showIndex: number,
  inventorySize: number,
  deps: ShowDeps,
): ShowConfig {
  const mods = allModifiers(deps.upgrades, deps.conditions);
  const start = runShowStartHooks(mods, { showIndex, rng: deps.rng, inventorySize });
  return buildConfig(showIndex, deps, start);
}

function buildConfig(
  showIndex: number,
  deps: ShowDeps,
  start: ReturnType<typeof runShowStartHooks>,
): ShowConfig {
  return {
    showIndex,
    quota: Math.round(quotaForShow(showIndex) * start.quotaMult),
    tableFee: Math.round(tableFeeForShow(showIndex) * start.tableFeeMult),
    caseSize: Math.max(1, DISPLAY_CASE_SIZE + (deps.extraCaseSlots ?? 0) + start.extraCaseSlots),
    buyerCount: Math.max(1, BUYERS_PER_SHOW + start.extraBuyers),
    turnAways: Math.max(0, TURN_AWAYS_PER_SHOW + start.extraTurnAways),
    startingOfferRatio: Math.max(0.05, OFFER_RATIO_START + start.offerRatioDelta),
    goodwill: Math.max(
      0,
      (start.goodwillOverride ?? SHOW_GOODWILL) +
        (start.goodwillOverride === null ? start.goodwillDelta : 0),
    ),
    lockedSlots: start.lockedSlots,
    revealNextBuyer: start.revealNextBuyer,
    conditionIds: deps.conditions.map((c) => c.id),
  };
}

export function createShow(
  showIndex: number,
  inventory: readonly Card[],
  deps: ShowDeps,
): ShowState {
  const mods = allModifiers(deps.upgrades, deps.conditions);
  const start = runShowStartHooks(mods, {
    showIndex,
    rng: deps.rng,
    inventorySize: inventory.length,
  });
  const config = buildConfig(showIndex, deps, start);

  let blank: ShowState = {
    config,
    earned: 0,
    inventory: [...inventory, ...start.addedCards],
    displayCase: [],
    lockedCardIds: [],
    selection: [],
    queue: [],
    queueIndex: 0,
    buyer: null,
    turnAwaysLeft: config.turnAways,
    goodwill: config.goodwill,
    offerRatio: config.startingOfferRatio,
    phase: 'pitching',
    lastSale: null,
    log: [],
    outcome: 'inProgress',
    sold: [],
    stats: { biggestSale: 0, buyersWalked: 0, cardsSold: 0 },
    buyerSeq: 0,
    logSeq: 0,
  };

  // The whole queue is generated up front so an upgrade can reveal who is next,
  // and from a per-show fork so the setup rumour can describe it in advance.
  const stream = queueRng(deps.rng, showIndex);
  const queue = Array.from({ length: config.buyerCount }, (_, i) =>
    generateBuyer(stream, showIndex, `s${showIndex}-q${i}`),
  );
  blank = { ...blank, queue, buyerSeq: config.buyerCount };

  for (const line of start.lines) blank = log(blank, line.label, 'info');

  return seatBuyer(drawUp(blank, deps), deps);
}

/** Everyone still waiting behind the buyer at the table. */
export function remainingQueue(state: ShowState): Buyer[] {
  return state.queue.slice(state.queueIndex + 1);
}

/** The buyer after the current one, when an upgrade grants the peek. */
export function nextBuyerPreview(state: ShowState): Buyer | null {
  if (!state.config.revealNextBuyer) return null;
  return state.queue[state.queueIndex + 1] ?? null;
}

// ---------------------------------------------------------------------------
// Player actions
// ---------------------------------------------------------------------------

export function isLocked(state: ShowState, cardId: string): boolean {
  return state.lockedCardIds.includes(cardId);
}

export function toggleSelection(state: ShowState, cardId: string): ShowState {
  if (state.phase !== 'pitching') return state;
  if (isLocked(state, cardId)) return state;
  if (state.selection.includes(cardId)) {
    return { ...state, selection: state.selection.filter((id) => id !== cardId) };
  }
  if (state.selection.length >= MAX_PITCH_CARDS) return state;
  return { ...state, selection: [...state.selection, cardId] };
}

export function clearSelection(state: ShowState): ShowState {
  return { ...state, selection: [] };
}

/** The offer the current selection would draw, for the pre-commit preview. */
export function previewPitch(state: ShowState, deps: ShowDeps): PitchResult | null {
  if (!state.buyer || state.selection.length === 0) return null;
  return resolvePitch({
    cards: selectedCards(state),
    buyer: state.buyer,
    upgrades: deps.upgrades,
    conditions: deps.conditions,
    offerRatio: state.offerRatio,
    showIndex: state.config.showIndex,
    rng: deps.rng,
  });
}

/**
 * Sells the selection outright, banks it, refills the case and seats the next
 * buyer in one step.
 *
 * There used to be a haggling phase between the pitch and the sale — an offer
 * you could push on for a goodwill pip. It was cut: the offer is already
 * visible before you commit, so the push was a second decision made on the
 * same information as the first, and against a capped buyer (which is most of
 * them) the only correct answer was always to take the money.
 *
 * `lastSale` carries what just happened so the table can animate the change in
 * place, rather than interrupting the player with a receipt screen.
 */
export function pitch(state: ShowState, deps: ShowDeps): ShowState {
  if (state.phase !== 'pitching' || !state.buyer) return state;
  const result = previewPitch(state, deps);
  if (!result) return state;

  const mods = allModifiers(deps.upgrades, deps.conditions);
  const soldCards = selectedCards(state);
  const sale = runSaleHooks(mods, {
    cards: soldCards,
    buyer: state.buyer,
    result,
    showIndex: state.config.showIndex,
    rng: deps.rng,
  });

  const money = result.offer + sale.extraMoney;

  let next: ShowState = {
    ...state,
    earned: state.earned + money,
    // Sold cards leave the case; they were already out of the inventory pool,
    // so this is what makes the loss permanent.
    displayCase: state.displayCase.filter((c) => !state.selection.includes(c.id)),
    inventory: [...state.inventory, ...sale.returnedCards],
    sold: [...state.sold, ...soldCards],
    selection: [],
    lastSale: {
      id: state.logSeq,
      buyerLabel: state.buyer.label,
      pitchTypeLabel: result.pitchTypeLabel,
      cards: soldCards,
      amount: money,
      bonus: sale.extraMoney,
    },
    queueIndex: state.queueIndex + 1,
    stats: {
      ...state.stats,
      biggestSale: Math.max(state.stats.biggestSale, money),
      cardsSold: state.stats.cardsSold + soldCards.length,
    },
  };

  next = log(
    next,
    `${state.buyer.label} takes the ${result.pitchTypeLabel} for $${Math.round(money)}.`,
    'sale',
  );
  for (const line of sale.lines) next = log(next, line.label, 'info');

  next = drawUp(next, deps);
  next = swapCaseCards(next, sale.caseSwaps, deps);

  return seatBuyer(next, deps);
}

export function turnAway(state: ShowState, deps: ShowDeps): ShowState {
  if (state.phase !== 'pitching' || !state.buyer) return state;
  if (state.turnAwaysLeft <= 0) return state;

  const swappedOut = state.displayCase.filter(
    (c) => state.selection.includes(c.id) && !isLocked(state, c.id),
  );

  let next: ShowState = {
    ...state,
    displayCase: state.displayCase.filter((c) => !swappedOut.some((s) => s.id === c.id)),
    inventory: [...state.inventory, ...swappedOut],
    selection: [],
    turnAwaysLeft: state.turnAwaysLeft - 1,
  };

  if (TURN_AWAY_CONSUMES_BUYER_SLOT) {
    next = { ...next, queueIndex: next.queueIndex + 1 };
  } else {
    // The slot survives, but the buyer does not: a fresh one takes their place.
    const made = makeBuyer(next, deps);
    const queue = [...next.queue];
    queue[next.queueIndex] = made.buyer;
    next = { ...next, queue, buyerSeq: made.seq };
  }

  next = log(
    next,
    swappedOut.length > 0
      ? `You wave off the ${state.buyer.label} and swap ${swappedOut.length} card${swappedOut.length === 1 ? '' : 's'}.`
      : `You wave off the ${state.buyer.label}.`,
    'turnAway',
  );

  return seatBuyer(drawUp(next, deps), deps);
}

/**
 * Swaps one card out of the case for a named card from stock, for the price of
 * a goodwill pip — the buyer is waiting while you rummage.
 *
 * This is the answer to "the buyer wants a Tidefin and I have three in the
 * box": it does not dismiss them, because dismissing them defeats the point.
 */
export function digFromStock(
  state: ShowState,
  outCardId: string,
  inCardId: string,
): ShowState {
  if (state.phase !== 'pitching') return state;
  if (state.goodwill < GOODWILL_COST_DIG) return state;
  if (isLocked(state, outCardId)) return state;

  const outCard = state.displayCase.find((c) => c.id === outCardId);
  const inCard = state.inventory.find((c) => c.id === inCardId);
  if (!outCard || !inCard) return state;

  // The dug card goes to the front of the case and straight into the pitch:
  // digging is a deliberate search for a card the buyer wants, so making the
  // player hunt for it again in the case and click it is pure friction.
  const kept = state.selection.filter((id) => id !== outCardId);
  const selection = kept.length < MAX_PITCH_CARDS ? [inCard.id, ...kept] : kept;

  const next: ShowState = {
    ...state,
    displayCase: [inCard, ...state.displayCase.filter((c) => c.id !== outCardId)],
    inventory: state.inventory.filter((c) => c.id !== inCardId).concat(outCard),
    selection,
    goodwill: state.goodwill - GOODWILL_COST_DIG,
  };

  return log(
    applyLocks(next),
    `You dig out ${inCard.subject} while ${state.buyer?.label ?? 'the buyer'} waits.`,
    'turnAway',
  );
}

/** Cards still in the case go back to the run's inventory when the show ends. */
export function remainingInventory(state: ShowState): Card[] {
  return [...state.inventory, ...state.displayCase];
}
