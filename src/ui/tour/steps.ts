/**
 * The walkthrough script.
 *
 * Each step points at one real thing on screen and says one thing about it.
 * Steps with an `until` predicate wait for the player to actually do it —
 * those are the ones where the tour hands control back and only the
 * highlighted control is clickable. The rest advance on NEXT.
 *
 * Anchors are `data-tour` values on the real components. A step whose anchor
 * is missing from the DOM falls back to a centred card, so a step can never
 * strand the player.
 */

import { MAX_PITCH_CARDS, SHOW_GOODWILL } from '../../game/constants';
import { W } from '../../game/run/walkthrough';
import type { RunState } from '../../state/runStore';

export interface TourStep {
  readonly id: string;
  /** `data-tour` value to spotlight. Omitted for centred, screen-wide beats. */
  readonly anchor?: string;
  readonly title: string;
  readonly text: string;
  /** Shown as the prompt when the player has to act. */
  readonly action?: string;
  /** When true, the step is done and the tour moves on by itself. */
  readonly until?: (s: RunState) => boolean;
}

const sel = (s: RunState): readonly string[] => s.show?.selection ?? [];
const has = (s: RunState, id: string): boolean => sel(s).includes(id);

export const TOUR_STEPS: readonly TourStep[] = [
  // -- The table ------------------------------------------------------------
  {
    id: 'welcome',
    title: 'Your table, mid-show',
    text:
      'This is one show at a card fair. A short one — two buyers instead of the usual four — so you can see the whole loop before you start a real run. Everything here is the live game; nothing is faked.',
  },
  {
    id: 'quota',
    anchor: 'quota',
    title: 'The number that ends runs',
    text:
      'You owe the show a quota by closing time. Come up short and the run is over — there is no second chance and no partial credit. Everything you do at the table is aimed at this bar.',
  },
  {
    id: 'buyers',
    anchor: 'buyers',
    title: 'Two buyers, then the doors close',
    text:
      'Buyers come one at a time and there are only ever a handful. That is what makes a wasted buyer expensive: you cannot make it up in volume later.',
  },
  {
    id: 'buyer',
    anchor: 'buyer',
    title: 'Who is at your table',
    text:
      'A Personal Collector. Every buyer is an archetype with a wallet and a taste, and reading them is most of the game.',
  },
  {
    id: 'budget',
    anchor: 'budget',
    title: 'What they brought',
    text:
      'A hard ceiling. No pitch, however good, gets a dollar more than this — so building something enormous for a small wallet just burns the cards.',
  },
  {
    id: 'wants',
    anchor: 'wants',
    title: 'What wins them',
    text:
      'This one collects Grimoire, and every Grimoire card in the pitch adds +4 Interest. Interest multiplies the whole pitch, so matching a want is worth far more than it sounds.',
  },
  {
    id: 'case',
    anchor: 'case',
    title: 'Your display case',
    text:
      `Eight cards out of your stock. You pitch up to ${MAX_PITCH_CARDS} of them at a time, and you can see what each one is worth printed on its face.`,
  },
  {
    id: 'pickOne',
    anchor: `card:${W.lich}`,
    title: 'Start with one card',
    text:
      'Ashen Lich — a Grimoire card, so it matches what the collector wants. Click it to put it in the pitch.',
    action: 'Click Ashen Lich',
    until: (s) => has(s, W.lich),
  },
  {
    id: 'math',
    anchor: 'math',
    title: 'How the offer is built',
    text:
      'Pitch value plus card value, multiplied by Interest, cut to their opening offer. One card is a Loose Single: the weakest thing you can pitch, worth almost nothing on its own.',
  },
  {
    id: 'pickTwo',
    anchor: `card:${W.golem}`,
    title: 'Now watch what pairing does',
    text:
      'Rune Golem is Grimoire too, and two cards sharing a franchise make a Pair — a real pitch type with its own bonus. Add it and watch the offer.',
    action: 'Click Rune Golem',
    until: (s) => has(s, W.golem),
  },
  {
    id: 'jumped',
    anchor: 'math',
    title: 'That is the whole game',
    text:
      'One extra card multiplied the offer several times over: the Pair added flat value, and a second matching card added Interest on top. Cards that go together are worth far more than the same cards sold loose.',
  },
  {
    id: 'capped',
    anchor: 'pay',
    title: 'And then the wallet bites',
    text:
      'The pitch is worth more than the collector can pay, so the offer stops at their budget and the rest is wasted. Overbuilding is the most common way to lose money here — this is when you stop adding cards and sell.',
  },
  {
    id: 'send',
    anchor: 'send',
    title: 'Send it',
    text: 'Locks the pitch in and puts the offer on the table.',
    action: 'Click SEND IT',
    until: (s) => s.show?.phase === 'haggling',
  },
  {
    id: 'haggle',
    anchor: 'haggle',
    title: 'Take it or lean on them',
    text:
      `Push raises the offer, but it costs a goodwill pip and shrinks their wallet — and goodwill is ${SHOW_GOODWILL} for the entire show, shared with digging. Pushing a buyer who is already capped pays you less, not more.`,
  },
  {
    id: 'take',
    anchor: 'take',
    title: 'Take the money',
    text: 'This buyer is capped, so there is nothing to gain by pushing. Bank it.',
    action: 'Click TAKE',
    until: (s) => s.show?.queueIndex === 1 && s.show.phase !== 'haggling',
  },

  // -- Buyer two: the refusal ----------------------------------------------
  {
    id: 'sold',
    anchor: 'quota',
    title: 'Banked, and the case refilled',
    text:
      'The quota bar moved, the cards you sold are gone from the run for good, and fresh stock slid into the empty slots. Next buyer is already standing there.',
  },
  {
    id: 'grader',
    anchor: 'wants',
    title: 'A grader, and a warning',
    text:
      'The green chip is what they want: clean raw cards, Near Mint or better. The red one is a refusal — a single beaten card cuts the whole pitch to a quarter. Red chips are penalties, not preferences.',
  },
  {
    id: 'pickClean',
    anchor: `card:${W.dell}`,
    title: 'Give them a clean one',
    text: 'Marcus Dell is raw and Near Mint — exactly what they came for.',
    action: 'Click Marcus Dell',
    until: (s) => has(s, W.dell),
  },
  {
    id: 'pickClean2',
    anchor: `card:${W.vance}`,
    title: 'And a second',
    text: 'Tyrone Vance, also Near Mint. Same set as Dell, so this is a Pair again.',
    action: 'Click Tyrone Vance',
    until: (s) => has(s, W.vance),
  },
  {
    id: 'trap',
    anchor: `card:${W.ruiz}`,
    title: 'Now break it on purpose',
    text:
      'Bobby Ruiz is the same franchise and worth real money — but he is Played. Add him and watch the offer, then we will take him back out.',
    action: 'Click Bobby Ruiz',
    until: (s) => has(s, W.ruiz),
  },
  {
    id: 'collapse',
    anchor: 'math',
    title: 'One bad card did that',
    text:
      'A third card should have raised the offer. Instead the refusal multiplied the entire pitch by 0.25 and cost you more than the card was ever worth. This is why you read the red chip before you build.',
  },
  {
    id: 'untrap',
    anchor: `card:${W.ruiz}`,
    title: 'Take him back out',
    text: 'Clicking a selected card removes it. Nothing is committed until you send.',
    action: 'Click Bobby Ruiz again',
    until: (s) => !has(s, W.ruiz),
  },
  {
    id: 'dig',
    anchor: 'dig',
    title: 'The other use for goodwill',
    text:
      'Dig swaps a card between the case and your stock without losing the buyer — for a goodwill pip. It is how you go and fetch the card someone is asking for, and every dig is a push you are not making.',
  },
  {
    id: 'sendTwo',
    anchor: 'send',
    title: 'Sell it',
    text: 'Two clean cards, no refusal, well under their wallet. This one is not capped.',
    action: 'Click SEND IT',
    until: (s) => s.show?.phase === 'haggling',
  },
  {
    id: 'takeTwo',
    anchor: 'take',
    title: 'Bank the second sale',
    text: 'That is both buyers. The doors close after this one.',
    action: 'Click TAKE',
    until: (s) => s.phase === 'showResult',
  },

  // -- Between shows --------------------------------------------------------
  {
    id: 'result',
    anchor: 'collect',
    title: 'Doors closed',
    text:
      'Over the quota, so the run continues. Miss it and this screen is where the run ends instead.',
    action: 'Click through to the shop',
    until: (s) => s.phase === 'shop',
  },
  {
    id: 'money',
    anchor: 'money',
    title: 'What you can actually spend',
    text:
      'The show money is banked, minus a reserve held back for the next table fee. That reserve is why some prices grey out — it exists so you cannot spend yourself out of a run.',
  },
  {
    id: 'singles',
    anchor: 'singles',
    title: 'Restocking',
    text:
      'Cards you sold are gone, so the shop is where the case gets refilled. Singles are priced honestly and you can see exactly what you are buying.',
  },
  {
    id: 'packs',
    anchor: 'packs',
    title: 'Or gamble on sealed',
    text:
      'Packs are cheaper per card and you open them here, keeping what is worth carrying and listing the rest online at 70% of face.',
  },
  {
    id: 'gear',
    anchor: 'gear',
    title: 'Booth gear changes the rules',
    text:
      'Upgrades are permanent scoring modifiers — more Interest on holos, a bigger case, a buyer who turns up asking for what you already hold. Hover any of them to see what it does.',
  },
  {
    id: 'stock',
    anchor: 'stockBtn',
    title: 'And your box',
    text:
      'Everything you own lives here. Grade a card into a slab, sleeve one up a condition step, or list anything online for 70% of face — and it is where you see how deep you are in each franchise.',
  },
  {
    id: 'next',
    anchor: 'next',
    title: 'Then back to the floor',
    text:
      'The next show wants more money than this one did, and starts adding house rules that bend the arithmetic. That is the run: sell, restock, and stay ahead of the number.',
  },
  {
    id: 'done',
    title: "That is all of it",
    text:
      'Read the buyer, build the best pitch the case allows, stop when the wallet caps, and spend the difference on being ready for the next one. Your real run starts with a fresh box and four buyers a show.',
  },
];
