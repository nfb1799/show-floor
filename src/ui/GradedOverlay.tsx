/**
 * The card coming back from grading.
 *
 * Unlike a pack there is no decision here — the slab is already yours. This
 * exists so the roll lands: you see what you submitted, what it came back as,
 * and what that did to its value.
 */

import { useEffect, useState } from 'react';
import { cardValue, formatMoney } from '../game/cards/value';
import { useRun } from '../state/runStore';
import { CardView } from './card/CardView';
import { Band } from './kit';
import styles from './app.module.css';

const REVEAL_MS = 620;

export function GradedOverlay() {
  const graded = useRun((s) => s.lastGraded);
  const dismiss = useRun((s) => s.dismissGraded);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    if (!graded) return;
    setRevealed(false);
    const timer = setTimeout(() => setRevealed(true), REVEAL_MS);
    return () => clearTimeout(timer);
  }, [graded]);

  if (!graded) return null;

  const before = cardValue(graded.before);
  const after = cardValue(graded.after);
  const delta = after - before;
  const grade = graded.after.slabbed ? graded.after.grade : 0;

  return (
    <div className={styles.scrim} onClick={dismiss}>
      <div className={styles.gradePanel} onClick={(e) => e.stopPropagation()} data-tour="gradedPanel">
        <Band title="Back from grading" ink={revealed ? 'green' : 'ink'} />

        <div className={styles.gradeBody}>
          <div className={styles.gradeCards}>
            <div className={styles.gradeSide}>
              <div className={styles.lbl}>Submitted</div>
              <CardView card={graded.before} size="small" />
              <div className={styles.num} style={{ fontSize: 18 }}>
                {formatMoney(before)}
              </div>
            </div>

            <div className={styles.gradeArrow} data-revealed={revealed}>
              →
            </div>

            <div className={styles.gradeSide} data-revealed={revealed}>
              <div className={styles.lbl}>Came back</div>
              {revealed ? (
                <CardView card={graded.after} size="small" />
              ) : (
                <div className={styles.gradePending}>?</div>
              )}
              <div className={styles.num} style={{ fontSize: 18 }}>
                {revealed ? formatMoney(after) : '—'}
              </div>
            </div>
          </div>

          {revealed && (
            <div className={styles.gradeVerdict}>
              <span className={styles.gradeNumber}>GRADE {grade}</span>
              <span
                className={styles.gradeDelta}
                data-dir={delta >= 0 ? 'up' : 'down'}
              >
                {delta >= 0 ? '+' : '−'}
                {formatMoney(Math.abs(delta))}
              </span>
            </div>
          )}

          <p className={styles.dim} style={{ marginBottom: 0 }}>
            {revealed
              ? 'Slabs are worth more, but Set Builders and Kids refuse them outright.'
              : 'Waiting on the grader…'}
          </p>

          <button className={styles.btn} data-ink="gold" onClick={dismiss} disabled={!revealed}>
            BACK TO STOCK
          </button>
        </div>
      </div>
    </div>
  );
}
