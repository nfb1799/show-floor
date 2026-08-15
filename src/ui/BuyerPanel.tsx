import { formatMoney } from '../game/cards/value';
import { getArchetype } from '../game/buyers/archetypes';
import { pitchTypeLabel } from '../game/pitch/pitchTypes';
import type { Buyer, PitchTypeId } from '../game/types';
import { Band, initialsOf } from './kit';
import { describeTurnoff, describeWant, explainWant, wantBonus } from './wantText';
import styles from './app.module.css';

export function BuyerPanel({
  buyer,
  position,
  total,
}: {
  buyer: Buyer;
  position: number;
  total: number;
}) {
  const def = getArchetype(buyer.archetype);
  const rivalMark = buyer.marks?.find((m) => m.startsWith('rival:'));

  return (
    <div className={styles.buyerCard}>
      <Band
        title={`Now serving · ${position} of ${total}`}
        note={def.label.toUpperCase()}
        ink="red"
      />

      <div className={styles.buyerBody}>
        <div className={styles.buyerIdent}>
          <div className={styles.buyerMark}>{initialsOf(buyer.label)}</div>
          <div style={{ flex: 1 }}>
            <div className={styles.buyerName}>{buyer.label}</div>
            <div className={styles.buyerBlurb}>{def.blurb}</div>
          </div>
        </div>

        <div className={styles.buyerFigures}>
          <div className={styles.figureBox}>
            <Band title="Pays up to" ink="blue" />
            <div className={styles.figureValue}>
              <span className={styles.num}>{formatMoney(buyer.budget)}</span>
              <span className={styles.figureHint}>hard cap</span>
            </div>
          </div>
        </div>

        <div className={styles.wants}>
          <div className={styles.benchLabel} style={{ marginBottom: 8 }}>
            WHAT WINS THEM
          </div>

          {buyer.wants.map((want, i) => (
            <span
              key={i}
              className={styles.wantChip}
              data-tone="good"
              // The long form is the only place some demands are explained at
              // all, so keep it reachable even where the note below is hidden.
              title={explainWant(want) ?? describeWant(want)}
            >
              <span className={styles.wantChipText}>{describeWant(want)}</span>
              <span className={styles.wantChipBonus}>{wantBonus(want)}</span>
            </span>
          ))}

          {buyer.wants.map((want, i) => {
            const detail = explainWant(want);
            return detail ? (
              <div key={`x${i}`} className={styles.wantNote}>
                {detail}
              </div>
            ) : null;
          })}

          {buyer.turnoff && (
            <span className={styles.wantChip} data-tone="bad">
              <span className={styles.wantChipText}>{describeTurnoff(buyer.turnoff)}</span>
              <span className={styles.wantChipBonus}>NO</span>
            </span>
          )}

          {buyer.chaseCard && (
            <div className={styles.wantNote}>
              Chasing <strong>{buyer.chaseCard}</strong> — bring it with four more of the same
              franchise for The Grail.
            </div>
          )}

          {rivalMark && (
            <div className={styles.wantNote}>
              The rival vendor pitched a{' '}
              <strong>{pitchTypeLabel(rivalMark.slice('rival:'.length) as PitchTypeId, 5)}</strong>.
              Match it for +5 Interest.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
