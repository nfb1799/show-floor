import { formatMoney } from '../game/cards/value';
import { getConditions } from '../game/conditions/registry';
import { getArchetype } from '../game/buyers/archetypes';
import { getUpgrade, getUpgrades } from '../game/upgrades/registry';
import { peekArchetypes } from '../game/run/rumors';
import { planShow } from '../game/show/showEngine';
import { useRun } from '../state/runStore';
import { Band, ScreenHead, Sheet } from './kit';
import { slotFor, venueFor } from './venues';
import styles from './app.module.css';

export function SetupScreen() {
  const showIndex = useRun((s) => s.showIndex);
  const rumor = useRun((s) => s.rumor);
  const conditionIds = useRun((s) => s.conditionIds);
  const owned = useRun((s) => s.ownedUpgradeIds);
  const equipped = useRun((s) => s.equippedUpgradeIds);
  const bankroll = useRun((s) => s.bankroll);
  const inventory = useRun((s) => s.inventory);
  const casesBought = useRun((s) => s.casesBought);
  const rng = useRun((s) => s.rng);
  const revealBuyerMix = useRun((s) => s.revealBuyerMix);
  const equip = useRun((s) => s.equip);
  const unequip = useRun((s) => s.unequip);
  const startShow = useRun((s) => s.startShow);
  const slots = useRun((s) => s.upgradeSlots());
  const tables = useRun((s) => s.tableTier) + 1;

  const conditions = getConditions(conditionIds);
  const config = planShow(showIndex, inventory.length, {
    rng,
    upgrades: getUpgrades(equipped),
    conditions,
    extraCaseSlots: casesBought,
  });

  const canAfford = bankroll >= config.tableFee;
  const canOpen = canAfford && inventory.length > 0;
  const mix = revealBuyerMix ? peekArchetypes(rng, showIndex, config.buyerCount) : null;
  const bench = owned.filter((id) => !equipped.includes(id));

  return (
    <div className={`${styles.shell} ${styles.wide}`}>
      <ScreenHead
        n="01"
        title="DOORS OPEN"
        note="Read the wire, stock the booth, pay the table."
      />

      <Sheet className={styles.fillSheet}>
        <div className={styles.hallBand}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, flexWrap: 'wrap' }}>
            <span className={styles.hallName}>{venueFor(showIndex)}</span>
            <span className={styles.hallWhen}>
              SHOW {String(showIndex).padStart(2, '0')} · {slotFor(showIndex)}
            </span>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div className={styles.hallStatLabel}>BANKROLL</div>
            <div className={styles.hallStatValue}>{formatMoney(bankroll)}</div>
          </div>
        </div>

        <div className={styles.scrollPane} style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 18 }}>
          {/* The wire ------------------------------------------------- */}
          <div className={styles.wire}>
            <div className={styles.wireTab}>
              <span>THE WIRE</span>
            </div>
            <div className={styles.wireBody}>{rumor}</div>
          </div>

          {mix && (
            <div className={styles.sheetFlat}>
              <Band title="Price guide · who is coming" ink="blue" />
              <div style={{ padding: '10px 16px' }}>
                {mix.map((archetype, i) => (
                  <div key={i} className={styles.ledgerRow} style={{ padding: '7px 0' }}>
                    <span style={{ fontWeight: 600 }}>{getArchetype(archetype).label}</span>
                    <span className={styles.dim}>{getArchetype(archetype).blurb}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Quota + fee ---------------------------------------------- */}
          <div className={styles.setupCols}>
            <div className={styles.sheetFlat}>
              <Band title="Tonight's quota" ink="blue" />
              <div style={{ padding: '18px 20px' }}>
                <div className={`${styles.ledgerRow} ${styles.dotted}`}>
                  <span style={{ fontSize: 15, color: 'var(--body)' }}>Revenue to clear</span>
                  <span className={styles.num} style={{ fontSize: 28 }}>
                    {formatMoney(config.quota)}
                  </span>
                </div>
                <div className={`${styles.ledgerRow} ${styles.dotted}`}>
                  <span style={{ fontSize: 15, color: 'var(--body)' }}>Buyers at the table</span>
                  <span
                    style={{
                      fontFamily: "'Barlow Semi Condensed', sans-serif",
                      fontWeight: 800,
                      fontSize: 22,
                    }}
                  >
                    {config.buyerCount}
                  </span>
                </div>
                <div className={styles.ledgerRow}>
                  <span style={{ fontSize: 15, color: 'var(--body)' }}>House rule</span>
                  <span style={{ fontSize: 14, color: 'var(--muted)' }}>
                    {conditions.length > 0
                      ? conditions.map((c) => c.name).join(' + ')
                      : `none until show ${Math.ceil((showIndex + 1) / 3) * 3}`}
                  </span>
                </div>
              </div>
            </div>

            <div className={styles.sheetFlat} style={{ display: 'flex', flexDirection: 'column' }}>
              <Band title="Table fee — due now" ink="red" />
              <div
                style={{
                  padding: '18px 20px',
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                <span className={styles.feeBig}>–{formatMoney(config.tableFee)}</span>
                <div className={styles.feeFoot}>
                  <span style={{ fontSize: 15, color: 'var(--body)' }}>Bankroll after</span>
                  <span
                    className={styles.num}
                    style={{ fontSize: 24, color: canAfford ? 'var(--ink)' : 'var(--red)' }}
                  >
                    {formatMoney(bankroll - config.tableFee)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* House rules ---------------------------------------------- */}
          {conditions.length > 0 && (
            <div className={styles.conditionStrip}>
              {conditions.map((c) => (
                <div key={c.id} className={styles.conditionCard}>
                  <Band title={`House rule · ${c.name}`} ink="red" />
                  <div className={styles.conditionBody}>
                    <div className={styles.conditionText}>{c.text}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Booth gear ------------------------------------------------ */}
          <div className={styles.sheetFlat}>
            <Band
              title={`Booth gear · ${equipped.length}/${slots} slots`}
              note={`${tables} table${tables === 1 ? '' : 's'} — buy tables for more slots`}
              goldTitle
            />

            {owned.length === 0 ? (
              <div style={{ padding: 20 }} className={styles.dim}>
                You own no gear yet. The shop offers two pieces after every show.
              </div>
            ) : (
              <>
                <div className={styles.gearGrid}>
                  {equipped.map((id) => {
                    const def = getUpgrade(id);
                    return (
                      <button
                        key={id}
                        className={`${styles.gearCard} ${styles.tip}`}
                        data-tip={`${def.text} Click to bench it.`}
                        onClick={() => unequip(id)}
                      >
                        <div className={styles.gearTag}>EQUIPPED</div>
                        <div className={styles.gearBody}>
                          <div className={styles.gearName}>{def.name}</div>
                          <div className={styles.gearText}>{def.text}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {bench.length > 0 && (
                  <div className={styles.benchRow}>
                    <span className={styles.benchLabel}>ON THE BENCH:</span>
                    {bench.map((id) => {
                      const def = getUpgrade(id);
                      const full = equipped.length >= slots;
                      const last = equipped[slots - 1];
                      return (
                        <button
                          key={id}
                          className={`${styles.chip} ${styles.tip}`}
                          data-tip={
                            full && last
                              ? `${def.text} Booth is full — this bumps ${getUpgrade(last).name}.`
                              : def.text
                          }
                          onClick={() => equip(id)}
                        >
                          {def.name}
                        </button>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>

          {/* CTA ------------------------------------------------------- */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 20,
              flexWrap: 'wrap',
            }}
          >
            <div className={styles.dim} style={{ maxWidth: 440 }}>
              {canOpen ? (
                <>
                  Clear <strong style={{ color: 'var(--ink)' }}>{formatMoney(config.quota)}</strong>{' '}
                  across {config.buyerCount} buyers to advance. Come up short and the run's over.
                </>
              ) : inventory.length === 0 ? (
                'Nothing left to sell. The run ends here.'
              ) : (
                "You can't cover the table fee. This is where the run ends."
              )}
            </div>
            {/* Never disabled. startShow() already ends the run when the fee
                cannot be covered; disabling the button made that branch
                unreachable and left the screen with no legal action at all. */}
            <button className={styles.btn} onClick={startShow}>
              {canOpen ? `PAY ${formatMoney(config.tableFee)} · OPEN UP` : 'PACK UP · END THE RUN'}
            </button>
          </div>
        </div>
      </Sheet>
    </div>
  );
}
