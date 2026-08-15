/**
 * What the supplies are for.
 *
 * Every supply used to be a button with a price and one line of rules text,
 * which answered "what does it do" but never "why would I buy this". The `why`
 * copy lives with the definitions in constants.ts.
 */

import { formatMoney } from '../game/cards/value';
import { SUPPLIES } from '../game/constants';
import { Band } from './kit';
import styles from './app.module.css';

export function SuppliesOverlay({ onClose }: { onClose: () => void }) {
  return (
    <div className={styles.scrim} onClick={onClose}>
      <div className={styles.helpPanel} onClick={(e) => e.stopPropagation()}>
        <Band
          title="Supplies — what they are for"
          note={
            <button className={styles.btnSm} onClick={onClose} style={{ padding: '3px 10px' }}>
              CLOSE
            </button>
          }
          goldTitle
        />

        <div className={styles.helpBody}>
          {SUPPLIES.map((supply) => (
            <div key={supply.id} className={styles.helpItem}>
              <div className={styles.helpHead}>
                <span className={styles.helpName}>{supply.name}</span>
                <span className={styles.num} style={{ fontSize: 18 }}>
                  {formatMoney(supply.cost)}
                </span>
              </div>
              <div className={styles.helpRule}>{supply.text}</div>
              <p className={styles.helpWhy}>{supply.why}</p>
            </div>
          ))}

          <p className={styles.dim}>
            Sleeves and toploaders are applied to a specific card — open your stock to use them.
          </p>
        </div>
      </div>
    </div>
  );
}
