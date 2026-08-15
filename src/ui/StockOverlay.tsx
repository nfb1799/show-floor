/**
 * Your stock. Click a card to act on it.
 *
 * The tool-first version put a toolbar on top and made you pick a mode before
 * picking a card, which meant the card you were deciding about was the thing
 * you could not see properly. This is card-first: choose the card, then see
 * every option priced against it.
 */

import { useState } from 'react';
import { cardValue, formatMoney } from '../game/cards/value';
import { SUPPLIES } from '../game/constants';
import { gradingFee, gradingOutcomeRange } from '../game/shop/grading';
import { onlineValue } from '../game/shop/shop';
import { useRun } from '../state/runStore';
import { CardView } from './card/CardView';
import { Band } from './kit';
import type { Card } from '../game/types';
import styles from './app.module.css';

const SLEEVE = SUPPLIES.find((s) => s.id === 'sleeve')!;
const TOPLOADER = SUPPLIES.find((s) => s.id === 'toploader')!;

function CardActions({ card, onDone }: { card: Card; onDone: () => void }) {
  const spendable = useRun((s) => s.spendable());
  const submitForGrading = useRun((s) => s.submitForGrading);
  const applySupply = useRun((s) => s.applySupply);
  const sellOnline = useRun((s) => s.sellOnline);

  const raw = !card.slabbed;
  const fee = raw ? gradingFee(card) : 0;
  const range = raw ? gradingOutcomeRange(card) : null;

  const act = (fn: () => void): void => {
    fn();
    onDone();
  };

  return (
    <div className={styles.cardDetail}>
      <div className={styles.cardDetailArt}>
        <CardView card={card} />
      </div>

      <div className={styles.cardDetailActions}>
        <div>
          <div className={styles.lbl}>Face value</div>
          <div className={styles.num} style={{ fontSize: 30 }}>
            {formatMoney(cardValue(card))}
          </div>
        </div>

        {raw ? (
          <button
            className={styles.btnSm}
            disabled={spendable < fee}
            onClick={() => act(() => submitForGrading(card.id))}
          >
            GRADE · {formatMoney(fee)}
            {range && (
              <span className={styles.actionHint}>
                {range.low === range.high
                  ? ` → ${formatMoney(range.low)}`
                  : ` → ${formatMoney(range.low)}–${formatMoney(range.high)}`}
              </span>
            )}
          </button>
        ) : (
          <div className={styles.dim}>Already slabbed — grading is done.</div>
        )}

        {raw && (
          <>
            <button
              className={styles.btnSm}
              disabled={spendable < SLEEVE.cost}
              onClick={() => act(() => applySupply('sleeve', card.id))}
            >
              {SLEEVE.name.toUpperCase()} · {formatMoney(SLEEVE.cost)}
              <span className={styles.actionHint}> up one condition step</span>
            </button>
            <button
              className={styles.btnSm}
              disabled={spendable < TOPLOADER.cost || card.toploaded === true}
              onClick={() => act(() => applySupply('toploader', card.id))}
            >
              {card.toploaded ? 'TOPLOADED' : `${TOPLOADER.name.toUpperCase()} · ${formatMoney(TOPLOADER.cost)}`}
              {!card.toploaded && <span className={styles.actionHint}> survives one knock</span>}
            </button>
          </>
        )}

        <button className={styles.btnSm} onClick={() => act(() => sellOnline(card.id))}>
          SELL ONLINE · +{formatMoney(onlineValue(card))}
        </button>

        <button className={styles.btn} data-ink="paper" onClick={onDone}>
          BACK
        </button>
      </div>
    </div>
  );
}

export function StockOverlay({ onClose }: { onClose: () => void }) {
  const inventory = useRun((s) => s.inventory);
  const spendable = useRun((s) => s.spendable());
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const sorted = [...inventory].sort((a, b) => cardValue(b) - cardValue(a));
  const totalValue = inventory.reduce((sum, c) => sum + cardValue(c), 0);
  const selected = inventory.find((c) => c.id === selectedId) ?? null;

  return (
    <div className={styles.scrim} onClick={onClose}>
      <div className={styles.stockPanel} onClick={(e) => e.stopPropagation()}>
        <Band
          title={`Your stock · ${inventory.length} cards · ${formatMoney(totalValue)} on paper`}
          note={
            <span style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <span>{formatMoney(spendable)} SPENDABLE</span>
              <button className={styles.btnSm} onClick={onClose} style={{ padding: '3px 10px' }}>
                CLOSE
              </button>
            </span>
          }
          goldTitle
        />

        {selected ? (
          <CardActions card={selected} onDone={() => setSelectedId(null)} />
        ) : (
          <div className={styles.stockGrid}>
            {inventory.length === 0 && (
              <p className={styles.dim}>Nothing in stock. Buy singles or a pack.</p>
            )}
            {sorted.map((card) => (
              <CardView
                key={card.id}
                card={card}
                size="small"
                onClick={() => setSelectedId(card.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
