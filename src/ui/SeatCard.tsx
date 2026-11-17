/**
 * One buyer at the table.
 *
 * The card carries everything needed to decide whether to serve them: what
 * they want, what they refuse, the cash on them, how much longer they will
 * wait, and — once cards are picked — exactly what they would pay for them.
 * Three of these sit side by side, so the same selection reads as three prices.
 */

import { formatMoney } from '../game/cards/value';
import { getArchetype } from '../game/buyers/archetypes';
import { GOODWILL_COST_HOLD, HOLD_PATIENCE } from '../game/constants';
import { pitchTypeLabel } from '../game/pitch/pitchTypes';
import type { Seat } from '../game/show/showEngine';
import type { PitchResult, PitchTypeId } from '../game/types';
import { describeTurnoff, describeWant, explainWant, wantBonus, wantMark } from './wantText';
import styles from './table.module.css';

interface SeatCardProps {
  seat: Seat;
  /** What they would pay for the current selection; null with nothing picked. */
  quote: PitchResult | null;
  /** True when this is the highest quote at the table. */
  best: boolean;
  focused: boolean;
  canHold: boolean;
  onFocus: () => void;
  onSell: () => void;
  onHold: () => void;
}

export function SeatCard({
  seat,
  quote,
  best,
  focused,
  canHold,
  onFocus,
  onSell,
  onHold,
}: SeatCardProps) {
  const { buyer, patience } = seat;
  const def = getArchetype(buyer.archetype);
  const rivalMark = buyer.marks?.find((m) => m.startsWith('rival:'));
  const leaving = patience <= 1;
  const refused = quote?.interestMultLines.some((l) => l.source === 'turnoff') ?? false;

  return (
    <div
      className={styles.seat}
      data-focus={focused}
      data-best={best && quote !== null}
      data-leaving={leaving}
      data-tour={`seat:${buyer.id}`}
      onMouseEnter={onFocus}
    >
      <div className={styles.seatHead}>
        <span className={styles.seatKind}>{buyer.label}</span>
        <span
          className={styles.patience}
          data-tour={`patience:${buyer.id}`}
          title={
            leaving
              ? 'Sell to anyone else and they walk — and take a level of Buzz with them.'
              : `Will wait through ${patience} more sales to other people.`
          }
        >
          <span className={styles.patienceLabel}>{leaving ? 'LEAVING NEXT' : 'WAITS'}</span>
          <span className={styles.patiencePips}>
            {Array.from({ length: Math.max(1, patience) }, (_, i) => (
              <span key={i} className={styles.patiencePip} />
            ))}
          </span>
        </span>
      </div>

      <div className={styles.seatBody}>
        <div className={styles.seatTop}>
          <div className={styles.seatBlurb}>{def.blurb}</div>
          <div
            className={styles.seatBudget}
            data-tour={`budget:${buyer.id}`}
            title="The cash on them. Pitch past it and they make up only a little of the rest in trade."
          >
            <div className={styles.seatBudgetValue}>{formatMoney(buyer.budget)}</div>
            <div className={styles.seatBudgetLabel}>cash on them</div>
          </div>
        </div>

        <div className={styles.seatWants} data-tour={`wants:${buyer.id}`}>
          {buyer.wants.map((want, i) => {
            // Whether "Storm Cycle" is a set or a franchise decides which line
            // to read on every card in the box. The mark says which.
            const mark = wantMark(want);
            return (
              <span
                key={i}
                className={styles.chip}
                data-tone="good"
                title={explainWant(want) ?? describeWant(want)}
              >
                <span className={styles.chipText}>
                  {mark && <span title={mark.label}>{mark.mark} </span>}
                  {describeWant(want)}
                </span>
                <span className={styles.chipBonus}>{wantBonus(want)}</span>
              </span>
            );
          })}

          {buyer.turnoff && (
            <span className={styles.chip} data-tone="bad" data-tour={`refusal:${buyer.id}`}>
              <span className={styles.chipText}>{describeTurnoff(buyer.turnoff)}</span>
              <span className={styles.chipBonus}>NO</span>
            </span>
          )}
        </div>

        {buyer.chaseCard && (
          <div className={styles.seatNote}>
            Chasing <strong>{buyer.chaseCard}</strong> — with four more of its franchise, The
            Grail.
          </div>
        )}

        {rivalMark && (
          <div className={styles.seatNote}>
            Rival pitched a{' '}
            <strong>{pitchTypeLabel(rivalMark.slice('rival:'.length) as PitchTypeId, 5)}</strong>.
            Match it for +5 Interest.
          </div>
        )}
      </div>

      <div className={styles.seatFoot}>
        <div className={styles.quote} data-tour={`quote:${buyer.id}`}>
          {quote ? (
            <>
              <div className={styles.quoteAmount}>{formatMoney(quote.offer)}</div>
              <div className={styles.quoteTags}>
                <span>{quote.pitchTypeLabel}</span>
                {best && <span className={styles.tagBest}>BEST</span>}
                {quote.pleased && <span className={styles.tagGood}>BUZZ +1</span>}
                {refused && <span className={styles.tagBad}>REFUSED</span>}
              </div>
            </>
          ) : (
            <div className={styles.quoteAmount} data-idle="true">
              PICK CARDS FOR A PRICE
            </div>
          )}
        </div>

        <div className={styles.seatButtons}>
          <button
            className={styles.holdBtn}
            onClick={onHold}
            disabled={!canHold}
            data-tour={`hold:${buyer.id}`}
            title={`Ask them to hang on: +${HOLD_PATIENCE} sales of patience for ${GOODWILL_COST_HOLD} goodwill`}
          >
            HOLD · {GOODWILL_COST_HOLD}
          </button>
          <button
            className={styles.sellBtn}
            onClick={onSell}
            disabled={quote === null}
            data-tour={`sell:${buyer.id}`}
          >
            SELL
          </button>
        </div>
      </div>
    </div>
  );
}
