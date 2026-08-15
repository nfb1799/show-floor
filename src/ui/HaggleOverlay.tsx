/**
 * The haggle, as an overlay the player can put down.
 *
 * It sits over the table rather than replacing it, and collapses to a bar so
 * the case, the queue and the quota stay readable while deciding.
 */

import { useState } from 'react';
import { formatMoney } from '../game/cards/value';
import { BUYER_GOODWILL_MAX, HAGGLE_BUDGET_PENALTY } from '../game/constants';
import { previewPush } from '../game/show/showEngine';
import { useRun } from '../state/runStore';
import { CardView } from './card/CardView';
import { Band, initialsOf, Pips } from './kit';
import styles from './app.module.css';

export function HaggleOverlay() {
  const show = useRun((s) => s.show);
  const accept = useRun((s) => s.accept);
  const push = useRun((s) => s.push);
  const projected = useRun((s) => (s.show ? previewPush(s.show, s.showDeps()) : null));
  const [hidden, setHidden] = useState(false);

  if (!show || !show.buyer || !show.pending) return null;

  const { buyer, pending } = show;
  const cards = show.displayCase.filter((c) => show.selection.includes(c.id));
  const outOfGoodwill = buyer.goodwill <= 0;
  const delta = projected === null ? 0 : projected - pending.offer;

  if (hidden) {
    return (
      <div className={styles.haggleTab} onClick={() => setHidden(false)} role="button" tabIndex={0}>
        <span className={styles.lbl}>{buyer.label} offers</span>
        <span className={styles.haggleTabAmount}>{formatMoney(pending.offer)}</span>
        <span className={styles.lbl} style={{ color: 'var(--ink)' }}>
          click to settle up ↑
        </span>
      </div>
    );
  }

  return (
    <div className={styles.scrim}>
      <div className={styles.hagglePanel}>
        <Band
          title={`Haggling · ${buyer.label}`}
          note={
            <button
              className={styles.btnSm}
              onClick={() => setHidden(true)}
              style={{ padding: '3px 10px' }}
            >
              CHECK THE BOARD ↓
            </button>
          }
          ink="red"
        />

        <div className={styles.haggleInner}>
          {/* What is on the table ------------------------------------- */}
          <div className={styles.hagglePitch}>
            <div className={styles.lbl}>
              Your pitch · {pending.pitchTypeLabel} · {cards.length} card
              {cards.length === 1 ? '' : 's'}
            </div>

            <div className={styles.haggleCards}>
              {cards.map((card) => (
                <div key={card.id} className={styles.haggleCardSlot}>
                  <CardView card={card} size="small" />
                </div>
              ))}
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                marginTop: 14,
                flexWrap: 'wrap',
              }}
            >
              <div className={styles.buyerMark} style={{ width: 42, height: 42, fontSize: 14 }}>
                {initialsOf(buyer.label)}
              </div>
              <div>
                <div className={styles.lbl}>Goodwill left</div>
                <Pips
                  total={Math.max(BUYER_GOODWILL_MAX, buyer.goodwill)}
                  filled={buyer.goodwill}
                  large
                />
              </div>
              <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                <div className={styles.lbl}>Their wallet</div>
                <div className={styles.num} style={{ fontSize: 20 }}>
                  {formatMoney(buyer.budget)}
                </div>
              </div>
            </div>
          </div>

          {/* The deal -------------------------------------------------- */}
          <div className={styles.haggleDeal}>
            <div>
              <div className={styles.lbl}>{buyer.label} slides you</div>
              <div className={styles.dealAmount}>{formatMoney(pending.offer)}</div>
              <div style={{ fontSize: 13, color: 'var(--muted-2)', marginTop: 4 }}>
                {pending.cappedByBudget
                  ? "That is their whole wallet — appeal above it is wasted."
                  : 'Below their ceiling; there is room to lean.'}
              </div>
            </div>

            <div className={styles.dealActions}>
              <button className={styles.btn} data-ink="gold" onClick={accept}>
                TAKE {formatMoney(pending.offer)}
              </button>

              <button className={styles.btn} data-ink="paper" onClick={push} disabled={false}>
                {outOfGoodwill ? 'PUSH — THEY WALK' : 'PUSH'}
              </button>

              <div className={styles.pushRow}>
                {outOfGoodwill ? (
                  <span style={{ color: 'var(--red)' }}>
                    No goodwill left. Pushing loses the buyer and the slot.
                  </span>
                ) : (
                  <>
                    <span style={{ color: 'var(--muted-2)' }}>
                      Push costs a goodwill pip and {Math.round((1 - HAGGLE_BUDGET_PENALTY) * 100)}%
                      of their wallet
                    </span>
                    {projected !== null && (
                      <span className={styles.pushDelta} data-dir={delta >= 0 ? 'up' : 'down'}>
                        → {formatMoney(projected)}
                      </span>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
