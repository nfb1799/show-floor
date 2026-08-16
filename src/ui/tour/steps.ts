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

import { W } from '../../game/run/walkthrough';
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

const sel = (s: RunState): readonly string[] => s.show?.selection ?? [];
const has = (s: RunState, id: string): boolean => sel(s).includes(id);
const inCase = (s: RunState, id: string): boolean =>
  (s.show?.displayCase ?? []).some((c) => c.id === id);

export const TOUR_STEPS: readonly TourStep[] = [
  // -- Buyer one: pitch types and the budget cap ----------------------------
  {
    id: 'welcome',
    title: 'Your table, mid-show',
    text: 'A short show — three buyers. Everything here is the real game.',
  },
  {
    id: 'quota',
    anchor: 'quota',
    title: 'The number that ends runs',
    text: 'Clear the quota by closing time or the run is over.',
  },
  {
    id: 'buyer',
    anchor: 'buyer',
    title: 'Who is at your table',
    text: 'Buyers come one at a time, and there are only ever a handful.',
  },
  {
    id: 'budget',
    anchor: 'budget',
    title: 'What they brought',
    text: 'A hard ceiling. No pitch gets a dollar more than this.',
  },
  {
    id: 'wants',
    anchor: 'wants',
    title: 'What wins them',
    text: 'This one collects Grimoire. Every Grimoire card in the pitch adds Interest.',
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
    text: 'Ashen Lich is Grimoire — exactly what they collect.',
    action: 'Click Ashen Lich',
    until: (s) => has(s, W.lich),
  },
  {
    id: 'math',
    anchor: 'math',
    title: 'How the offer is built',
    text: 'Pitch value plus card value, times Interest. One card is the weakest pitch there is.',
  },
  {
    id: 'pickTwo',
    anchor: `card:${W.golem}`,
    title: 'Now add a second',
    text: 'Two cards sharing a franchise make a Pair. Watch the offer.',
    action: 'Click Rune Golem',
    until: (s) => has(s, W.golem),
  },
  {
    id: 'jumped',
    anchor: 'pay',
    title: '$59 to $210',
    text: 'Cards that go together are worth far more than the same cards sold loose.',
  },
  {
    id: 'capped',
    anchor: 'budget',
    title: 'And the wallet bites',
    text: 'The pitch is worth more than they can pay, so the rest is wasted. Sell now.',
  },
  {
    id: 'send',
    anchor: 'send',
    title: 'Sell it',
    text: 'No haggling — the price you see is the price you get.',
    action: 'Click SELL',
    until: (s) => s.show?.queueIndex === 1,
  },

  // -- Buyer two: condition, slabs and refusals -----------------------------
  {
    id: 'sold',
    anchor: 'quota',
    title: 'Banked',
    text: 'Sold cards leave the run for good, and the case refilled from your stock.',
  },
  {
    id: 'grader',
    anchor: 'wants',
    title: 'A grader',
    text: 'Green is what they pay for: raw cards, Near Mint or better. Red is what they refuse.',
  },
  {
    id: 'conditions',
    anchor: `card:${W.ruiz}`,
    title: 'Condition, corner stamp',
    text: 'PL, LP, NM, MINT. Condition multiplies price — Played pays 0.4x, Mint 1.3x.',
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
    anchor: ['mult', 'pay'],
    title: '$302 to $87',
    text: 'Grading it is the one thing they wanted to do. The red line is the whole pitch, quartered.',
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
    anchor: 'send',
    title: 'Sell it',
    text: 'Two clean cards, no refusal, under their cap.',
    action: 'Click SELL',
    until: (s) => s.show?.queueIndex === 2,
  },

  // -- Buyer three: passing, and digging ------------------------------------
  {
    id: 'setBuilder',
    anchor: 'wants',
    title: 'A set builder',
    text: 'They only want cards from one set — and there is nothing from it in your case.',
  },
  {
    id: 'pass',
    anchor: 'pass',
    title: 'You could wave them off',
    text: 'Three passes a show, and you do not get to choose who walks up next.',
  },
  {
    id: 'digButton',
    anchor: 'dig',
    title: 'Better: go and look',
    text: 'Digging swaps a card with your stock while the buyer waits.',
    action: 'Click DIG',
    untilAnchor: 'digPanel',
  },
  {
    id: 'digCols',
    anchor: ['digOutCol', 'digInCol'],
    title: 'Your case, and your box',
    text: 'Left is what is on the table right now. Right is everything else you own.',
  },
  {
    id: 'digOut',
    anchor: `digOut:${W.pup}`,
    title: 'Something has to go back',
    text: 'The case only holds eight. Send the Bramblepup back to the box.',
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
    text: 'Six a show. Every dig is one you cannot make later.',
  },
  {
    id: 'sendThree',
    anchor: 'send',
    title: 'Sell it',
    text: 'A card they actually want, fetched from a box they cannot see.',
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
    title: 'Or gamble on sealed',
    text: 'Cheaper per card. You open them here and keep what is worth carrying.',
  },
  {
    id: 'gear',
    anchor: 'gear',
    title: 'Gear changes the rules',
    text: 'Permanent upgrades. Each one prints exactly what it does to your pitches.',
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
    text: 'A fee now, a sealed and scored card back. The range on the button is the bet.',
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
    text: 'Read the buyer, build the best pitch you can, stop when the wallet caps.',
  },
];
