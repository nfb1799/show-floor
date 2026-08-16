import { useRun } from './state/runStore';
import { SetupScreen } from './ui/SetupScreen';
import { ShopScreen } from './ui/ShopScreen';
import { ShowScreen } from './ui/ShowScreen';
import { RunOverScreen, ShowResultScreen, TitleScreen } from './ui/EndScreens';
import { TourLayer } from './ui/tour/TourLayer';

export default function App() {
  const phase = useRun((s) => s.phase);

  return (
    <>
      {screenFor(phase)}
      {/* Above every screen, because the walkthrough crosses three of them. */}
      <TourLayer />
    </>
  );
}

function screenFor(phase: ReturnType<typeof useRun.getState>['phase']) {
  switch (phase) {
    case 'title':
      return <TitleScreen />;
    case 'setup':
      return <SetupScreen />;
    case 'inShow':
      // Haggling is an overlay the table renders over itself, not a screen.
      return <ShowScreen />;
    case 'showResult':
      return <ShowResultScreen />;
    case 'shop':
      return <ShopScreen />;
    case 'runOver':
      return <RunOverScreen />;
  }
}
