import { useStore } from './store';
import { GameScreen } from './ui/GameScreen';
import { Journal } from './ui/Journal';
import { LevelSelect } from './ui/LevelSelect';

export default function App() {
  const screen = useStore((s) => s.screen);
  if (screen === 'game') return <GameScreen />;
  if (screen === 'journal') return <Journal />;
  return <LevelSelect />;
}
