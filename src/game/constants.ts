/**
 * Every tunable number in Show Floor lives here.
 *
 * Nothing in `game/` should contain a numeric literal that affects balance.
 * Section 3 and 5 of the design doc are explicitly starting guesses, so the
 * expectation is that most of this file changes during step 2 tuning.
 */

import type { Condition, PitchTypeId, Rarity, BuyerArchetypeId } from './types';

// ---------------------------------------------------------------------------
// Card value
// ---------------------------------------------------------------------------

export const RARITY_BASE: Record<Rarity, number> = {
  common: 2,
  uncommon: 5,
  rare: 12,
  rareHolo: 35,
  ultra: 90,
};

/** Ascending power order. Index doubles as the comparable rank. */
export const RARITY_ORDER: readonly Rarity[] = [
  'common',
  'uncommon',
  'rare',
  'rareHolo',
  'ultra',
];

/** Rarities that read as "holo" for Holo Wall and the Kid's want. */
export const HOLO_MIN_RARITY: Rarity = 'rareHolo';

export const CONDITION_MULT: Record<Condition, number> = {
  played: 0.4,
  lightlyPlayed: 0.7,
  nearMint: 1.0,
  mint: 1.3,
};

/** Ascending order. Index doubles as the comparable rank. */
export const CONDITION_ORDER: readonly Condition[] = [
  'played',
  'lightlyPlayed',
  'nearMint',
  'mint',
];

export const GRADE_MIN = 1;
export const GRADE_MAX = 10;

/**
 * Grade -> value multiplier. Grades at or below GRADE_MULT_FLOOR_AT all use
 * GRADE_MULT_FLOOR; everything above is looked up explicitly.
 */
export const GRADE_MULT_FLOOR_AT = 6;
export const GRADE_MULT_FLOOR = 0.8;
export const GRADE_MULT: Record<number, number> = {
  7: 1.4,
  8: 2.0,
  9: 3.2,
  10: 6.0,
};

// ---------------------------------------------------------------------------
// Pitch types
// ---------------------------------------------------------------------------

export interface PitchTypeDef {
  readonly id: PitchTypeId;
  readonly label: string;
  /** Flat value contributed by the pitch type itself. */
  readonly value: number;
  /**
   * Base Interest. The design doc writes these as "x1".."x10" but the Appeal
   * formula adds bonuses to them, so they are additive bases, not multipliers.
   * Multiplicative effects are a separate channel (see INTEREST_* below).
   */
  readonly interest: number;
}

/**
 * Table order from design doc section 5, weakest first. Order is meaningful:
 * it is the tiebreak when two valid types produce an identical offer.
 */
export const PITCH_TYPES: readonly PitchTypeDef[] = [
  { id: 'looseCards', label: 'Loose Cards', value: 5, interest: 1 },
  { id: 'pair', label: 'Pair', value: 12, interest: 2 },
  { id: 'bundle', label: 'Bundle', value: 25, interest: 3 },
  { id: 'rainbow', label: 'Rainbow', value: 40, interest: 4 },
  { id: 'playset', label: 'Playset', value: 55, interest: 4 },
  { id: 'setRun', label: 'Set Run', value: 70, interest: 5 },
  { id: 'fullCase', label: 'Full Case', value: 85, interest: 5 },
  { id: 'gradedRun', label: 'Graded Run', value: 100, interest: 6 },
  { id: 'holoWall', label: 'Holo Wall', value: 130, interest: 8 },
  { id: 'grail', label: 'The Grail', value: 160, interest: 10 },
];

/** Shown instead of "Loose Cards" when the pitch is exactly one card. */
export const LOOSE_SINGLE_LABEL = 'Loose Single';

/**
 * Attributes that count as "sharing an attribute" for Pair and Bundle.
 * Deliberately excludes rarity / slabbed / condition: including them would
 * make almost any three cards a Bundle (three raw cards all share slabbed).
 */
export const SHARED_ATTRIBUTES = ['subject', 'franchise', 'setId'] as const;

/**
 * Graded Run as written ("3+ slabs, ascending grades") reduces to "3 slabs
 * with distinct grades" since the player sorts the pitch, which is trivial
 * for 100/x6. Requiring one franchise puts it in line with Set Run.
 */
export const GRADED_RUN_REQUIRE_SAME_FRANCHISE = true;
export const GRADED_RUN_MIN_CARDS = 3;
export const SET_RUN_MIN_CARDS = 3;
export const RAINBOW_MIN_CARDS = 3;

// ---------------------------------------------------------------------------
// Appeal / offer
// ---------------------------------------------------------------------------

export const MIN_PITCH_CARDS = 1;
export const MAX_PITCH_CARDS = 5;

export const OFFER_RATIO_START = 0.7;
export const HAGGLE_RATIO_STEP = 0.15;

/**
 * Pushing also makes the buyer put money back in their pocket.
 *
 * Without this the push is a dominated choice: goodwill only gates *how many*
 * free raises you get, so the optimal line is always "push until goodwill is 0,
 * then accept" — no decision at all. Shrinking the budget each push means a
 * capped buyer pays strictly less for being pushed, so the read becomes
 * "am I capped?", which the table already shows.
 */
export const HAGGLE_BUDGET_PENALTY = 0.85;

/**
 * Floor applied to (baseInterest + additive bonuses) before multiplicative
 * modifiers. Keeps additive penalties from zeroing or inverting a pitch.
 */
export const MIN_INTEREST = 1;

/** Applied once per pitch if the buyer refuses any card in it. */
export const REFUSAL_INTEREST_MULT = 0.25;

/**
 * What an unwanted card fetches if you list it rather than pitch it.
 *
 * Deliberately below face value: dumping stock is always available but always
 * a loss against selling it to a buyer who wants it.
 */
export const SELL_ONLINE_RATE = 0.7;

// ---------------------------------------------------------------------------
// Buyers
// ---------------------------------------------------------------------------

/**
 * Show-1 budgets. The doc gives only "Medium"/"High"/"Very high"/"Low".
 *
 * Worth knowing while tuning these: budget is a hard cap on money received,
 * so max show revenue is BUYERS_PER_SHOW x avgBudget x BUYER_BUDGET_GROWTH^(n-1)
 * while quota is QUOTA_BASE x QUOTA_GROWTH^(n-1). No amount of Interest crosses
 * a hard cap, so these numbers set a wall that skill alone cannot pass.
 *
 * Cap-breaking upgrades are the chosen answer: the onOfferFinalize hook runs
 * *after* the cap and is the only channel that can pay past a buyer's budget.
 * Budget growth deliberately stays below quota growth to create that demand.
 *
 * After the playtest retune quota growth (1.38) only slightly outpaces budget
 * growth (1.35), and the softened growth after show 12 (1.30) is below it, so
 * the arithmetic requirement peaks near 0.41x of the theoretical ceiling and
 * then recedes. Cap-breaking is now how a strong run pulls ahead rather than a
 * toll every run must pay; the binding pressure is inventory drain.
 */
export const BUYER_BASE_BUDGET: Record<BuyerArchetypeId, number> = {
  kid: 20, // deliberately the gag: a genuinely bad buyer you may want to pass on
  bulkGuy: 60,
  setBuilder: 120,
  personalCollector: 120,
  grader: 135,
  nostalgia: 190,
  flipper: 200,
  investor: 340,
};

/** Interest granted per matching card, by archetype. */
export const WANT_INTEREST: Record<BuyerArchetypeId, number> = {
  setBuilder: 3,
  personalCollector: 4,
  grader: 5,
  investor: 5, // doc omits a number for Investor; every other archetype has one
  kid: 6,
  bulkGuy: 2,
  nostalgia: 5,
  flipper: 0, // the Flipper's demand changes the shape of the offer, not its size
};

export const GRADER_MIN_CONDITION: Condition = 'nearMint';
export const INVESTOR_MIN_GRADE = 9;
export const BULK_GUY_MIN_CARDS = 4;

export const BUYER_GOODWILL_MIN = 1;
export const BUYER_GOODWILL_MAX = 3;

/** Relative frequency of each archetype in the buyer queue. */
export const ARCHETYPE_WEIGHTS: Record<BuyerArchetypeId, number> = {
  setBuilder: 18,
  personalCollector: 16,
  flipper: 13,
  grader: 12,
  investor: 9,
  kid: 11,
  bulkGuy: 13,
  nostalgia: 8,
};

/** Budgets vary by +/- this fraction so two Set Builders are not identical. */
export const BUDGET_JITTER = 0.15;

/** Chance a buyer other than a Personal Collector names a chase card. */
export const CHASE_CARD_CHANCE = 0.2;

/** Sets released at or before this year count as vintage for Nostalgia buyers. */
export const VINTAGE_YEAR_CUTOFF = 1990;

// ---------------------------------------------------------------------------
// Show structure
// ---------------------------------------------------------------------------

export const DISPLAY_CASE_SIZE = 8;
export const BUYERS_PER_SHOW = 4;
export const TURN_AWAYS_PER_SHOW = 3;

/**
 * Turning a buyer away replaces them with a fresh buyer rather than consuming
 * the buyer slot. Consuming the slot (4 buyers minus 3 turn-aways = 1 sale)
 * makes the button a trap against a hard quota.
 */
export const TURN_AWAY_CONSUMES_BUYER_SLOT = false;

/**
 * Quota growth sits just above budget growth, not far above it.
 *
 * The doc's 1.55 against a 1.35 budget curve made the run arithmetically
 * unwinnable by about show 5: buyers are already capped at show 1, so nothing
 * the player builds can close a gap that widens 15% per show. The real pressure
 * the doc asks for — "a constant race between your inventory draining and the
 * quota climbing" — comes from cards being gone forever, not from a number the
 * player cannot reach.
 */
export const QUOTA_BASE = 180;
export const QUOTA_GROWTH = 1.38;
export const QUOTA_SOFT_GROWTH = 1.3;
export const QUOTA_SOFTEN_AFTER_SHOW = 12;

export const TABLE_FEE_BASE = 50;
export const TABLE_FEE_GROWTH = 1.4;

export const BUYER_BUDGET_GROWTH = 1.35;

/** Must at least cover show 1's table fee or the run ends before it starts. */
export const STARTING_BANKROLL = 100;
export const STARTING_INVENTORY_SIZE = 32;

// ---------------------------------------------------------------------------
// Card generation
// ---------------------------------------------------------------------------

export const RARITY_WEIGHTS: Record<Rarity, number> = {
  common: 46,
  uncommon: 28,
  rare: 17,
  rareHolo: 7,
  ultra: 2,
};

export const CONDITION_WEIGHTS: Record<Condition, number> = {
  played: 22,
  lightlyPlayed: 34,
  nearMint: 32,
  mint: 12,
};

export const SLAB_CHANCE = 0.14;

/** Weight per grade value for generated slabs. */
export const GRADE_WEIGHTS: Record<number, number> = {
  5: 4,
  6: 8,
  7: 20,
  8: 30,
  9: 24,
  10: 8,
};

// ---------------------------------------------------------------------------
// Grading
// ---------------------------------------------------------------------------

/**
 * Grade rolled against the submitted card's condition, from design doc s3.
 * Weights carry the doc's "weighted toward 8" / "weighted toward 9" language.
 */
export const GRADE_ROLL: Record<Condition, readonly (readonly [number, number])[]> = {
  played: [
    [1, 1],
    [2, 1],
    [3, 1],
    [4, 1],
    [5, 1],
    [6, 1],
  ],
  lightlyPlayed: [
    [5, 1],
    [6, 1],
    [7, 1],
    [8, 1],
  ],
  nearMint: [
    [7, 2],
    [8, 4],
    [9, 3],
    [10, 1],
  ],
  mint: [
    [8, 3],
    [9, 5],
    [10, 2],
  ],
};

export const GRADING_FEE_BASE = 25;
export const GRADING_FEE_VALUE_PCT = 0.15;

// ---------------------------------------------------------------------------
// Shop
// ---------------------------------------------------------------------------

export const SHOP_SINGLES_COUNT = 5;
export const SHOP_UPGRADES_COUNT = 2;
export const SHOP_REROLL_BASE = 25;
export const SHOP_REROLL_STEP = 15;

/** Singles are sold above computed value; the spread is the shop's margin. */
export const SHOP_PRICE_MARKUP = 1.6;
export const SHOP_MIN_PRICE = 4;

export interface PackTier {
  readonly id: string;
  readonly name: string;
  readonly cost: number;
  readonly cardCount: number;
  readonly rarityWeights: Record<Rarity, number>;
  readonly slabChance: number;
  readonly blurb: string;
}

export const PACK_TIERS: readonly PackTier[] = [
  {
    id: 'bulkLot',
    name: 'Bulk Lot',
    cost: 60,
    cardCount: 9,
    rarityWeights: { common: 62, uncommon: 27, rare: 9, rareHolo: 2, ultra: 0 },
    slabChance: 0.02,
    blurb: 'Nine cards out of a shoebox. Mostly filler, occasionally not.',
  },
  {
    id: 'retail',
    name: 'Retail Pack',
    cost: 150,
    cardCount: 5,
    rarityWeights: { common: 34, uncommon: 32, rare: 24, rareHolo: 8, ultra: 2 },
    slabChance: 0.08,
    blurb: 'Five cards, sealed. The odds are honest but not generous.',
  },
  {
    id: 'hobby',
    name: 'Hobby Box',
    cost: 380,
    cardCount: 6,
    rarityWeights: { common: 10, uncommon: 22, rare: 34, rareHolo: 26, ultra: 8 },
    slabChance: 0.2,
    blurb: 'Six cards with real pull rates. Expensive, and worth it more often.',
  },
];

export interface SupplyDef {
  readonly id: string;
  readonly name: string;
  readonly cost: number;
  /** What it does, mechanically. */
  readonly text: string;
  /** Why a player would spend money on it. Shown in the supplies explainer. */
  readonly why: string;
}

export const SUPPLIES: readonly SupplyDef[] = [
  {
    id: 'sleeve',
    name: 'Penny Sleeves',
    cost: 35,
    text: 'Bump one raw card up a condition step.',
    why:
      'Condition multiplies card value: Played pays 0.4x, Near Mint 1.0x, Mint 1.3x. ' +
      'Sleeving a Near Mint card into Mint is worth 30% of its value forever, so it pays best ' +
      'on your most expensive raw cards. It also turns a card the Grader would refuse into one ' +
      'they want.',
  },
  {
    id: 'toploader',
    name: 'Toploader',
    cost: 50,
    text: 'One raw card survives the next effect that would damage it.',
    why:
      'Only one thing currently damages cards: the Damp Hall show condition, which drops every ' +
      'unsold raw card a condition step when the doors close. Worth it if you are carrying an ' +
      'expensive raw card into a show that might roll it.',
  },
  {
    id: 'priceGuide',
    name: 'Price Guide',
    cost: 70,
    text: "Reveal the next show's buyer mix during setup.",
    why:
      'You see which four archetypes are coming before you pay the table fee, so you know ' +
      'whether to bring slabs or raw, and whether the crowd can afford what you are holding. ' +
      'Single use — it is spent on the next show.',
  },
];

/** A Price Guide is a single-use peek, so holding more than one does nothing. */
export const PRICE_GUIDE_MAX = 1;

// ---------------------------------------------------------------------------
// Permanent capacity
// ---------------------------------------------------------------------------

/** Tables buy upgrade slots. Index 0 is what you start with. */
export const TABLE_TIERS: readonly { readonly slots: number; readonly cost: number }[] = [
  { slots: 3, cost: 0 },
  { slots: 5, cost: 400 },
  { slots: 7, cost: 1200 },
];

/** Each purchase adds one permanent display case slot. */
export const CASE_UPGRADE_COSTS: readonly number[] = [300, 650, 1100];

// ---------------------------------------------------------------------------
// Show conditions
// ---------------------------------------------------------------------------

export const CONDITION_EVERY_N_SHOWS = 3;
/** From this show on, a condition show draws two instead of one. */
export const CONDITION_STACK_FROM_SHOW = 9;
