/**
 * The list of things that pay.
 *
 * Ten pitch types is the core skill of the game and the one thing the board
 * never showed: the tally names the type you *did* build, which teaches nothing
 * about the nine you did not. This is the reference, open from the tally at any
 * point in a show, printed straight out of PITCH_TYPES so it cannot drift from
 * what the engine actually detects.
 */

import { MAX_PITCH_CARDS, PITCH_TYPES } from '../game/constants';
import type { PitchTypeId } from '../game/types';
import { Band } from './kit';
import styles from './app.module.css';

export function PitchGuide({
  active,
  onClose,
}: {
  /** The type the current selection scored as, highlighted in the list. */
  active?: PitchTypeId | undefined;
  onClose: () => void;
}) {
  return (
    <div className={styles.scrim} onClick={onClose}>
      <div className={styles.guidePanel} onClick={(e) => e.stopPropagation()} data-tour="guide">
        <Band
          title="What pays"
          note={
            <button className={styles.btnSm} onClick={onClose} style={{ padding: '3px 10px' }}>
              CLOSE
            </button>
          }
          goldTitle
        />

        <p className={styles.guideLead}>
          Pitch 1 to {MAX_PITCH_CARDS} cards. The best type they qualify for is detected for you:
          Value is added to the pitch, Interest multiplies all of it.
        </p>

        <div className={styles.guideTable}>
          <div className={styles.guideHead}>
            <span>Pitch</span>
            <span>Needs</span>
            <span>Value</span>
            <span>Interest</span>
          </div>
          {PITCH_TYPES.map((type) => (
            <div
              key={type.id}
              className={styles.guideRow}
              data-active={type.id === active}
              data-tour={`guide:${type.id}`}
            >
              <span className={styles.guideName}>{type.label}</span>
              <span className={styles.guideNeeds}>{type.requires}</span>
              <span className={styles.guideNum}>+{type.value}</span>
              <span className={styles.guideNum}>x{type.interest}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
