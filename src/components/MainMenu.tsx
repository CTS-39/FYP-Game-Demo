import { useState } from 'react'
import type { GameMode } from '../game/types'

interface MainMenuProps {
  onStart: (mode: GameMode) => void
  onLoadVsAi: () => void
  canLoadVsAi: boolean
  onOpenSettings: () => void
}

export function MainMenu({ onStart, onLoadVsAi, canLoadVsAi, onOpenSettings }: MainMenuProps) {
  const [showVsAiOptions, setShowVsAiOptions] = useState(false)

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
            Quick Game (Instant)
          </button>
          <button type="button" onClick={() => setShowVsAiOptions((value) => !value)}>
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
        {showVsAiOptions ? (
          <div className="panel vs-ai-menu">
            <h3>Play vs AI</h3>
            <p>Start a fresh campaign or continue your saved one.</p>
            <div className="button-row">
              <button type="button" onClick={() => onStart('vs-ai')}>
                New Game
              </button>
              <button type="button" className="secondary" onClick={onLoadVsAi} disabled={!canLoadVsAi}>
                Load Game
              </button>
            </div>
            {!canLoadVsAi ? <p className="muted">No saved Play vs AI game found yet.</p> : null}
          </div>
        ) : null}
      </div>
    </section>
  )
}
