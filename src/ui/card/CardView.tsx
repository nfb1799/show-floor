/**
 * The composition point: layout (CardFrame) + visuals (CardArt).
 *
 * This is the ONLY file that needs to change to move from procedural CSS art
 * to sprites. Everything else in the app imports CardView.
 */

import { CardArt } from './CardArt';
import { CardFrame, type CardFrameProps } from './CardFrame';

export type CardViewProps = Omit<CardFrameProps, 'children'>;

export function CardView(props: CardViewProps) {
  return (
    <CardFrame {...props}>
      <CardArt card={props.card} size={props.size ?? 'normal'} />
    </CardFrame>
  );
}
