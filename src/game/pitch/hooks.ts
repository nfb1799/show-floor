/**
 * The modifier lifecycle.
 *
 * Booth Upgrades and Show Conditions are the same kind of object and register
 * against the same hooks. Nothing downstream branches on a modifier's identity;
 * callers only fold whatever the hooks reported.
 *
 * Every runner forks the RNG per modifier id, so a modifier's roll depends only
 * on the caller's stream and its own identity — adding or removing an unrelated
 * upgrade never shifts another one's luck.
 */

import type {
  Buyer,
  BuyerArriveContext,
  Card,
  DrawContext,
  Modifier,
  OfferContext,
  PitchScoreContext,
  SaleContext,
  ScoreLine,
  ShowEndContext,
  ShowStartContext,
} from '../types';

type ModifierSource = 'upgrade' | 'condition';

function sourceOf(mod: Modifier): ModifierSource {
  return mod.kind;
}

/** Deterministic order: upgrades in equip order, then conditions. */
export function allModifiers(
  upgrades: readonly Modifier[],
  conditions: readonly Modifier[],
): Modifier[] {
  return [...upgrades, ...conditions];
}

// ---------------------------------------------------------------------------
// onPitchScore
// ---------------------------------------------------------------------------

export interface PitchScoreHookResult {
  readonly valueLines: ScoreLine[];
  readonly interestAddLines: ScoreLine[];
  readonly interestMultLines: ScoreLine[];
}

export function runPitchScoreHooks(
  mods: readonly Modifier[],
  ctx: PitchScoreContext,
): PitchScoreHookResult {
  const valueLines: ScoreLine[] = [];
  const interestAddLines: ScoreLine[] = [];
  const interestMultLines: ScoreLine[] = [];

  for (const mod of mods) {
    const hook = mod.hooks.onPitchScore;
    if (!hook) continue;
    const source = sourceOf(mod);
    hook(
      { ...ctx, rng: ctx.rng.fork(`pitchScore:${mod.id}`) },
      {
        addValue: (amount, label) => valueLines.push({ label, amount, source }),
        addInterest: (amount, label) => interestAddLines.push({ label, amount, source }),
        multiplyInterest: (factor, label) =>
          interestMultLines.push({ label, amount: factor, source }),
      },
    );
  }

  return { valueLines, interestAddLines, interestMultLines };
}

// ---------------------------------------------------------------------------
// onOfferFinalize
// ---------------------------------------------------------------------------

export interface OfferHookResult {
  readonly offer: number;
  readonly offerLines: ScoreLine[];
}

/**
 * Runs after the budget cap. This is the only channel that can pay more than a
 * buyer's stated budget, so it is where cap-breaking upgrades live.
 */
export function runOfferHooks(mods: readonly Modifier[], ctx: OfferContext): OfferHookResult {
  let offer = ctx.cappedOffer;
  const offerLines: ScoreLine[] = [];

  for (const mod of mods) {
    const hook = mod.hooks.onOfferFinalize;
    if (!hook) continue;
    const source = sourceOf(mod);
    hook(
      { ...ctx, rng: ctx.rng.fork(`offer:${mod.id}`) },
      {
        addOffer: (amount, label) => {
          offer += amount;
          offerLines.push({ label, amount, source });
        },
        multiplyOffer: (factor, label) => {
          const before = offer;
          offer *= factor;
          offerLines.push({ label, amount: offer - before, source });
        },
      },
    );
  }

  return { offer, offerLines };
}

// ---------------------------------------------------------------------------
// onShowStart
// ---------------------------------------------------------------------------

export interface ShowStartHookResult {
  readonly extraCaseSlots: number;
  readonly extraBuyers: number;
  readonly extraTurnAways: number;
  readonly quotaMult: number;
  readonly tableFeeMult: number;
  readonly offerRatioDelta: number;
  readonly lockedSlots: number;
  readonly goodwillDelta: number;
  readonly goodwillOverride: number | null;
  readonly revealNextBuyer: boolean;
  readonly addedCards: Card[];
  readonly lines: ScoreLine[];
}

export function runShowStartHooks(
  mods: readonly Modifier[],
  ctx: ShowStartContext,
): ShowStartHookResult {
  let extraCaseSlots = 0;
  let extraBuyers = 0;
  let extraTurnAways = 0;
  let quotaMult = 1;
  let tableFeeMult = 1;
  let offerRatioDelta = 0;
  let lockedSlots = 0;
  let goodwillDelta = 0;
  let goodwillOverride: number | null = null;
  let revealNextBuyer = false;
  const addedCards: Card[] = [];
  const lines: ScoreLine[] = [];

  for (const mod of mods) {
    const hook = mod.hooks.onShowStart;
    if (!hook) continue;
    const source = sourceOf(mod);
    const note = (label: string, amount: number) => lines.push({ label, amount, source });
    hook(
      { ...ctx, rng: ctx.rng.fork(`showStart:${mod.id}`) },
      {
        addDisplayCaseSlots: (amount, label) => {
          extraCaseSlots += amount;
          note(label, amount);
        },
        addBuyers: (amount, label) => {
          extraBuyers += amount;
          note(label, amount);
        },
        addTurnAways: (amount, label) => {
          extraTurnAways += amount;
          note(label, amount);
        },
        multiplyQuota: (factor, label) => {
          quotaMult *= factor;
          note(label, factor);
        },
        multiplyTableFee: (factor, label) => {
          tableFeeMult *= factor;
          note(label, factor);
        },
        addOfferRatio: (delta, label) => {
          offerRatioDelta += delta;
          note(label, delta);
        },
        lockCaseSlots: (amount, label) => {
          lockedSlots += amount;
          note(label, amount);
        },
        addGoodwill: (amount, label) => {
          goodwillDelta += amount;
          note(label, amount);
        },
        setGoodwill: (value, label) => {
          goodwillOverride = value;
          note(label, value);
        },
        revealNextBuyer: (label) => {
          revealNextBuyer = true;
          note(label, 1);
        },
        addInventoryCards: (cards, label) => {
          addedCards.push(...cards);
          note(label, cards.length);
        },
      },
    );
  }

  return {
    extraCaseSlots,
    extraBuyers,
    extraTurnAways,
    quotaMult,
    tableFeeMult,
    offerRatioDelta,
    lockedSlots,
    goodwillDelta,
    goodwillOverride,
    revealNextBuyer,
    addedCards,
    lines,
  };
}

// ---------------------------------------------------------------------------
// onBuyerArrive
// ---------------------------------------------------------------------------

export interface BuyerArriveHookResult {
  readonly buyer: Buyer;
  readonly scaredOff: boolean;
  readonly lines: ScoreLine[];
}

export function runBuyerArriveHooks(
  mods: readonly Modifier[],
  ctx: BuyerArriveContext,
): BuyerArriveHookResult {
  let buyer = ctx.buyer;
  let budgetMult = 1;
  let scaredOff = false;
  const marks: string[] = [...(buyer.marks ?? [])];
  const lines: ScoreLine[] = [];

  for (const mod of mods) {
    const hook = mod.hooks.onBuyerArrive;
    if (!hook) continue;
    const source = sourceOf(mod);
    const note = (label: string, amount: number) => lines.push({ label, amount, source });
    hook(
      { ...ctx, buyer, rng: ctx.rng.fork(`buyerArrive:${mod.id}`) },
      {
        multiplyBudget: (factor, label) => {
          budgetMult *= factor;
          note(label, factor);
        },
        setChaseCard: (subject, label) => {
          buyer = { ...buyer, chaseCard: subject };
          note(label, 1);
        },
        mark: (tag, label) => {
          if (!marks.includes(tag)) marks.push(tag);
          note(label, 1);
        },
        replaceWith: (next, label) => {
          buyer = next;
          note(label, 1);
        },
        scareOff: (label) => {
          scaredOff = true;
          note(label, 0);
        },
      },
    );
  }

  return {
    buyer: {
      ...buyer,
      budget: Math.max(1, Math.round(buyer.budget * budgetMult)),
      marks,
    },
    scaredOff,
    lines,
  };
}

// ---------------------------------------------------------------------------
// onDraw
// ---------------------------------------------------------------------------

export interface DrawHookResult {
  readonly extraCards: number;
  readonly lines: ScoreLine[];
}

export function runDrawHooks(mods: readonly Modifier[], ctx: DrawContext): DrawHookResult {
  let extraCards = 0;
  const lines: ScoreLine[] = [];

  for (const mod of mods) {
    const hook = mod.hooks.onDraw;
    if (!hook) continue;
    const source = sourceOf(mod);
    hook(
      { ...ctx, rng: ctx.rng.fork(`draw:${mod.id}`) },
      {
        addCards: (amount, label) => {
          extraCards += amount;
          lines.push({ label, amount, source });
        },
      },
    );
  }

  return { extraCards, lines };
}

// ---------------------------------------------------------------------------
// onSale
// ---------------------------------------------------------------------------

export interface SaleHookResult {
  readonly extraMoney: number;
  readonly returnedCards: Card[];
  readonly caseSwaps: number;
  readonly lines: ScoreLine[];
}

export function runSaleHooks(mods: readonly Modifier[], ctx: SaleContext): SaleHookResult {
  let extraMoney = 0;
  let caseSwaps = 0;
  const returnedCards: Card[] = [];
  const lines: ScoreLine[] = [];

  for (const mod of mods) {
    const hook = mod.hooks.onSale;
    if (!hook) continue;
    const source = sourceOf(mod);
    hook(
      { ...ctx, rng: ctx.rng.fork(`sale:${mod.id}`) },
      {
        addMoney: (amount, label) => {
          extraMoney += amount;
          lines.push({ label, amount, source });
        },
        returnCardToInventory: (card, label) => {
          returnedCards.push(card);
          lines.push({ label, amount: 1, source });
        },
        swapCaseCards: (amount, label) => {
          caseSwaps += amount;
          lines.push({ label, amount, source });
        },
      },
    );
  }

  return { extraMoney, returnedCards, caseSwaps, lines };
}

// ---------------------------------------------------------------------------
// onShowEnd
// ---------------------------------------------------------------------------

export interface ShowEndHookResult {
  /** Card id -> replacement. */
  readonly replacements: Map<string, Card>;
  readonly lines: ScoreLine[];
}

export function runShowEndHooks(
  mods: readonly Modifier[],
  ctx: ShowEndContext,
): ShowEndHookResult {
  const replacements = new Map<string, Card>();
  const lines: ScoreLine[] = [];

  for (const mod of mods) {
    const hook = mod.hooks.onShowEnd;
    if (!hook) continue;
    const source = sourceOf(mod);
    hook(
      { ...ctx, rng: ctx.rng.fork(`showEnd:${mod.id}`) },
      {
        replaceCard: (cardId, next, label) => {
          replacements.set(cardId, next);
          lines.push({ label, amount: 1, source });
        },
      },
    );
  }

  return { replacements, lines };
}
