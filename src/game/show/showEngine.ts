/**
 * The show loop as pure state transitions. Every function takes a state and
 * returns a new one; nothing here imports React or touches a store.
 *
 * A show is a crowd, not a queue. Several buyers stand at the table at once
 * and share one case; the player picks cards and chooses who gets them. Every
 * sale costs everyone else a pip of patience, sends a happy buyer off to grow
 * the Buzz, and brings a few cards up from the box.
 *
 * The RNG is threaded in by the caller because drawing and buyer generation
 * genuinely advance the run's stream — unlike resolvePitch, which only forks.
 */

import {
  BUYERS_PER_SHOW,
  BUYER_PATIENCE,
  BUZZ_MAX,
  BUZZ_STEP,
  DISPLAY_CASE_SIZE,
  DRAW_AFFINITY_FRANCHISE,
  DRAW_AFFINITY_RUN,
  DRAW_AFFINITY_RUN_SPAN,
  DRAW_AFFINITY_SET,
  DRAW_AFFINITY_SUBJECT,
  GOODWILL_COST_DIG,
  GOODWILL_COST_HOLD,
  HOLD_PATIENCE,
  MAX_PITCH_CARDS,
  OFFER_RATIO_START,
  QUOTA_BASE,
  QUOTA_GROWTH,
  QUOTA_SOFTEN_AFTER_SHOW,
  QUOTA_SOFT_GROWTH,
  RESTOCK_PER_SALE,
  SHOW_GOODWILL,
  TABLE_FEE_BASE,
  TABLE_FEE_GROWTH,
  TABLE_SEATS,
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
 * What the last sale was, so the table can replay the change in place.
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
  /** The scored pitch, so the receipt can replay how the number was built. */
  readonly result: PitchResult;
  readonly buzzBefore: number;
  readonly buzzAfter: number;
  /** Buyers who ran out of patience during this sale. */
  readonly walked: readonly string[];
}

/** A buyer standing at the table, and how much longer they will stand there. */
export interface Seat {
  readonly buyer: Buyer;
  /** Sales to other people they will sit through. At zero they walk. */
  readonly patience: number;
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
  /** Everyone who will pass through, served or not. */
  readonly buyerCount: number;
  /** How many of them can stand at the table at once. */
  readonly seats: number;
  /** Added to every buyer's patience as they step up. */
  readonly patienceDelta: number;
  readonly buzzStart: number;
  /** Payout added per Buzz level. */
  readonly buzzStep: number;
  /** Cards brought up from the box after each sale. */
  readonly restock: number;
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
  readonly buyersServed: number;
  readonly cardsSold: number;
  readonly peakBuzz: number;
}

export interface ShowState {
  readonly config: ShowConfig;
  readonly earned: number;
  /** Cards not yet drawn into the case. */
  readonly inventory: readonly Card[];
  readonly displayCase: readonly Card[];
  /** Cards in the case that an upgrade is holding hostage. */
  readonly lockedCardIds: readonly string[];
  /**
   * Cards in stock the draw will never reach for. They can still be dug out by
   * hand, which is the point: the walkthrough's third buyer wants something the
   * case cannot supply, and that lesson only survives if the card stays in the
   * box. Empty in a real run.
   */
  readonly heldStockIds: readonly string[];
  readonly selection: readonly string[];
  readonly queue: readonly Buyer[];
  /** Index of the next buyer in `queue` who has not stepped up yet. */
  readonly queueIndex: number;
  /** Everyone at the table right now, in the order they arrived. */
  readonly seats: readonly Seat[];
  /** The crowd, 0..BUZZ_MAX. */
  readonly buzz: number;
  /** Shared across the whole show: spent digging, or asking a buyer to wait. */
  readonly goodwill: number;
  readonly offerRatio: number;
  readonly phase: ShowPhase;
  /** The sale being replayed on the table. */
  readonly lastSale: SaleRecord | null;
  readonly log: readonly LogEntry[];
  readonly outcome: ShowOutcome;
  /** Cards sold this show. They are gone from the run for good. */
  readonly sold: readonly Card[];
  readonly stats: ShowStats;
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

/** What a sale pays on top of the buyer's own money, at this crowd size. */
export function buzzMultiplier(buzz: number, step: number = BUZZ_STEP): number {
  return 1 + Math.max(0, buzz) * step;
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

/**
 * Moves cards from inventory into the case: until it is full, or `limit` cards
 * if one is given. Opening the doors fills the case; a sale only restocks it.
 */
function drawUp(state: ShowState, deps: ShowDeps, limit = Infinity): ShowState {
  const mods = allModifiers(deps.upgrades, deps.conditions);
  const wanted = Math.min(state.config.caseSize - state.displayCase.length, limit);
  if (wanted <= 0) return applyLocks(state);

  const drawHooks = runDrawHooks(mods, {
    showIndex: state.config.showIndex,
    rng: deps.rng,
    requested: wanted,
  });

  const target = wanted + drawHooks.extraCards;
  const pool = state.inventory.filter((c) => !state.heldStockIds.includes(c.id));

  // Weighted rather than uniform: see DRAW_AFFINITY_*. Cards already in the
  // case seed the affinity, and each card drawn feeds the next weighting, so a
  // box organised around one set actually produces a set on the table.
  const context: Card[] = [...state.displayCase];
  const fresh: Card[] = [];

  const affinity = (card: Card): number => {
    let weight = 1;
    for (const held of context) {
      if (held.setId === card.setId) {
        weight += DRAW_AFFINITY_SET;
        // Binders fill in numerical order, so neighbours travel together. This
        // is the only thing anywhere that puts a Set Run on the table.
        if (Math.abs(held.setNumber - card.setNumber) <= DRAW_AFFINITY_RUN_SPAN) {
          weight += DRAW_AFFINITY_RUN;
        }
      } else if (held.franchise === card.franchise) {
        weight += DRAW_AFFINITY_FRANCHISE;
      }
      if (held.subject === card.subject) weight += DRAW_AFFINITY_SUBJECT;
    }
    return weight;
  };

  for (let i = 0; i < target && pool.length > 0; i++) {
    const weights = pool.map(affinity);
    const total = weights.reduce((sum, w) => sum + w, 0);
    let roll = deps.rng.next() * total;
    let index = weights.length - 1;
    for (let j = 0; j < weights.length; j++) {
      roll -= weights[j]!;
      if (roll <= 0) {
        index = j;
        break;
      }
    }
    const [card] = pool.splice(index, 1);
    if (card) {
      context.push(card);
      fresh.push(card);
    }
  }

  const taken = new Set(fresh.map((c) => c.id));

  return applyLocks({
    ...state,
    // Filtered rather than rebuilt, so stock keeps its order and held cards
    // stay exactly where they were.
    inventory: state.inventory.filter((c) => !taken.has(c.id)),
    displayCase: [...state.displayCase, ...fresh],
  });
}

function sellableCards(state: ShowState): Card[] {
  return state.displayCase.filter((c) => !state.lockedCardIds.includes(c.id));
}

/**
 * Brings buyers up from the line until the table is full or the line is empty.
 * A buyer scared off by a hook still uses up their place in the line.
 */
function fillSeats(state: ShowState, deps: ShowDeps): ShowState {
  const mods = allModifiers(deps.upgrades, deps.conditions);
  let next = state;

  while (next.seats.length < next.config.seats && next.queueIndex < next.config.buyerCount) {
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

    const patience = Math.max(
      1,
      BUYER_PATIENCE[arrival.buyer.archetype] + next.config.patienceDelta,
    );
    next = {
      ...next,
      seats: [...next.seats, { buyer: arrival.buyer, patience }],
      queueIndex: next.queueIndex + 1,
    };
  }

  return next;
}

/**
 * Fills the table and then asks whether the show can go on. It cannot when
 * nobody is left to sell to, or when nothing on the table can be sold — an
 * empty case has nothing to swap out either, so digging is no way back.
 */
function settle(state: ShowState, deps: ShowDeps): ShowState {
  if (sellableCards(state).length === 0) {
    return finishShow(
      log(state, 'You are sold out. Nothing left to put on the table.', 'info'),
      deps,
    );
  }

  const seated = fillSeats(state, deps);
  if (seated.seats.length === 0) return finishShow(seated, deps);
  return { ...seated, phase: 'pitching' };
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
    seats: [],
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

/** Moves `count` random unlocked cards out of the case and draws as many back. */
function swapCaseCards(state: ShowState, count: number, deps: ShowDeps): ShowState {
  if (count <= 0) return state;

  const swappable = sellableCards(state);
  const chosen = deps.rng.shuffle(swappable).slice(0, count);
  const chosenIds = new Set(chosen.map((c) => c.id));
  if (chosenIds.size === 0) return state;

  // One in for each one out: the swap churns the case, it does not refill it.
  return drawUp(
    {
      ...state,
      displayCase: state.displayCase.filter((c) => !chosenIds.has(c.id)),
      inventory: [...state.inventory, ...chosen],
      selection: state.selection.filter((id) => !chosenIds.has(id)),
    },
    deps,
    chosenIds.size,
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
    seats: Math.max(1, TABLE_SEATS + start.extraSeats),
    patienceDelta: start.patienceDelta,
    buzzStart: Math.max(0, Math.min(BUZZ_MAX, start.buzzStart)),
    buzzStep: Math.max(0, BUZZ_STEP + start.buzzStepDelta),
    restock: Math.max(1, RESTOCK_PER_SALE + start.extraRestock),
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
    heldStockIds: [],
    selection: [],
    queue: [],
    queueIndex: 0,
    seats: [],
    buzz: config.buzzStart,
    goodwill: config.goodwill,
    offerRatio: config.startingOfferRatio,
    phase: 'pitching',
    lastSale: null,
    log: [],
    outcome: 'inProgress',
    sold: [],
    stats: {
      biggestSale: 0,
      buyersWalked: 0,
      buyersServed: 0,
      cardsSold: 0,
      peakBuzz: config.buzzStart,
    },
    logSeq: 0,
  };

  // The whole line is generated up front so an upgrade can reveal who is
  // coming, and from a per-show fork so the setup rumour can describe it in
  // advance.
  const stream = queueRng(deps.rng, showIndex);
  const queue = Array.from({ length: config.buyerCount }, (_, i) =>
    generateBuyer(stream, showIndex, `s${showIndex}-q${i}`),
  );
  blank = { ...blank, queue };

  for (const line of start.lines) blank = log(blank, line.label, 'info');

  return settle(drawUp(blank, deps), deps);
}

/** Everyone still in line, behind the buyers already at the table. */
export function remainingQueue(state: ShowState): Buyer[] {
  return state.queue.slice(state.queueIndex, state.config.buyerCount);
}

export function seatFor(state: ShowState, buyerId: string): Seat | null {
  return state.seats.find((s) => s.buyer.id === buyerId) ?? null;
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

/**
 * The offer the current selection would draw from one buyer at the table.
 * Every seated buyer prices the same cards differently, so the table asks this
 * once per seat and shows the answers side by side.
 */
export function previewPitch(
  state: ShowState,
  deps: ShowDeps,
  buyerId: string,
): PitchResult | null {
  const seat = seatFor(state, buyerId);
  if (!seat || state.selection.length === 0) return null;
  return resolvePitch({
    cards: selectedCards(state),
    buyer: seat.buyer,
    upgrades: deps.upgrades,
    conditions: deps.conditions,
    offerRatio: state.offerRatio,
    showIndex: state.config.showIndex,
    buzzMult: buzzMultiplier(state.buzz, state.config.buzzStep),
    rng: deps.rng,
  });
}

/**
 * Sells the selection to one buyer at the table and plays out everything that
 * follows from it, in one step:
 *
 *   1. the money is banked, at the current Buzz;
 *   2. a buyer who got something they came for grows the Buzz;
 *   3. everyone else loses a pip of patience, and anyone out of it walks,
 *      taking a level of Buzz with them;
 *   4. a few cards come up from the box;
 *   5. the next people in line step up.
 *
 * There is no haggling phase. The offer is visible before you commit, so a
 * second decision on the same information was only ever "take it".
 *
 * `lastSale` carries what just happened so the table can replay it in place,
 * rather than interrupting the player with a receipt screen.
 */
export function pitch(state: ShowState, deps: ShowDeps, buyerId: string): ShowState {
  if (state.phase !== 'pitching') return state;
  const seat = seatFor(state, buyerId);
  if (!seat) return state;
  const result = previewPitch(state, deps, buyerId);
  if (!result) return state;

  const mods = allModifiers(deps.upgrades, deps.conditions);
  const soldCards = selectedCards(state);
  const sale = runSaleHooks(mods, {
    cards: soldCards,
    buyer: seat.buyer,
    result,
    showIndex: state.config.showIndex,
    rng: deps.rng,
  });

  const money = result.offer + sale.extraMoney;

  // Everyone who was not served sat through that sale.
  const waiting = state.seats
    .filter((s) => s.buyer.id !== buyerId)
    .map((s) => ({ ...s, patience: s.patience - 1 }));
  const walked = waiting.filter((s) => s.patience <= 0);
  const staying = waiting.filter((s) => s.patience > 0);

  const grown = Math.min(BUZZ_MAX, state.buzz + (result.pleased ? 1 : 0));
  const buzz = Math.max(0, grown - walked.length);

  let next: ShowState = {
    ...state,
    earned: state.earned + money,
    // Sold cards leave the case; they were already out of the inventory pool,
    // so this is what makes the loss permanent.
    displayCase: state.displayCase.filter((c) => !state.selection.includes(c.id)),
    inventory: [...state.inventory, ...sale.returnedCards],
    sold: [...state.sold, ...soldCards],
    selection: [],
    seats: staying,
    buzz,
    lastSale: {
      id: state.logSeq,
      buyerLabel: seat.buyer.label,
      pitchTypeLabel: result.pitchTypeLabel,
      cards: soldCards,
      amount: money,
      bonus: sale.extraMoney,
      result,
      buzzBefore: state.buzz,
      buzzAfter: buzz,
      walked: walked.map((s) => s.buyer.label),
    },
    stats: {
      ...state.stats,
      biggestSale: Math.max(state.stats.biggestSale, money),
      buyersServed: state.stats.buyersServed + 1,
      buyersWalked: state.stats.buyersWalked + walked.length,
      cardsSold: state.stats.cardsSold + soldCards.length,
      peakBuzz: Math.max(state.stats.peakBuzz, grown),
    },
  };

  next = log(
    next,
    `${seat.buyer.label} takes the ${result.pitchTypeLabel} for $${Math.round(money)}.`,
    'sale',
  );
  for (const line of sale.lines) next = log(next, line.label, 'info');
  for (const gone of walked) {
    next = log(next, `${gone.buyer.label} got tired of waiting and walked.`, 'walk');
  }

  next = drawUp(next, deps, next.config.restock);
  next = swapCaseCards(next, sale.caseSwaps, deps);

  return settle(next, deps);
}

/** Whether there is goodwill left to ask this buyer to hang on. */
export function canHold(state: ShowState, buyerId: string): boolean {
  if (state.phase !== 'pitching') return false;
  if (!seatFor(state, buyerId)) return false;
  return state.goodwill >= GOODWILL_COST_HOLD;
}

/**
 * Asks one buyer to wait a little longer, for a pip of goodwill.
 *
 * This is the other half of the goodwill pool. Digging fetches the right card;
 * holding buys the turns to serve somebody else first without losing the one
 * you are saving your best pitch for.
 */
export function holdBuyer(state: ShowState, buyerId: string): ShowState {
  if (!canHold(state, buyerId)) return state;
  const held = seatFor(state, buyerId)!;

  return log(
    {
      ...state,
      seats: state.seats.map((s) =>
        s.buyer.id === buyerId ? { ...s, patience: s.patience + HOLD_PATIENCE } : s,
      ),
      goodwill: state.goodwill - GOODWILL_COST_HOLD,
    },
    `You ask the ${held.buyer.label} to hang on a minute.`,
    'turnAway',
  );
}

/**
 * Packs up before the line is empty. Everything unsold goes home with you,
 * which is the point: once the quota is covered, the rest of the crowd is a
 * choice between more money now and more stock next show.
 */
export function closeUp(state: ShowState, deps: ShowDeps): ShowState {
  if (state.phase !== 'pitching') return state;
  return finishShow(log(state, 'You pack up early.', 'info'), deps);
}

/**
 * Swaps one card out of the case for a named card from stock, for the price of
 * a goodwill pip — the table is waiting while you rummage.
 *
 * This is the answer to "the buyer wants a Tidefin and I have three in the
 * box". It costs nobody any patience, only goodwill.
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
  // digging is a deliberate search for a card a buyer wants, so making the
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
    `You dig out ${inCard.subject} while the table waits.`,
    'turnAway',
  );
}

/** Cards still in the case go back to the run's inventory when the show ends. */
export function remainingInventory(state: ShowState): Card[] {
  return [...state.inventory, ...state.displayCase];
}
