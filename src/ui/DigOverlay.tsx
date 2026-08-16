/**
 * Digging through the box mid-show.
 *
 * The point is to fetch the card *this* buyer wants, so it deliberately does
 * not dismiss them — it spends the crowd's goodwill instead. They are standing
 * there while you rummage.
 */

import { useMemo, useState } from 'react';
import { cardValue } from '../game/cards/value';
import { GOODWILL_COST_DIG } from '../game/constants';
import { useRun } from '../state/runStore';
import { CardView } from './card/CardView';
import { Band } from './kit';
import styles from './app.module.css';

export function DigOverlay({ onClose }: { onClose: () => void }) {
  const show = useRun((s) => s.show);
  const dig = useRun((s) => s.dig);
  const [outId, setOutId] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  const stock = show?.inventory ?? [];
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    const pool = q
      ? stock.filter((c) => c.subject.toLowerCase().includes(q))
      : [...stock];
    return pool.sort((a, b) => cardValue(b) - cardValue(a)).slice(0, 60);
  }, [stock, query]);

  if (!show) return null;

  const sendable = show.displayCase.filter((c) => !show.lockedCardIds.includes(c.id));
  const affordable = show.goodwill >= GOODWILL_COST_DIG;

  return (
    <div className={styles.scrim} onClick={onClose}>
      <div className={styles.digPanel} onClick={(e) => e.stopPropagation()} data-tour="digPanel">
        {/* Which card is going back is local state, so this is how the tutorial
            sees step one of the swap happen. */}
        {outId !== null && <span data-tour="digPicked" hidden />}
        <Band
          title="Dig through the box"
          note={
            <span style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <span>
                COSTS {GOODWILL_COST_DIG} GOODWILL · {show.goodwill} LEFT
              </span>
              <button className={styles.btnSm} onClick={onClose} style={{ padding: '3px 10px' }}>
                CLOSE
              </button>
            </span>
          }
          ink="gold"
        />

        {!affordable ? (
          <div className={styles.digEmpty}>
            No goodwill left. The crowd will not wait while you rummage.
          </div>
        ) : (
          <div className={styles.digCols}>
            <div className={styles.digSide} data-tour="digOutCol">
              <div className={styles.lbl}>1 · Card to put back</div>
              <div className={styles.digGrid}>
                {sendable.map((card) => (
                  <div key={card.id} data-tour={`digOut:${card.id}`}>
                    <CardView
                      card={card}
                      size="small"
                      selected={outId === card.id}
                      onClick={() => setOutId(outId === card.id ? null : card.id)}
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className={styles.digSide} data-tour="digInCol">
              <div className={styles.digHead}>
                <span className={styles.lbl}>2 · Card to bring out</span>
                <input
                  className={styles.digSearch}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="search by name"
                  aria-label="Search your stock"
                />
              </div>

              {stock.length === 0 ? (
                <p className={styles.dim}>The box is empty — everything is already on the table.</p>
              ) : (
                <div className={styles.digGrid}>
                  {matches.map((card) => (
                    <div key={card.id} data-tour={`digIn:${card.id}`}>
                      <CardView
                        card={card}
                        size="small"
                        disabled={outId === null}
                        {...(outId !== null
                          ? {
                              onClick: () => {
                                dig(outId, card.id);
                                onClose();
                              },
                            }
                          : {})}
                      />
                    </div>
                  ))}
                  {matches.length === 0 && (
                    <p className={styles.dim}>Nothing in the box matches “{query}”.</p>
                  )}
                </div>
              )}
              {outId === null && (
                <p className={styles.dim} style={{ marginBottom: 0 }}>
                  Pick a card to put back first — it is a swap, not a draw.
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
