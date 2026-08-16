/**
 * The swappable visual layer.
 *
 * Everything this component knows about a card comes through cardArtSpec. It
 * has no layout responsibilities: it fills whatever box CardFrame gives it.
 * Replacing it with a sprite renderer is a one-line change in CardView.tsx.
 */

import type { CSSProperties } from 'react';
import type { Card } from '../../game/types';
import { cardArtSpec } from './artSpec';
import styles from './art.module.css';

export type ArtSize = 'normal' | 'small' | 'tiny';

interface CardArtProps {
  card: Card;
  size?: ArtSize;
}

export function CardArt({ card, size = 'normal' }: CardArtProps) {
  const spec = cardArtSpec(card);

  const style = {
    '--franchise-ink': spec.franchiseInk,
    '--rarity-ink': spec.rarityInk,
  } as CSSProperties;

  const classes = [styles.art, spec.foil ? styles.foil : '', size !== 'normal' ? styles[size] : '']
    .filter(Boolean)
    .join(' ');

  return (
    <div className={classes} style={style}>
      <span className={styles.spine} />
      <span className={styles.subjectMark}>{card.subject}</span>
    </div>
  );
}
