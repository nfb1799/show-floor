import { formatMoney } from '../game/cards/value';
import { getArchetype } from '../game/buyers/archetypes';
import { BUYER_GOODWILL_MAX } from '../game/constants';
import type { Buyer } from '../game/types';
import { describeTurnoff, describeWant } from './wantText';
import styles from './app.module.css';

/** Ink used for the queue card's summary tag. */
function tagFor(buyer: Buyer): { text: string; color: string } {
  if (buyer.turnoff) {
    return {
      text: buyer.turnoff.kind === 'anyRaw' ? 'REFUSES RAW' : 'REFUSES SLABS',
      color: 'var(--red)',
    };
  }
  const want = buyer.wants[0];
  if (want && want.kind === 'valueOnly') {
    return { text: 'IGNORES PITCH TYPE', color: 'var(--gold-dk)' };
  }
  if (want && 'interestPerCard' in want) {
    return { text: `+${want.interestPerCard} INTEREST EACH`, color: 'var(--green)' };
  }
  return { text: 'NO STRONG WANTS', color: 'var(--muted)' };
}

export function BuyerQueue({
  queue,
  startIndex,
  revealed,
}: {
  queue: readonly Buyer[];
  /** 1-based position of the first queued buyer. */
  startIndex: number;
  revealed: boolean;
}) {
  return (
    <div className={styles.queueCol}>
      <div className={styles.queueHead}>
        <span className={styles.queueHeadTitle}>IN LINE</span>
        {/* The old copy named an upgrade the player may never have seen and did
            not say what reading the line would get them. */}
        <span className={styles.queueHeadNote}>
          {revealed
            ? 'BUDGETS AND WANTS REVEALED · PRICE GUIDE BINDER'
            : 'HIDDEN — THE PRICE GUIDE REVEALS THEIR BUDGETS AND WANTS'}
        </span>
      </div>

      <div className={styles.queueList} data-revealed={revealed}>
        {queue.length === 0 && (
          <div className={styles.queueCard}>
            <div className={styles.queueHidden} style={{ fontSize: 15 }}>
              LAST ONE
            </div>
          </div>
        )}

        {queue.map((buyer, i) => {
          const def = getArchetype(buyer.archetype);
          const tag = tagFor(buyer);
          return (
            <div key={buyer.id} className={styles.queueCard}>
              <div className={styles.queueCardHead}>
                <span className={styles.queueNum}>#{startIndex + i}</span>
                <div className={styles.queuePips}>
                  {Array.from({ length: BUYER_GOODWILL_MAX }, (_, p) => (
                    <span
                      key={p}
                      className={styles.queuePip}
                      style={{
                        background:
                          revealed && p < buyer.goodwill ? 'var(--gold)' : 'var(--rule)',
                      }}
                    />
                  ))}
                </div>
              </div>

              {revealed ? (
                <>
                  <div className={styles.queueBody}>
                    <div className={styles.queueName}>{buyer.label}</div>
                    <div className={styles.queueKind}>{def.blurb}</div>
                    <div className={styles.queueCap}>up to {formatMoney(buyer.budget)}</div>
                  </div>
                  <div className={styles.queueFoot}>
                    <div className={styles.queueWants}>
                      {buyer.wants.map((w) => describeWant(w)).join(' · ')}
                      {buyer.turnoff && ` · ${describeTurnoff(buyer.turnoff)}`}
                    </div>
                    <div className={styles.queueTag} style={{ color: tag.color }}>
                      {tag.text}
                    </div>
                  </div>
                </>
              ) : (
                <div className={styles.queueHidden}>?</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
