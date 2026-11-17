import { useEffect, useRef, useState } from 'react';
import { formatMoney } from '../game/cards/value';
import { getArchetype } from '../game/buyers/archetypes';
import { BUZZ_MAX, GOODWILL_COST_DIG, MAX_PITCH_CARDS } from '../game/constants';
import { getConditions } from '../game/conditions/registry';
import { buzzMultiplier, canHold, remainingQueue } from '../game/show/showEngine';
import type { Buyer, PitchResult } from '../game/types';
import { useRun } from '../state/runStore';
import { DigOverlay } from './DigOverlay';
import { SeatCard } from './SeatCard';
import { Tally } from './Tally';
import { CardView } from './card/CardView';
import { Pips, Track } from './kit';
import { describeWant } from './wantText';
import styles from './app.module.css';
import table from './table.module.css';

/** True for a moment after `value` changes, so a figure can bump. */
function useChanged(value: number): boolean {
  const [changed, setChanged] = useState(false);
  const last = useRef(value);

  useEffect(() => {
    if (last.current === value) return;
    last.current = value;
    setChanged(true);
    const timer = setTimeout(() => setChanged(false), 750);
    return () => clearTimeout(timer);
  }, [value]);

  return changed;
}

/** The crowd around the table: five blocks, and what they are worth. */
function BuzzMeter({ buzz, step }: { buzz: number; step: number }) {
  const popped = useChanged(buzz);
  const mult = buzzMultiplier(buzz, step);

  return (
    <div
      className={table.buzz}
      title={`Buzz ${buzz} of ${BUZZ_MAX}. Every sale pays ×${mult.toFixed(1)}. Sell a buyer something they came for and it grows; let one walk and it drops.`}
    >
      <div className={table.buzzBlocks}>
        {Array.from({ length: BUZZ_MAX }, (_, i) => (
          <span
            key={i}
            className={table.buzzBlock}
            data-lit={i < buzz}
            data-hot={buzz >= BUZZ_MAX}
            style={{ height: `${46 + i * 13.5}%` }}
          />
        ))}
      </div>
      <span
        key={buzz}
        className={`${table.buzzMult} ${popped ? table.buzzPop : ''}`}
        data-on={buzz > 0}
      >
        ×{mult.toFixed(1)}
      </span>
    </div>
  );
}

/** Whoever has not stepped up yet. Faces hidden unless something reveals them. */
function Line({ queue, revealed }: { queue: readonly Buyer[]; revealed: boolean }) {
  return (
    <div className={table.line} data-tour="line">
      <div className={table.lineHead}>
        <span>IN LINE</span>
        <span>{queue.length}</span>
      </div>
      <div className={table.lineList}>
        {queue.length === 0 && <div className={table.lineNote}>Nobody else is coming.</div>}
        {queue.map((buyer) =>
          revealed ? (
            <div key={buyer.id} className={table.lineTile}>
              <div className={table.lineName}>
                <span>{buyer.label}</span>
                <span>{formatMoney(buyer.budget)}</span>
              </div>
              <div className={table.lineWant}>
                {buyer.wants.map((w) => describeWant(w)).join(' · ') ||
                  getArchetype(buyer.archetype).blurb}
              </div>
            </div>
          ) : (
            <div key={buyer.id} className={table.lineTile} data-hidden="true">
              ?
            </div>
          ),
        )}
      </div>
      {!revealed && queue.length > 0 && (
        <div className={table.lineNote}>A Price Guide Binder shows who is coming.</div>
      )}
    </div>
  );
}

export function ShowScreen() {
  const show = useRun((s) => s.show);
  const bankroll = useRun((s) => s.bankroll);
  const preview = useRun((s) => s.preview);
  const toggleCard = useRun((s) => s.toggleCard);
  const pitch = useRun((s) => s.pitch);
  const hold = useRun((s) => s.hold);
  const closeUp = useRun((s) => s.closeUp);

  const [digging, setDigging] = useState(false);
  /** The buyer whose working-out the tally shows. Null follows the best quote. */
  const [focusId, setFocusId] = useState<string | null>(null);

  const earnedBumped = useChanged(show?.earned ?? 0);

  if (!show || show.seats.length === 0) return null;

  // Everyone at the table prices the same cards, so the board asks all of them.
  const quotes = new Map<string, PitchResult>();
  for (const seat of show.seats) {
    const quote = preview(seat.buyer.id);
    if (quote) quotes.set(seat.buyer.id, quote);
  }

  let bestId: string | null = null;
  for (const [id, quote] of quotes) {
    if (bestId === null || quote.offer > (quotes.get(bestId)?.offer ?? -1)) bestId = id;
  }

  // A buyer who has left cannot stay in focus; fall back to the best price.
  const focusSeat =
    show.seats.find((s) => s.buyer.id === focusId) ??
    show.seats.find((s) => s.buyer.id === bestId) ??
    null;
  const focusBuyer = focusSeat?.buyer ?? null;
  const focusQuote = focusBuyer ? (quotes.get(focusBuyer.id) ?? null) : null;

  const sellTo = (buyerId: string): void => {
    setFocusId(null);
    pitch(buyerId);
  };

  const quotaPct = (show.earned / show.config.quota) * 100;
  const quotaMet = show.earned >= show.config.quota;
  const conditions = getConditions(show.config.conditionIds);
  const queue = remainingQueue(show);
  const latest = show.log[show.log.length - 1];

  return (
    <div className={styles.fixed}>
      {/* Top strip: identity, house rules, and the latest floor note --- */}
      <div className={styles.topBar}>
        <div className={styles.topBarTitle}>
          <span className={styles.screenNum}>
            {String(show.config.showIndex).padStart(2, '0')}
          </span>
          <span className={styles.screenTitle}>THE TABLE</span>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          {conditions.map((c) => (
            <span key={c.id} className={styles.conditionChip} title={c.text}>
              <strong>{c.name}</strong> — {c.text}
            </span>
          ))}
          {latest && <span className={styles.ticker}>{latest.text}</span>}
        </div>
      </div>

      <div className={styles.tableGrid}>
        {/* Box score ------------------------------------------------- */}
        <div className={styles.hud}>
          <div className={styles.hudGrow} data-tour="quota">
            <div className={styles.quotaHead}>
              <span className={styles.lbl}>Quota progress</span>
              <span className={styles.quotaFigure}>
                <span key={show.earned} className={earnedBumped ? styles.bump : undefined}>
                  {formatMoney(show.earned)}
                </span>
                <em> / {formatMoney(show.config.quota)}</em>
              </span>
            </div>
            <Track pct={quotaPct} met={quotaMet} />
          </div>
          <div className={styles.hudCell} data-tour="buzz">
            <div className={styles.lbl} style={{ marginBottom: 4 }}>
              Buzz
            </div>
            <BuzzMeter buzz={show.buzz} step={show.config.buzzStep} />
          </div>
          <div className={styles.hudCell}>
            <div className={styles.lbl}>Bankroll</div>
            <div className={styles.hudValue}>{formatMoney(bankroll)}</div>
          </div>
          <div className={styles.hudCell} data-tour="stock">
            <div className={styles.lbl}>In the box</div>
            <div className={styles.hudValue}>{show.inventory.length}</div>
          </div>
          {/* Goodwill belongs to the whole show, so it lives on the board
              rather than on any one buyer. */}
          <div className={styles.hudCell} data-tour="goodwill">
            <div className={styles.lbl} style={{ marginBottom: 6 }}>
              Goodwill
            </div>
            <Pips total={show.config.goodwill} filled={show.goodwill} />
          </div>
        </div>

        {/* The crowd -------------------------------------------------- */}
        <div
          className={table.crowdRow}
          style={{
            gridTemplateColumns: `repeat(${Math.max(show.config.seats, show.seats.length)}, minmax(0, 1fr)) minmax(120px, 170px)`,
          }}
          data-tour="crowd"
        >
          {show.seats.map((seat) => (
            <SeatCard
              key={seat.buyer.id}
              seat={seat}
              quote={quotes.get(seat.buyer.id) ?? null}
              best={seat.buyer.id === bestId && quotes.size > 1}
              focused={focusBuyer?.id === seat.buyer.id && quotes.size > 0}
              canHold={canHold(show, seat.buyer.id)}
              onFocus={() => setFocusId(seat.buyer.id)}
              onSell={() => sellTo(seat.buyer.id)}
              onHold={() => hold(seat.buyer.id)}
            />
          ))}
          {/* Empty places keep the columns where they were as the line runs out. */}
          {Array.from({ length: Math.max(0, show.config.seats - show.seats.length) }, (_, i) => (
            <div key={`empty-${i}`} />
          ))}
          <Line queue={queue} revealed={show.config.revealNextBuyer} />
        </div>

        {/* The case --------------------------------------------------- */}
        <div
          className={`${styles.caseRow} ${table.caseFit}`}
          style={{ ['--case-n' as string]: Math.max(1, show.displayCase.length) }}
          data-tour="case"
        >
          {show.displayCase.length === 0 ? (
            <div className={styles.caseEmpty}>The case is empty. Nothing left to sell.</div>
          ) : (
            show.displayCase.map((card) => {
              const index = show.selection.indexOf(card.id);
              const selected = index >= 0;
              const locked = show.lockedCardIds.includes(card.id);
              return (
                <div
                  key={card.id}
                  className={`${styles.caseSlot} ${table.caseFitSlot}`}
                  data-tour={`card:${card.id}`}
                >
                  <CardView
                    card={card}
                    fill
                    selected={selected}
                    {...(selected ? { selectIndex: index + 1 } : {})}
                    locked={locked}
                    disabled={locked || (!selected && show.selection.length >= MAX_PITCH_CARDS)}
                    onClick={() => toggleCard(card.id)}
                  />
                </div>
              );
            })
          )}
        </div>

        {/* The tally -------------------------------------------------- */}
        <Tally
          buyer={focusBuyer}
          result={focusQuote}
          canDig={
            show.goodwill >= GOODWILL_COST_DIG &&
            show.inventory.length > 0 &&
            show.displayCase.length > 0
          }
          canCloseUp={quotaMet}
          onSell={() => focusBuyer && sellTo(focusBuyer.id)}
          onDig={() => setDigging(true)}
          onCloseUp={closeUp}
        />
      </div>

      {digging && <DigOverlay onClose={() => setDigging(false)} />}
    </div>
  );
}
