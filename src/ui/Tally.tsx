import { useState } from 'react';
import { formatMoney } from '../game/cards/value';
import { GOODWILL_COST_DIG } from '../game/constants';
import type { Buyer, PitchResult } from '../game/types';
import { Band } from './kit';
import { PitchGuide } from './PitchGuide';
import styles from './app.module.css';
import table from './table.module.css';

function round(n: number, places = 0): string {
  return Number(n.toFixed(places)).toLocaleString('en-US');
}

function MathBox({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className={styles.mathBox}>
      <div className={styles.mathBoxLabel}>{label}</div>
      <div className={styles.mathBoxValue}>{value}</div>
    </div>
  );
}

interface TallyProps {
  /** Whose price this is: the buyer being looked at, or the best one. */
  buyer: Buyer | null;
  result: PitchResult | null;
  canDig: boolean;
  /** Offered once the quota is covered: go home with what is left. */
  canCloseUp: boolean;
  onSell: () => void;
  onDig: () => void;
  onCloseUp: () => void;
}

/**
 * The working-out for one buyer's price. Every buyer at the table quotes the
 * same cards differently, so this shows whichever one the player is looking at
 * and says whose it is.
 */
export function Tally({
  buyer,
  result,
  canDig,
  canCloseUp,
  onSell,
  onDig,
  onCloseUp,
}: TallyProps) {
  const [guide, setGuide] = useState(false);

  /** Always in the same place, whether or not a pitch is on the table. */
  const guideButton = (
    <button
      className={styles.guideBtn}
      onClick={() => setGuide(true)}
      data-tour="guideBtn"
      title="Every combination that pays"
    >
      WHAT PAYS?
    </button>
  );

  const digButton = (
    <button
      className={styles.btnSm}
      onClick={onDig}
      disabled={!canDig}
      data-tour="dig"
      title={`Swap a card on the table for one from your box — costs ${GOODWILL_COST_DIG} goodwill, and nobody loses patience`}
    >
      DIG · {GOODWILL_COST_DIG}
    </button>
  );

  const closeButton = canCloseUp ? (
    <button
      className={styles.btnSm}
      onClick={onCloseUp}
      data-tour="closeUp"
      title="The quota is covered. Pack up now and keep everything unsold for the next show."
    >
      PACK UP
    </button>
  ) : null;

  if (!result || !buyer) {
    return (
      <div className={styles.sheetFlat}>
        <Band
          title="The tally"
          note={
            <span className={styles.bandNoteRow}>
              <span>PULL UP TO 5 CARDS</span>
              {guideButton}
            </span>
          }
          goldTitle
        />
        {guide && <PitchGuide onClose={() => setGuide(false)} />}
        <div className={styles.tallyBody}>
          <div className={styles.tallyMath}>
            <div className={styles.tallyIdle}>
              Pick cards from the case and everyone at the table names a price for them. Sell
              to whoever you like — the rest wait, and not forever.
            </div>
          </div>
          <div className={styles.tallyPay}>
            <div data-tour="pay">
              <div className={table.payWho}>Nobody is quoting yet</div>
              <div className={styles.payAmount} style={{ color: 'var(--rule)' }}>
                —
              </div>
            </div>
            {/* Same anchors as the scored branch: an empty selection is a
                perfectly normal state to be taught in — it is where you stand
                when a buyer wants something the case does not hold. */}
            <div className={styles.payButtons}>
              <button className={styles.btn} disabled data-tour="send">
                SELL
              </button>
              {digButton}
              {closeButton}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Interest bonuses are listed on the Interest box; multipliers get their own
  // chips so a x0.25 refusal never hides inside a single number.
  const adds = result.interestAddLines;
  const mults = result.interestMultLines;

  return (
    <div className={styles.sheetFlat}>
      <Band
        title={`The tally · ${buyer.label}`}
        note={
          <span className={styles.bandNoteRow}>
            <span>
              DETECTED PITCH: <span style={{ color: 'var(--gold)' }}>{result.pitchTypeLabel}</span>
            </span>
            {guideButton}
          </span>
        }
        goldTitle
      />

      {guide && <PitchGuide active={result.pitchType} onClose={() => setGuide(false)} />}

      <div className={styles.tallyBody}>
        <div className={styles.tallyMath} data-tour="math">
          <div className={styles.mathRow}>
            <MathBox label="Pitch value" value={round(result.pitchValue)} />
            <span className={styles.mathOp}>+</span>
            <MathBox label="Card $" value={round(result.cardValue)} />
            <span className={styles.mathOp}>×</span>
            <MathBox
              label="Interest"
              value={
                <>
                  ×{round(result.interest, 2)}
                  {/* Only worth breaking out when something actually added to it. */}
                  {adds.length > 0 && (
                    <span className={styles.mathGain}>
                      {' '}
                      ({round(result.baseInterest)}
                      {adds
                        .map(
                          (l) =>
                            ` ${l.amount >= 0 ? '+' : '−'}${round(Math.abs(l.amount))} ${l.label}`,
                        )
                        .join('')}
                      )
                    </span>
                  )}
                </>
              }
            />
            <span className={styles.mathOp}>=</span>
            <div className={`${styles.mathBox} ${styles.mathAppeal}`}>
              <div className={styles.mathBoxLabel}>Appeal</div>
              <div className={styles.mathBoxValue}>{round(result.appeal)}</div>
            </div>
          </div>

          {mults.length > 0 && (
            <div className={styles.mathRow} data-tour="mult">
              {mults.map((line, i) => (
                <span key={i} className={styles.mathLoss}>
                  ×{round(line.amount, 2)} {line.label}
                </span>
              ))}
            </div>
          )}

          <div className={styles.mathRow}>
            <span style={{ fontSize: 13, color: 'var(--muted-2)' }}>
              Appeal × {result.offerRatio.toFixed(2)} offer ratio =
            </span>
            {result.cappedByBudget ? (
              <>
                <span className={styles.struck}>{formatMoney(result.uncappedOffer)}</span>
                <span className={styles.cappedFlag}>
                  <span className={styles.cappedFlagTitle}>PART TRADE</span>
                  {/* Their cash is a real cap. What it will not cover they make
                      up out of their own binder and you sell on, which is why
                      the total lands above their budget. */}
                  <span className={styles.cappedFlagNote}>
                    {formatMoney(result.budget)} cash, plus cards off them worth{' '}
                    {formatMoney(Math.max(0, result.baseOffer - result.budget))} to you
                  </span>
                </span>
              </>
            ) : (
              <span
                style={{
                  fontFamily: "'Barlow Semi Condensed', sans-serif",
                  fontWeight: 800,
                  fontSize: 17,
                }}
              >
                {formatMoney(result.uncappedOffer)}
              </span>
            )}

            {result.offerLines.map((line, i) => (
              <span key={i} className={line.amount >= 0 ? styles.mathGain : styles.mathLoss}>
                {line.amount >= 0 ? '+' : '−'}
                {formatMoney(Math.abs(line.amount))} {line.label}
              </span>
            ))}

            {/* The crowd pays on top of the buyer, so it is the last thing
                applied and the only one that ignores their wallet. */}
            {result.buzzMult > 1 && (
              <span className={table.buzzChip} data-tour="buzzChip">
                <strong>×{round(result.buzzMult, 2)}</strong> BUZZ
              </span>
            )}
          </div>
        </div>

        <div className={styles.tallyPay}>
          <div data-tour="pay">
            <div className={table.payWho}>{buyer.label} pays</div>
            <div className={styles.payAmount}>{formatMoney(result.offer)}</div>
          </div>
          <div className={styles.payButtons}>
            <button className={styles.btn} onClick={onSell} data-tour="send">
              SELL
            </button>
            {digButton}
            {closeButton}
          </div>
        </div>
      </div>
    </div>
  );
}
