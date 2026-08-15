/**
 * Core data model. No behaviour, no imports outside this file.
 */

import type { Rng } from './rng';

// ---------------------------------------------------------------------------
// Cards
// ---------------------------------------------------------------------------

export type Rarity = 'common' | 'uncommon' | 'rare' | 'rareHolo' | 'ultra';
export type Condition = 'played' | 'lightlyPlayed' | 'nearMint' | 'mint';

interface CardBase {
  readonly id: string;
  /** The character / athlete / machine on the card. Always fictional. */
  readonly subject: string;
  readonly franchise: string;
  readonly setId: string;
  readonly setNumber: number;
  readonly rarity: Rarity;
}

export interface RawCard extends CardBase {
  readonly slabbed: false;
  readonly condition: Condition;
  /** Toploader supply: survives one condition-damaging effect, then is spent. */
  readonly toploaded?: boolean;
}

export interface SlabCard extends CardBase {
  readonly slabbed: true;
  /** 1-10. */
  readonly grade: number;
}

/**
 * Discriminated on `slabbed` so `{ slabbed: true, condition: 'mint' }` cannot
 * be constructed. The doc's version had both fields optional on one interface.
 */
export type Card = RawCard | SlabCard;

export interface SetDefinition {
  readonly id: string;
  readonly name: string;
  readonly franchise: string;
  /** Release year. Drives Nostalgia buyers and any future era mechanic. */
  readonly year: number;
  /** Highest legal setNumber. */
  readonly size: number;
}

export interface FranchiseDefinition {
  readonly id: string;
  readonly name: string;
  readonly subjects: readonly string[];
}

// ---------------------------------------------------------------------------
// Pitch types
// ---------------------------------------------------------------------------

export type PitchTypeId =
  | 'looseCards'
  | 'pair'
  | 'bundle'
  | 'rainbow'
  | 'playset'
  | 'setRun'
  | 'fullCase'
  | 'gradedRun'
  | 'holoWall'
  | 'grail';

// ---------------------------------------------------------------------------
// Buyers
// ---------------------------------------------------------------------------

export type BuyerArchetypeId =
  | 'setBuilder'
  | 'personalCollector'
  | 'typeCollector'
  | 'grader'
  | 'investor'
  | 'kid'
  | 'bulkGuy'
  | 'nostalgia';

/**
 * A buyer's demand, resolved to concrete data at buyer-generation time so that
 * scoring never needs to consult the set registry or any other global.
 */
export type Want =
  /** Set Builder (one set) and Nostalgia Buyer (every vintage set). */
  | { readonly kind: 'fromSets'; readonly setIds: readonly string[]; readonly interestPerCard: number }
  /** Personal Collector: collects one franchise, not one card. */
  | { readonly kind: 'franchise'; readonly franchiseId: string; readonly interestPerCard: number }
  /** Grader: raw cards at or above a condition. */
  | { readonly kind: 'rawMinCondition'; readonly minCondition: Condition; readonly interestPerCard: number }
  /** Investor: slabs at or above a grade. */
  | { readonly kind: 'minGrade'; readonly minGrade: number; readonly interestPerCard: number }
  /** Kid with $20. */
  | { readonly kind: 'holo'; readonly interestPerCard: number }
  /** Bulk Guy: per-card bonus, but only on pitches of at least minCards. */
  | { readonly kind: 'volume'; readonly minCards: number; readonly interestPerCard: number }
  /**
   * Type Collector: wants one of everything, so breadth pays and repeats do
   * not. Counted per *distinct* franchise in the pitch, which makes them the
   * one buyer who pulls against collection depth — a mono-franchise box is
   * exactly what they cannot use.
   */
  | { readonly kind: 'distinctFranchises'; readonly interestPerCard: number };

export type Turnoff =
  | { readonly kind: 'anyRaw'; readonly interestMult: number }
  | { readonly kind: 'anySlab'; readonly interestMult: number }
  /** Grader: submitting beaten cards to a condition hunter insults them. */
  | {
      readonly kind: 'rawBelowCondition';
      readonly minCondition: Condition;
      readonly interestMult: number;
    };

export interface Buyer {
  readonly id: string;
  readonly archetype: BuyerArchetypeId;
  /** Display name for the archetype, e.g. "Set Builder". */
  readonly label: string;
  /** Hard cap on money received from this buyer. */
  readonly budget: number;
  readonly wants: readonly Want[];
  readonly turnoff?: Turnoff;
  /** Subject name. Required for The Grail; most buyers have none. */
  readonly chaseCard?: string;
  /**
   * Tags written by onBuyerArrive hooks and read by later stages. Lets a
   * modifier carry a per-buyer decision across hook stages without holding
   * mutable state, which keeps every modifier a plain data object.
   */
  readonly marks?: readonly string[];
}

// ---------------------------------------------------------------------------
// Scoring output
// ---------------------------------------------------------------------------

export interface ScoreLine {
  readonly label: string;
  readonly amount: number;
  /** Where the line came from, for UI grouping and debugging. */
  readonly source: 'pitchType' | 'cards' | 'want' | 'turnoff' | 'upgrade' | 'condition';
}

export interface PitchResult {
  readonly pitchType: PitchTypeId;
  readonly pitchTypeLabel: string;
  readonly cardIds: readonly string[];

  /** Flat value from the pitch type. Zero when the buyer disregards it. */
  readonly pitchValue: number;
  /** False for buyers who price the cards and ignore the packaging. */
  readonly pitchValueCounted: boolean;
  /** Sum of individual card values. */
  readonly cardValue: number;
  readonly valueLines: readonly ScoreLine[];
  /** pitchValue + cardValue + any hook additions. */
  readonly value: number;

  readonly baseInterest: number;
  readonly interestAddLines: readonly ScoreLine[];
  readonly interestMultLines: readonly ScoreLine[];
  readonly interest: number;

  readonly appeal: number;
  readonly offerRatio: number;
  /** Appeal x offerRatio, before the budget cap. */
  readonly uncappedOffer: number;
  readonly budget: number;
  readonly cappedByBudget: boolean;
  /** Post-cap adjustments from onOfferFinalize hooks. */
  readonly offerLines: readonly ScoreLine[];
  /** Final money, whole dollars. */
  readonly offer: number;
}


// ---------------------------------------------------------------------------
// Modifier hooks (upgrades + show conditions)
// ---------------------------------------------------------------------------

export interface ShowStartContext {
  readonly showIndex: number;
  readonly rng: Rng;
  readonly inventorySize: number;
}

export interface ShowStartEffects {
  addDisplayCaseSlots(amount: number, label: string): void;
  addBuyers(amount: number, label: string): void;
  addTurnAways(amount: number, label: string): void;
  multiplyQuota(factor: number, label: string): void;
  multiplyTableFee(factor: number, label: string): void;
  /** Undercutter starts the haggle lower; some upgrades start it higher. */
  addOfferRatio(delta: number, label: string): void;
  /** Fake Grail Display: hold N cards in the case that cannot be pitched. */
  lockCaseSlots(amount: number, label: string): void;
  /**
   * Goodwill is the crowd's patience with you, pooled across the whole show
   * rather than held per buyer: pushing one buyer for more leaves less room to
   * make the next one wait while you dig through the box.
   */
  addGoodwill(amount: number, label: string): void;
  setGoodwill(value: number, label: string): void;
  /** Price Guide Binder: show who is next in the queue. */
  revealNextBuyer(label: string): void;
  /** Estate Sale Contact: stock arrives before the doors open. */
  addInventoryCards(cards: readonly Card[], label: string): void;
}

export interface BuyerArriveContext {
  readonly buyer: Buyer;
  readonly showIndex: number;
  readonly rng: Rng;
  /** 0-based position in this show's buyer queue. */
  readonly buyerIndex: number;
  readonly inventory: readonly Card[];
  readonly displayCase: readonly Card[];
}

export interface BuyerArriveEffects {
  multiplyBudget(factor: number, label: string): void;
  setChaseCard(subject: string, label: string): void;
  /**
   * Tags the buyer for later hook stages to read. This is how a decision made
   * on arrival (Uncle Gary's coin flip, the Rival Vendor's pitch) reaches the
   * scoring stage without any modifier holding mutable state of its own.
   */
  mark(tag: string, label: string): void;
  /** The Regular: swap this buyer out for a different one entirely. */
  replaceWith(buyer: Buyer, label: string): void;
  /** Uncle Gary: the buyer leaves and the slot is consumed. */
  scareOff(label: string): void;
}

export interface DrawContext {
  readonly showIndex: number;
  readonly rng: Rng;
  readonly requested: number;
}

export interface DrawEffects {
  addCards(amount: number, label: string): void;
}

export interface PitchScoreContext {
  readonly cards: readonly Card[];
  readonly buyer: Buyer;
  readonly pitchType: PitchTypeId;
  readonly showIndex: number;
  readonly rng: Rng;
}

export interface PitchScoreEffects {
  addValue(amount: number, label: string): void;
  addInterest(amount: number, label: string): void;
  multiplyInterest(factor: number, label: string): void;
}

export interface OfferContext {
  readonly cards: readonly Card[];
  readonly buyer: Buyer;
  readonly pitchType: PitchTypeId;
  readonly showIndex: number;
  readonly rng: Rng;
  readonly appeal: number;
  readonly offerRatio: number;
  /** Appeal x offerRatio. What the buyer would pay with no budget. */
  readonly uncappedOffer: number;
  /** Offer after the budget cap, before this hook stage. */
  readonly cappedOffer: number;
  readonly cappedByBudget: boolean;
}

/**
 * Post-cap offer adjustment. This is the only channel that can pay a player
 * more than a buyer's stated budget, which makes it the escape valve for the
 * quota-outruns-budget wall described in constants.ts.
 *
 * Cap-breaking is the chosen answer to that wall, so `uncappedOffer` is exposed
 * alongside `cappedOffer`: the gap between them is exactly what an upgrade of
 * the "recover some of what the cap ate" shape needs to work against.
 */
export interface OfferEffects {
  addOffer(amount: number, label: string): void;
  multiplyOffer(factor: number, label: string): void;
}

export interface SaleContext {
  readonly cards: readonly Card[];
  readonly buyer: Buyer;
  readonly result: PitchResult;
  readonly showIndex: number;
  readonly rng: Rng;
}

export interface SaleEffects {
  addMoney(amount: number, label: string): void;
  /** Guy Who Only Asks About Grading: a sold card comes back, changed. */
  returnCardToInventory(card: Card, label: string): void;
  /** Mall Kid With A Binder: churn the case for free. */
  swapCaseCards(amount: number, label: string): void;
}

export interface ShowEndContext {
  readonly showIndex: number;
  readonly rng: Rng;
  /** Everything still in the case when the doors close. */
  readonly unsoldCase: readonly Card[];
}

export interface ShowEndEffects {
  /** Damp Hall: cards go home in worse shape than they arrived. */
  replaceCard(cardId: string, next: Card, label: string): void;
}

/**
 * Upgrades and show conditions are the same shape. Scoring never branches on
 * a modifier's identity; it only folds whatever the hooks report.
 */
export interface Modifier {
  readonly id: string;
  readonly name: string;
  readonly kind: 'upgrade' | 'condition';
  readonly hooks: {
    readonly onShowStart?: (ctx: ShowStartContext, fx: ShowStartEffects) => void;
    readonly onDraw?: (ctx: DrawContext, fx: DrawEffects) => void;
    readonly onBuyerArrive?: (ctx: BuyerArriveContext, fx: BuyerArriveEffects) => void;
    readonly onPitchScore?: (ctx: PitchScoreContext, fx: PitchScoreEffects) => void;
    readonly onOfferFinalize?: (ctx: OfferContext, fx: OfferEffects) => void;
    readonly onSale?: (ctx: SaleContext, fx: SaleEffects) => void;
    readonly onShowEnd?: (ctx: ShowEndContext, fx: ShowEndEffects) => void;
  };
}

export type UpgradeTier = 1 | 2 | 3;

export interface UpgradeDef extends Modifier {
  readonly kind: 'upgrade';
  readonly tier: UpgradeTier;
  readonly cost: number;
  /** Player-facing rules text. */
  readonly text: string;
}

export interface ConditionDef extends Modifier {
  readonly kind: 'condition';
  readonly text: string;
  /** Earliest show this condition can appear. */
  readonly minShow: number;
}
