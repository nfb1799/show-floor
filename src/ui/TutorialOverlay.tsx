/**
 * The optional tutorial. Opens itself once for a player with no save, and is
 * reachable from the title screen afterwards.
 *
 * It teaches by showing the real widgets — a real CardView, a real BuyerPanel,
 * a real Tally fed by a real resolvePitch call — rather than by describing
 * them. That keeps the pages honest: if the scoring changes, the worked
 * example on page five changes with it, because it is the same code path the
 * game runs. The pitch-type table is likewise read out of PITCH_TYPES.
 *
 * Everything here is sample data. Nothing in this file touches the run store.
 */

import { useEffect, useState, type ReactNode } from 'react';
import { formatMoney } from '../game/cards/value';
import {
  BUYERS_PER_SHOW,
  MAX_PITCH_CARDS,
  OFFER_RATIO_START,
  PITCH_TYPES,
  SHOW_GOODWILL,
  TURN_AWAYS_PER_SHOW,
} from '../game/constants';
import { resolvePitch } from '../game/pitch/resolvePitch';
import { createRng } from '../game/rng';
import { quotaForShow, tableFeeForShow } from '../game/show/showEngine';
import type { Buyer, Card } from '../game/types';
import { BuyerPanel } from './BuyerPanel';
import { CardView } from './card/CardView';
import { Band } from './kit';
import { Tally } from './Tally';
import styles from './app.module.css';

// ---------------------------------------------------------------------------
// Sample data
// ---------------------------------------------------------------------------

const SAMPLE_CARD: Card = {
  id: 'tut-1',
  subject: 'Ashen Lich',
  franchise: 'grimoire',
  setId: 'gr-codex',
  setNumber: 12,
  rarity: 'rareHolo',
  slabbed: false,
  condition: 'nearMint',
};

/**
 * Two cards sharing a franchise: a Pair, for the worked example.
 *
 * Deliberately the second-weakest pitch type. Anything stronger multiplies
 * past this buyer's wallet by several times over, and a first example that
 * ends in "$1,282 left on the table" teaches that the numbers are broken
 * rather than that the cap is real. A Pair overshoots by a little, which is
 * the lesson: build to the wallet, not past it.
 */
const SAMPLE_PITCH: Card[] = [
  {
    id: 'tut-2',
    subject: 'Rune Golem',
    franchise: 'grimoire',
    setId: 'gr-codex',
    setNumber: 13,
    rarity: 'rare',
    slabbed: false,
    condition: 'nearMint',
  },
  {
    id: 'tut-3',
    subject: 'Gravebloom',
    franchise: 'grimoire',
    setId: 'gr-codex',
    setNumber: 14,
    rarity: 'rare',
    slabbed: false,
    condition: 'nearMint',
  },
];

const SAMPLE_BUYER: Buyer = {
  id: 'tut-buyer',
  archetype: 'personalCollector',
  label: 'Personal Collector',
  budget: 210,
  wants: [{ kind: 'franchise', franchiseId: 'grimoire', interestPerCard: 4 }],
};

const SAMPLE_RESULT = resolvePitch({
  cards: SAMPLE_PITCH,
  buyer: SAMPLE_BUYER,
  upgrades: [],
  conditions: [],
  rng: createRng('tutorial'),
});

// ---------------------------------------------------------------------------
// Page furniture
// ---------------------------------------------------------------------------

function Note({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className={styles.tutNote}>
      <div className={styles.tutNoteTitle}>{title}</div>
      <div className={styles.tutNoteBody}>{children}</div>
    </div>
  );
}

interface Page {
  readonly key: string;
  readonly title: string;
  readonly note: string;
  readonly body: ReactNode;
}

const PAGES: readonly Page[] = [
  {
    key: 'job',
    title: 'The job',
    note: '1 OF 6',
    body: (
      <>
        <p className={styles.tutLead}>
          You rent a table at a card show, sell out of a display case, and have to clear a
          revenue quota before the aisle empties. Miss it once and the run is over.
        </p>
        <div className={styles.tutNotes}>
          <Note title="A show is short">
            {BUYERS_PER_SHOW} buyers come to your table, one at a time. That is every chance
            you get, so a wasted buyer is expensive.
          </Note>
          <Note title="The quota climbs">
            Show 1 asks for {formatMoney(quotaForShow(1))} and takes a{' '}
            {formatMoney(tableFeeForShow(1))} table fee up front. By show 4 the quota is{' '}
            {formatMoney(quotaForShow(4))}. Your stock has to grow faster than the number does.
          </Note>
          <Note title="Sold is gone">
            Cards you sell leave the run for good. Between shows you buy singles and packs to
            replace them — that is where the money you made goes.
          </Note>
        </div>
      </>
    ),
  },
  {
    key: 'card',
    title: 'What a card says',
    note: '2 OF 6',
    body: (
      <div className={styles.tutSplit}>
        <div className={styles.tutArtCard}>
          <CardView card={SAMPLE_CARD} />
        </div>
        <div className={styles.tutNotes}>
          <Note title="Price">
            Rarity sets the base — Common $2 up to Ultra $90 — and condition multiplies it.
            Played pays 0.4x, Near Mint 1.0x, Mint 1.3x. A slab uses its grade instead: a 10 is
            worth 6x the base.
          </Note>
          <Note title="Franchise and set">
            Both are printed because pitches are built out of them: cards from one franchise, or
            consecutive numbers from one set. The year matters to buyers hunting vintage.
          </Note>
          <Note title="The stamp">
            Top corner. A raw card shows its condition (PL, LP, NM, MINT); a graded one shows
            GRADED and its number. Some buyers only touch one or the other.
          </Note>
        </div>
      </div>
    ),
  },
  {
    key: 'buyer',
    title: 'Reading a buyer',
    note: '3 OF 6',
    body: (
      <div className={styles.tutColumn}>
        <BuyerPanel buyer={SAMPLE_BUYER} position={1} total={BUYERS_PER_SHOW} />
        <div className={styles.tutNotes}>
          <Note title="Pays up to is a wall">
            No pitch gets more than the buyer brought. Building something enormous for someone
            with a small wallet just leaves money on the table — sell it to the next one.
          </Note>
          <Note title="What wins them">
            Every card matching their want adds Interest, and Interest multiplies the whole
            pitch. Four matching cards beat one great card more often than you would think.
          </Note>
          <Note title="And what loses them">
            A red chip is a penalty, not a preference: a Grader seeing one beaten raw card cuts
            the pitch to a quarter. Pull the offender out and pitch the rest.
          </Note>
        </div>
      </div>
    ),
  },
  {
    key: 'pitches',
    title: 'What actually pays',
    note: '4 OF 6',
    body: (
      <>
        <p className={styles.tutLead}>
          Any 1 to {MAX_PITCH_CARDS} cards can be pitched, but cards that go together are worth
          far more than the same cards sold loose. The best type your selection qualifies for is
          detected for you — this is the table it is checking against.
        </p>
        <div className={styles.tutTable}>
          <div className={styles.tutTableHead}>
            <span>Pitch</span>
            <span>Needs</span>
            <span>Value</span>
            <span>Interest</span>
          </div>
          {PITCH_TYPES.map((type) => (
            <div key={type.id} className={styles.tutTableRow}>
              <span className={styles.tutTableName}>{type.label}</span>
              <span className={styles.tutTableReq}>{type.requires}</span>
              <span className={styles.tutTableNum}>+{type.value}</span>
              <span className={styles.tutTableNum}>x{type.interest}</span>
            </div>
          ))}
        </div>
      </>
    ),
  },
  {
    key: 'offer',
    title: 'Where the number comes from',
    note: '5 OF 6',
    body: (
      <>
        <p className={styles.tutLead}>
          Two Grimoire cards pitched to the collector from the last page. This is the real
          tally, scored by the real engine:
        </p>
        <div className={styles.tutTally}>
          <Tally
            result={SAMPLE_RESULT}
            turnAwaysLeft={TURN_AWAYS_PER_SHOW}
            canPitch={false}
            canTurnAway={false}
            canDig={false}
            onPitch={() => {}}
            onTurnAway={() => {}}
            onDig={() => {}}
          />
        </div>
        <div className={styles.tutNotes}>
          <Note title="Pitch value plus card value">
            The pitch type contributes a flat number ({SAMPLE_RESULT.pitchValue} for a Pair); the
            cards contribute what they are worth. Both go into the same pot.
          </Note>
          <Note title="Interest multiplies all of it">
            The pitch type sets the base ({SAMPLE_RESULT.baseInterest} here) and every matching
            card adds to it. It multiplies the whole pot, which is why the same cards are worth
            several times more to the right buyer than the wrong one.
          </Note>
          <Note title="Then the wallet bites">
            Appeal is cut to {Math.round(OFFER_RATIO_START * 100)}% — that is their opening
            offer, and pushing raises it. But no buyer pays past what they brought, so this
            pitch banks {formatMoney(SAMPLE_RESULT.offer)} and the rest is wasted. Overbuilding
            is the most common way to lose money here.
          </Note>
        </div>
      </>
    ),
  },
  {
    key: 'levers',
    title: 'Your levers',
    note: '6 OF 6',
    body: (
      <>
        <p className={styles.tutLead}>
          Four buttons and a shop. Everything else is reading the room.
        </p>
        <div className={styles.tutNotes}>
          <Note title="Send it">
            Locks in the pitch. The buyer answers with an offer you can take or push on.
          </Note>
          <Note title="Push">
            Spends 1 Goodwill to raise the offer — but shrinks their wallet a little each time,
            so pushing a buyer who is already capped pays you less, not more.
          </Note>
          <Note title="Dig">
            Spends 1 Goodwill to swap a card between the case and your stock without losing the
            buyer. Goodwill is {SHOW_GOODWILL} for the whole show, shared between pushing and
            digging, so every dig is a push you are not making.
          </Note>
          <Note title="Pass">
            Waves the buyer off and brings a fresh one. {TURN_AWAYS_PER_SHOW} per show, and the
            replacement is drawn live — you are trading a known bad buyer for an unknown one.
          </Note>
          <Note title="Between shows">
            Buy singles, packs, and booth gear that changes the scoring rules; grade a card,
            sleeve one up a condition step, or list anything online for 70% of face. Hold 8+
            cards of one franchise and every one of them pitches harder.
          </Note>
        </div>
      </>
    ),
  },
];

// ---------------------------------------------------------------------------

export function TutorialOverlay({ onClose }: { onClose: () => void }) {
  const [page, setPage] = useState(0);
  const current = PAGES[page]!;
  const last = page === PAGES.length - 1;

  const go = (delta: number): void =>
    setPage((p) => Math.max(0, Math.min(PAGES.length - 1, p + delta)));

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') go(1);
      if (e.key === 'ArrowLeft') go(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className={styles.scrim} onClick={onClose}>
      <div className={styles.tutPanel} onClick={(e) => e.stopPropagation()}>
        <Band
          title={current.title}
          note={
            <span style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <span>{current.note}</span>
              <button className={styles.btnSm} onClick={onClose} style={{ padding: '3px 10px' }}>
                CLOSE
              </button>
            </span>
          }
          goldTitle
        />

        <div className={styles.tutBody}>{current.body}</div>

        <div className={styles.tutFoot}>
          <button className={styles.btnSm} onClick={() => go(-1)} disabled={page === 0}>
            ← BACK
          </button>

          <div className={styles.tutDots}>
            {PAGES.map((p, i) => (
              <button
                key={p.key}
                className={styles.tutDot}
                data-on={i === page}
                onClick={() => setPage(i)}
                aria-label={p.title}
              />
            ))}
          </div>

          {last ? (
            <button className={styles.btn} data-ink="gold" onClick={onClose}>
              GOT IT
            </button>
          ) : (
            <button className={styles.btn} onClick={() => go(1)}>
              NEXT →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
