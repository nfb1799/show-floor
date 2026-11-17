/**
 * The walkthrough script.
 *
 * One or two short sentences per step. The spotlight is doing the pointing, so
 * the words only have to say the thing the player cannot see for themselves —
 * anything longer and it stops being a walkthrough and starts being a manual.
 *
 * A step ends by itself when the game reaches the state it asked for: `until`
 * reads the run, `untilAnchor` waits for something to appear on screen (an
 * overlay opening), `untilGone` waits for it to close. Steps with none of those
 * advance on NEXT, and block the screen while they explain.
 */

import { GOODWILL_COST_HOLD, HOLD_PATIENCE, SHOW_GOODWILL } from '../../game/constants';
import { W, WALKTHROUGH_BUYERS, WALKTHROUGH_OFFERS } from '../../game/run/walkthrough';
import type { RunState } from '../../state/runStore';

export interface TourStep {
  readonly id: string;
  /**
   * `data-tour` value to spotlight, or two of them when a step is about the
   * relationship between two things. Omitted for centred, screen-wide beats.
   */
  readonly anchor?: string | readonly string[];
  readonly title: string;
  readonly text: string;
  /** Shown as the prompt when the player has to act. */
  readonly action?: string;
  /** Done when this reads true of the run. */
  readonly until?: (s: RunState) => boolean;
  /** Done when this anchor appears — an overlay opening. */
  readonly untilAnchor?: string;
  /** Done when this anchor disappears — an overlay closing. */
  readonly untilGone?: string;
}

/**
 * Scripted beats quote real money, so the figures come from the engine rather
 * than from the author's memory of what the engine used to do.
 */
const money = (amount: number): string => `$${Math.round(amount).toLocaleString('en-US')}`;

const sel = (s: RunState): readonly string[] => s.show?.selection ?? [];
const has = (s: RunState, id: string): boolean => sel(s).includes(id);
const inCase = (s: RunState, id: string): boolean =>
  (s.show?.displayCase ?? []).some((c) => c.id === id);
const served = (s: RunState): number => s.show?.stats.buyersServed ?? 0;

/** The three scripted buyers, by the lesson each one carries. */
const COLLECTOR = WALKTHROUGH_BUYERS[0]!.id;
const GRADER = WALKTHROUGH_BUYERS[1]!.id;
const BUILDER = WALKTHROUGH_BUYERS[2]!.id;

export const TOUR_STEPS: readonly TourStep[] = [
  // -- The crowd, and the collector: pitch types and the budget cap ---------
  {
    id: 'welcome',
    title: 'You rented a table at a card show',
    text: 'Sell cards out of your case to the crowd, and clear the quota before closing.',
  },
  {
    id: 'quota',
    anchor: 'quota',
    title: 'The number that ends runs',
    text: 'Clear the quota by closing time or the run is over.',
  },
  {
    id: 'crowd',
    anchor: 'crowd',
    title: 'Three buyers, one case',
    text: 'They are all at your table at once. You decide who gets which cards, and who gets served first.',
  },
  {
    id: 'wants',
    anchor: `wants:${COLLECTOR}`,
    title: 'What wins them',
    text: 'This one collects Grimoire. Every Grimoire card in the pitch adds Interest.',
  },
  {
    id: 'budget',
    anchor: `budget:${COLLECTOR}`,
    title: 'The cash they brought',
    text: 'All the money they have on them. Pitch past it and most of the extra is lost.',
  },
  {
    id: 'case',
    anchor: 'case',
    title: 'Your display case',
    text: 'Eight cards. You can pitch up to five of them at once.',
  },
  {
    id: 'pickOne',
    anchor: `card:${W.lich}`,
    title: 'Start with one card',
    text: 'Ashen Lich is Grimoire — exactly what the collector is after.',
    action: 'Click Ashen Lich',
    until: (s) => has(s, W.lich),
  },
  {
    id: 'quotes',
    anchor: 'crowd',
    title: 'Three prices for one card',
    text: 'Everyone names a price for what you picked. The collector wants it; the other two shrug.',
  },
  {
    id: 'math',
    anchor: 'math',
    title: 'How a price is built',
    text: 'Pitch value plus card value, times Interest. One card is the weakest pitch there is.',
  },
  {
    id: 'pickTwo',
    anchor: `card:${W.golem}`,
    title: 'Now add a second',
    text: 'Two cards sharing a franchise make a Pair. Watch the collector.',
    action: 'Click Rune Golem',
    until: (s) => has(s, W.golem),
  },
  {
    id: 'jumped',
    anchor: `quote:${COLLECTOR}`,
    title: `${money(WALKTHROUGH_OFFERS.single)} to ${money(WALKTHROUGH_OFFERS.pair)}`,
    text: 'Cards that go together are worth far more than the same cards sold loose.',
  },
  {
    id: 'guide',
    anchor: 'guideBtn',
    title: 'Every combination that pays',
    text: 'Ten of them, from a Pair up. Open it.',
    action: 'Click WHAT PAYS?',
    untilAnchor: 'guide',
  },
  {
    id: 'guideList',
    anchor: 'guide',
    title: 'The rungs of the ladder',
    text: 'Your Pair is the second one. The rows below it are what the same five slots could be worth.',
    action: 'Close the list',
    untilGone: 'guide',
  },
  {
    id: 'capped',
    anchor: `budget:${COLLECTOR}`,
    title: 'And the wallet runs out',
    text: 'Worth more than they carry. They make up a little of it from their own binder.',
  },
  {
    id: 'send',
    anchor: `sell:${COLLECTOR}`,
    title: 'Sell it to the collector',
    text: 'No haggling — the price you see is the price you get.',
    action: 'Click SELL',
    until: (s) => served(s) === 1,
  },

  // -- What a sale does to everyone else -------------------------------------
  {
    id: 'buzz',
    anchor: 'buzz',
    title: 'The crowd grew',
    text: 'They left with something they came for, so Buzz went up. Every sale now pays more, on top of the buyer.',
  },
  {
    id: 'waited',
    anchor: [`patience:${GRADER}`, `patience:${BUILDER}`],
    title: 'And the others waited',
    text: 'Each sale costs everyone else a pip. Out of pips, they walk — and take a level of Buzz with them.',
  },
  {
    id: 'restock',
    anchor: 'case',
    title: 'The case restocked',
    text: 'Up to three cards come up from your box after a sale. Sell five at once and the table runs thin.',
  },

  // -- The grader: condition, slabs and refusals -----------------------------
  {
    id: 'grader',
    anchor: `wants:${GRADER}`,
    title: 'A grader',
    text: 'Green is what they pay for: raw cards, Near Mint or better. Red is what they refuse.',
  },
  {
    id: 'conditions',
    anchor: `card:${W.ruiz}`,
    title: 'Condition, corner stamp',
    text:
      'Heavy Play (HP), Light Play (LP), Near Mint (NM), Mint (MT) — hover any card to check. It multiplies the price: HP pays 0.4x, MT pays 1.3x.',
  },
  {
    id: 'pickClean',
    anchor: `card:${W.dell}`,
    title: 'Give them a clean one',
    text: 'Marcus Dell is raw and Near Mint, so he counts.',
    action: 'Click Marcus Dell',
    until: (s) => has(s, W.dell),
  },
  {
    id: 'pickClean2',
    anchor: `card:${W.vance}`,
    title: 'And a second',
    text: 'Tyrone Vance, also Near Mint.',
    action: 'Click Tyrone Vance',
    until: (s) => has(s, W.vance),
  },
  {
    id: 'trap',
    anchor: `card:${W.slab}`,
    title: 'Now break it on purpose',
    text: 'A slab is a card sealed and scored out of 10. Worth more, but already graded.',
    action: 'Click Ramon Cruz',
    until: (s) => has(s, W.slab),
  },
  {
    id: 'collapse',
    anchor: [`refusal:${GRADER}`, `quote:${GRADER}`],
    title: `${money(WALKTHROUGH_OFFERS.clean)} to ${money(WALKTHROUGH_OFFERS.refused)}`,
    text:
      'Grading it is the one thing they wanted to do. One refused card, and the whole pitch is quartered.',
  },
  {
    id: 'untrap',
    anchor: `card:${W.slab}`,
    title: 'Take it back out',
    text: 'Clicking a selected card removes it. Nothing commits until you SELL.',
    action: 'Click Ramon Cruz again',
    until: (s) => !has(s, W.slab),
  },
  {
    id: 'sendTwo',
    anchor: `sell:${GRADER}`,
    title: 'Sell it to the grader',
    text: 'Two clean cards, no refusal, and the Buzz from the last sale on top.',
    action: 'Click SELL',
    until: (s) => served(s) === 2,
  },

  // -- The set builder: patience, holding, and digging -----------------------
  {
    id: 'setBuilder',
    anchor: `seat:${BUILDER}`,
    title: 'A set builder, nearly out of patience',
    text: 'One pip left. They only want cards from one set — and none of it is on the table.',
  },
  {
    id: 'hold',
    anchor: `hold:${BUILDER}`,
    title: 'You can ask a buyer to wait',
    text: `${GOODWILL_COST_HOLD} goodwill buys ${HOLD_PATIENCE} more pips. For when somebody else has to be served first.`,
  },
  {
    id: 'digButton',
    anchor: 'dig',
    title: 'Or go and get what they want',
    text: 'Digging swaps a card on the table with one from your box. Nobody loses patience over it.',
    action: 'Click DIG',
    untilAnchor: 'digPanel',
  },
  {
    id: 'digCaseCol',
    anchor: 'digOutCol',
    title: 'On the left, your case',
    text: 'The cards on the table right now.',
  },
  {
    id: 'digBoxCol',
    anchor: 'digInCol',
    title: 'On the right, your box',
    text: 'Everything else you own, which the buyers never see.',
  },
  {
    id: 'digOut',
    anchor: `digOut:${W.pup}`,
    title: 'Something has to go back',
    text: 'It is a swap. Send the Bramblepup back to the box.',
    action: 'Click Bramblepup',
    untilAnchor: 'digPicked',
  },
  {
    id: 'digIn',
    anchor: `digIn:${W.origin}`,
    title: 'And fetch what they asked for',
    text: 'Emberclaw is the one card you own from their set.',
    action: 'Click Emberclaw',
    until: (s) => inCase(s, W.origin),
  },
  {
    id: 'digSelected',
    anchor: `card:${W.origin}`,
    title: 'Already in the pitch',
    text: 'A card you dug for lands in the first slot and selects itself. You went to get it.',
  },
  {
    id: 'digCost',
    anchor: 'goodwill',
    title: 'That cost a goodwill pip',
    text: `${SHOW_GOODWILL} a show, shared between digging and holding. Spend them where the money is.`,
  },
  {
    id: 'sendThree',
    anchor: `sell:${BUILDER}`,
    title: 'Sell it to the set builder',
    text: 'A card they actually want, fetched from a box they cannot see, at the biggest crowd of the day.',
    action: 'Click SELL',
    until: (s) => s.phase === 'showResult',
  },

  // -- Between shows --------------------------------------------------------
  {
    id: 'result',
    anchor: 'collect',
    title: 'Doors closed',
    text: 'Over the quota, so the run continues.',
    action: 'Click through to the shop',
    until: (s) => s.phase === 'shop',
  },
  {
    id: 'bankroll',
    anchor: 'bankroll',
    title: 'Bankroll',
    text: 'Everything you made today, plus what you walked in with.',
  },
  {
    id: 'reserve',
    anchor: 'reserve',
    title: 'Held for the next table',
    text: 'The next show charges a fee. This much is untouchable so you can always pay it.',
  },
  {
    id: 'spendable',
    anchor: 'spendable',
    title: 'Spendable',
    text: 'What the shop may actually take. It is why some prices grey out.',
  },
  {
    id: 'singles',
    anchor: 'singles',
    title: 'Restocking',
    text: 'You sold your best cards. This is where they get replaced.',
  },
  {
    id: 'packs',
    anchor: 'packs',
    title: 'Or buy sealed',
    text: 'Cheaper per card, but you take what you pull. Open them here and keep what earns.',
  },
  {
    id: 'gear',
    anchor: 'gear',
    title: 'Gear changes the rules',
    text: 'Permanent upgrades: better prices, more room, buyers who want what you already hold.',
  },
  {
    id: 'openStock',
    anchor: 'stockBtn',
    title: 'Everything you own',
    text: 'The case is only what fits on the table. This is the whole box.',
    action: 'Click YOUR STOCK',
    untilAnchor: 'stockPanel',
  },
  {
    id: 'depth',
    anchor: 'depth',
    title: 'Depth pays',
    text: 'Hold eight of one franchise and every one of them pitches harder.',
  },
  {
    id: 'pickStockCard',
    // Rare Holo and Near Mint: the kind of card grading is actually for.
    anchor: `stockCard:${W.bloom}`,
    title: 'Cards act one at a time',
    text: 'Gravebloom went unsold. Rare Holo, Near Mint — the best card in the box.',
    action: 'Click Gravebloom',
    untilAnchor: 'cardActions',
  },
  {
    id: 'sleeve',
    anchor: 'sleeve',
    title: 'Sleeving',
    text: 'Lifts a raw card one condition step. Priced by the step it buys.',
  },
  {
    id: 'sellOnline',
    anchor: 'sellOnline',
    title: 'Selling online',
    text: 'Always available, never the best price: 70% of face, no buyer needed.',
  },
  {
    id: 'grade',
    anchor: 'grade',
    title: 'Or send it to be graded',
    text: 'A fee now, a sealed and scored card back. The range on the button is what it could come back as.',
    action: 'Click GRADE',
    untilAnchor: 'gradedPanel',
  },
  {
    id: 'gradedResult',
    anchor: 'gradedPanel',
    title: 'A 10',
    text: 'Six times the base price, for a card that was already your best. Rarely this kind.',
    action: 'Take the slab',
    untilGone: 'gradedPanel',
  },
  {
    id: 'closeStock',
    anchor: 'stockClose',
    title: 'Back to the shop',
    text: 'Nothing here is urgent — the box keeps.',
    action: 'Close your stock',
    untilGone: 'stockPanel',
  },
  {
    id: 'next',
    anchor: 'next',
    title: 'Back to the floor',
    text: 'The next show wants more money, and starts adding house rules.',
  },
  {
    id: 'done',
    title: 'That is the loop',
    text: 'Read the crowd, send people home happy, and save the big pitch for the biggest Buzz.',
  },
];
