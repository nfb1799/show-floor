/**
 * Opening a pack.
 *
 * A pack used to drop straight into stock with no acknowledgement. Now the pull
 * is shown card by card and the player sorts it: keep what is worth carrying,
 * list the rest online for less than face value.
 */

import { useEffect, useState } from 'react';
import { formatMoney } from '../game/cards/value';
import { onlineValue } from '../game/shop/shop';
import { useRun } from '../state/runStore';
import { CardView } from './card/CardView';
import { Band } from './kit';
import styles from './app.module.css';

/** Cards flip in one at a time so a good pull lands. */
const REVEAL_STEP_MS = 190;

export function PackOverlay() {
  const pack = useRun((s) => s.pendingPack);
  const resolvePack = useRun((s) => s.resolvePack);

  const [kept, setKept] = useState<string[]>([]);
  const [revealed, setRevealed] = useState(0);

  const cards = pack?.cards ?? [];

  // Keep everything by default: the common case is "yes, I want these".
  useEffect(() => {
    setKept(cards.map((c) => c.id));
    setRevealed(0);
  }, [pack]);

  useEffect(() => {
    if (revealed >= cards.length) return;
    const timer = setTimeout(() => setRevealed((n) => n + 1), REVEAL_STEP_MS);
    return () => clearTimeout(timer);
  }, [revealed, cards.length]);

  if (!pack) return null;

  const listed = cards.filter((c) => !kept.includes(c.id));
  const payout = listed.reduce((sum, c) => sum + onlineValue(c), 0);
  const allShown = revealed >= cards.length;

  const toggle = (id: string): void =>
    setKept((k) => (k.includes(id) ? k.filter((x) => x !== id) : [...k, id]));

  return (
    <div className={styles.scrim}>
      <div className={styles.packPanel}>
        <Band
          title={`${pack.tierName} — ${cards.length} cards`}
          note={allShown ? 'CLICK A CARD TO LIST IT INSTEAD' : 'OPENING…'}
          ink="red"
        />

        <div className={styles.packGrid}>
          {cards.map((card, i) => {
            const shown = i < revealed;
            const keeping = kept.includes(card.id);
            return (
              <div
                key={card.id}
                className={styles.packSlot}
                data-shown={shown}
                data-listed={shown && !keeping}
              >
                <CardView
                  card={card}
                  size="small"
                  {...(shown ? { onClick: () => toggle(card.id) } : {})}
                />
                <span className={styles.packTag} data-listed={!keeping}>
                  {keeping ? 'KEEP' : `LIST ${formatMoney(onlineValue(card))}`}
                </span>
              </div>
            );
          })}
        </div>

        <div className={styles.packFoot}>
          <div className={styles.dim}>
            {listed.length === 0
              ? 'Keeping the whole pack.'
              : `Listing ${listed.length} card${listed.length === 1 ? '' : 's'} online for ${formatMoney(payout)}.`}
          </div>
          <div className={styles.rowWrap}>
            <button
              className={styles.btnSm}
              onClick={() => setKept([])}
              disabled={!allShown || listed.length === cards.length}
            >
              LIST ALL
            </button>
            <button
              className={styles.btnSm}
              onClick={() => setKept(cards.map((c) => c.id))}
              disabled={!allShown || listed.length === 0}
            >
              KEEP ALL
            </button>
            <button
              className={styles.btn}
              data-ink="gold"
              onClick={() => resolvePack(kept)}
              disabled={!allShown}
            >
              DONE
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
