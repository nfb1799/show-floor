/**
 * Card layout and data display. Deliberately knows nothing about how a card
 * looks — the art arrives as children and fills the art slot.
 *
 * The face is ordered by how much each attribute drives a decision, not by how
 * much it identifies the card. Price is the hero; then rarity, franchise, set
 * and year, each of which some pitch type or buyer want keys on. The subject
 * name matters for only three things (Playset, Personal Collector, The Grail),
 * so it sits on the art rather than dominating the card.
 */

import type { CSSProperties, ReactNode } from 'react';
import { cardValue, formatMoney } from '../../game/cards/value';
import { getFranchise, getSet } from '../../game/cards/catalog';
import { VINTAGE_YEAR_CUTOFF } from '../../game/constants';
import type { Card } from '../../game/types';
import { cardArtSpec, CONDITION_LABEL, GRADER_MARK } from './artSpec';
import styles from './card.module.css';

export type CardSize = 'normal' | 'small' | 'tiny';

export interface CardFrameProps {
  card: Card;
  children: ReactNode;
  selected?: boolean;
  /** 1-based position in the pitch, shown in the selection badge. */
  selectIndex?: number;
  disabled?: boolean;
  /** Held in the case by an upgrade and not available to pitch. */
  locked?: boolean;
  faded?: boolean;
  size?: CardSize;
  /** Stretch to the container's height instead of sizing from the art block. */
  fill?: boolean;
  showPrice?: boolean;
  onClick?: (card: Card) => void;
}

/**
 * The franchise is printed directly above the set, so repeating it in the set
 * name is wasted width: "Diamond League / Diamond League '76" becomes
 * "Diamond League / '76".
 */
function setDisplayName(setName: string, franchiseName: string): string {
  return setName.startsWith(`${franchiseName} `)
    ? setName.slice(franchiseName.length + 1)
    : setName;
}

export function CardFrame({
  card,
  children,
  selected = false,
  selectIndex,
  disabled = false,
  locked = false,
  faded = false,
  size = 'normal',
  fill = false,
  showPrice = true,
  onClick,
}: CardFrameProps) {
  const set = getSet(card.setId);
  const franchise = getFranchise(card.franchise);
  const spec = cardArtSpec(card);
  const interactive = onClick !== undefined && !disabled;
  const vintage = set.year <= VINTAGE_YEAR_CUTOFF;

  const style = { '--rarity-ink': spec.rarityInk } as CSSProperties;

  return (
    <div
      className={styles.card}
      style={style}
      data-selected={selected}
      data-disabled={disabled}
      data-locked={locked}
      data-faded={faded}
      data-fill={fill}
      data-size={size}
      onClick={() => interactive && onClick(card)}
      role={onClick ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      onKeyDown={(e) => {
        if (!interactive) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick(card);
        }
      }}
    >
      <div className={styles.artSlot}>
        {children}
        <span className={styles.stamp} data-slab={card.slabbed}>
          {card.slabbed ? `${GRADER_MARK} ${card.grade}` : CONDITION_LABEL[card.condition]}
        </span>
      </div>

      {size !== 'tiny' && (
        <div className={styles.data}>
          {/* Price leads: it is the number every pitch is ultimately judged on. */}
          <div className={styles.priceRow}>
            {showPrice && <span className={styles.price}>{formatMoney(cardValue(card))}</span>}
            <span className={styles.rarityTag}>{spec.rarityLabel}</span>
          </div>

          {/* Franchise drives Full Case, Graded Run and The Grail. */}
          <div className={styles.attrRow}>
            <span className={styles.franchise}>{franchise.name}</span>
            <span className={styles.year} data-vintage={vintage}>
              {set.year}
            </span>
          </div>

          {/* Set and number drive Pair, Bundle, Set Run and Set Builders. */}
          <div className={styles.attrRow}>
            <span className={styles.setName}>{setDisplayName(set.name, franchise.name)}</span>
            <span className={styles.setNumber}>#{card.setNumber}</span>
          </div>
        </div>
      )}

      {locked && <span className={styles.lockBadge}>Display only</span>}

      {selected && (
        <>
          <span className={styles.selectRule} />
          {selectIndex !== undefined && (
            <span className={styles.selectBadge}>{selectIndex}</span>
          )}
        </>
      )}
    </div>
  );
}
