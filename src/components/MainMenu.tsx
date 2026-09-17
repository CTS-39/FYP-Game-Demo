import type { GameMode } from '../game/types'

interface MainMenuProps {
  onStart: (mode: GameMode) => void
  onOpenSettings: () => void
}

export function MainMenu({ onStart, onOpenSettings }: MainMenuProps) {
  return (
    <section className="menu-screen">
      <div className="hero-card">
        <p className="eyebrow">A strategy game powered by logic</p>
        <h1>Code Kingdoms</h1>
        <p>
          Program cute robot units, explore a colorful world, and outsmart three AI civilizations in short 4X rounds.
        </p>
        <div className="menu-grid">
          <button type="button" onClick={() => onStart('quick')}>
            Quick Game
          </button>
          <button type="button" onClick={() => onStart('vs-ai')}>
            Play vs AI
          </button>
          <button type="button" onClick={() => onStart('multiplayer')}>
            Multiplayer Demo
          </button>
          <button type="button" onClick={() => onStart('tutorial')}>
            Tutorial
          </button>
          <button type="button" className="secondary" onClick={onOpenSettings}>
            Settings
          </button>
        </div>
      </div>
    </section>
  )
}
