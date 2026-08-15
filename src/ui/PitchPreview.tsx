import { formatMoney } from '../game/cards/value';
import type { PitchResult } from '../game/types';
import styles from './app.module.css';

function round(n: number, places = 1): string {
  return Number(n.toFixed(places)).toLocaleString('en-US');
}

interface PitchPreviewProps {
  result: PitchResult | null;
  haggling: boolean;
  canPitch: boolean;
  canTurnAway: boolean;
  turnAwaysLeft: number;
  onPitch: () => void;
  onAccept: () => void;
  onPush: () => void;
  onTurnAway: () => void;
}

export function PitchPreview({
  result,
  haggling,
  canPitch,
  canTurnAway,
  turnAwaysLeft,
  onPitch,
  onAccept,
  onPush,
  onTurnAway,
}: PitchPreviewProps) {
  if (!result) {
    return (
      <div className={styles.preview}>
        <div className={styles.previewMain}>
          <div className={styles.pitchTypeName}>Pick up to 5 cards</div>
          <div className={styles.formula}>
            The best-paying pitch type is detected automatically.
          </div>
        </div>
        <div className={styles.offerBox}>
          <div className={styles.buttons}>
            <button
              className={styles.btn}
              data-variant="danger"
              onClick={onTurnAway}
              disabled={!canTurnAway}
            >
              Turn away ({turnAwaysLeft})
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.preview}>
      <div className={styles.previewMain}>
        <div className={styles.pitchTypeName}>{result.pitchTypeLabel}</div>
        <div className={styles.formula}>
          ({round(result.pitchValue)} + {round(result.cardValue)}) x {round(result.interest, 2)}{' '}
          Interest = {round(result.appeal)} Appeal
        </div>

        <div className={styles.breakdown}>
          {result.valueLines.map((line, i) => (
            <div key={`v${i}`} className={styles.line}>
              <span>{line.label}</span>
              <span>+{round(line.amount)} value</span>
            </div>
          ))}
          {result.interestAddLines.map((line, i) => (
            <div key={`a${i}`} className={styles.line} data-tone="good">
              <span>{line.label}</span>
              <span>
                {line.amount >= 0 ? '+' : ''}
                {round(line.amount)} Interest
              </span>
            </div>
          ))}
          {result.interestMultLines.map((line, i) => (
            <div key={`m${i}`} className={styles.line} data-tone="bad">
              <span>{line.label}</span>
              <span>x{round(line.amount, 2)} Interest</span>
            </div>
          ))}
          {result.offerLines.map((line, i) => (
            <div key={`o${i}`} className={styles.line} data-tone="good">
              <span>{line.label}</span>
              <span>
                {line.amount >= 0 ? '+' : ''}
                {formatMoney(line.amount)}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className={styles.offerBox}>
        <div>
          <div className={styles.statLabel}>{haggling ? 'Their offer' : 'They would pay'}</div>
          <div className={styles.offerAmount}>{formatMoney(result.offer)}</div>
        </div>

        {result.cappedByBudget && (
          <div className={styles.cappedNote}>
            Capped by budget. Appeal was worth {formatMoney(result.uncappedOffer)}.
          </div>
        )}

        <div className={styles.buttons}>
          {haggling ? (
            <>
              <button className={styles.btn} data-variant="primary" onClick={onAccept}>
                Accept
              </button>
              <button className={styles.btn} onClick={onPush}>
                Push
              </button>
            </>
          ) : (
            <>
              <button
                className={styles.btn}
                data-variant="primary"
                onClick={onPitch}
                disabled={!canPitch}
              >
                Pitch
              </button>
              <button
                className={styles.btn}
                data-variant="danger"
                onClick={onTurnAway}
                disabled={!canTurnAway}
              >
                Turn away ({turnAwaysLeft})
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
