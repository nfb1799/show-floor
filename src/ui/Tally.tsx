import { formatMoney } from '../game/cards/value';
import type { PitchResult } from '../game/types';
import { Band } from './kit';
import styles from './app.module.css';

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
  result: PitchResult | null;
  turnAwaysLeft: number;
  canPitch: boolean;
  canTurnAway: boolean;
  canDig: boolean;
  onPitch: () => void;
  onTurnAway: () => void;
  onDig: () => void;
}

export function Tally({
  result,
  turnAwaysLeft,
  canPitch,
  canTurnAway,
  canDig,
  onPitch,
  onTurnAway,
  onDig,
}: TallyProps) {
  if (!result) {
    return (
      <div className={styles.sheetFlat}>
        <Band title="The tally" note="PULL UP TO 5 CARDS" goldTitle />
        <div className={styles.tallyBody}>
          <div className={styles.tallyMath}>
            <div className={styles.tallyIdle}>
              Pick cards from the case and the best-paying pitch type is detected
              automatically — you see the offer before you commit.
            </div>
          </div>
          <div className={styles.tallyPay}>
            <div>
              <div className={styles.lbl}>They'll pay</div>
              <div className={styles.payAmount} style={{ color: 'var(--rule)' }}>
                —
              </div>
            </div>
            <div className={styles.payButtons}>
              <button className={styles.btn} disabled>
                SEND IT
              </button>
              <button className={styles.btnSm} onClick={onDig} disabled={!canDig}>
                DIG
              </button>
              <button className={styles.btnSm} onClick={onTurnAway} disabled={!canTurnAway}>
                PASS · {turnAwaysLeft}
              </button>
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
        title="The tally"
        note={
          <>
            DETECTED PITCH: <span style={{ color: 'var(--gold)' }}>{result.pitchTypeLabel}</span>
          </>
        }
        goldTitle
      />

      <div className={styles.tallyBody}>
        <div className={styles.tallyMath}>
          <div className={styles.mathRow}>
            <MathBox
              label={result.pitchValueCounted ? 'Pitch value' : 'Pitch value — ignored'}
              value={round(result.pitchValue)}
            />
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
            <div className={styles.mathRow}>
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
                  <span className={styles.cappedFlagTitle}>CAPPED AT THEIR BUDGET</span>
                  <span className={styles.cappedFlagNote}>
                    {formatMoney(result.uncappedOffer - result.budget)} left on the table
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
          </div>

          {result.offerLines.length > 0 && (
            <div className={styles.mathRow}>
              {result.offerLines.map((line, i) => (
                <span key={i} className={line.amount >= 0 ? styles.mathGain : styles.mathLoss}>
                  {line.amount >= 0 ? '+' : '−'}
                  {formatMoney(Math.abs(line.amount))} {line.label}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className={styles.tallyPay}>
          <div>
            <div className={styles.lbl}>They'll pay</div>
            <div className={styles.payAmount}>{formatMoney(result.offer)}</div>
          </div>
          <div className={styles.payButtons}>
            <button className={styles.btn} onClick={onPitch} disabled={!canPitch}>
              SEND IT
            </button>
            <button className={styles.btnSm} onClick={onDig} disabled={!canDig}>
              DIG
            </button>
            <button className={styles.btnSm} onClick={onTurnAway} disabled={!canTurnAway}>
              PASS · {turnAwaysLeft}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
