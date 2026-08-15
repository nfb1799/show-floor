/**
 * Venue flavour for the setup masthead. Deterministic from the show number, so
 * a given run always visits the same halls in the same order. Presentation
 * only — nothing in the game layer knows or cares where the show is held.
 */

const VENUES: readonly string[] = [
  'CEDAR HALL',
  'ARMORY B',
  'VFW POST 12',
  'THE LEGION ROOM',
  'RIVERSIDE ANNEX',
  'GRANGE PAVILION',
  'MARKET SQUARE',
  'THE OLD CREAMERY',
  'FAIRGROUND HALL C',
  'UNION HALL',
  'THE ROLLERDROME',
  'CIVIC BASEMENT',
];

const DAYS: readonly string[] = ['SATURDAY 9:00', 'SUNDAY 10:00', 'SATURDAY 8:30', 'FRIDAY 16:00'];

export function venueFor(showIndex: number): string {
  return VENUES[(showIndex - 1) % VENUES.length] ?? 'CEDAR HALL';
}

export function slotFor(showIndex: number): string {
  return DAYS[(showIndex - 1) % DAYS.length] ?? DAYS[0]!;
}
