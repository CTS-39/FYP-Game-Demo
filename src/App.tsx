import { useMemo, useState } from 'react'
import { GameBoard } from './components/GameBoard'
import { MainMenu } from './components/MainMenu'
import { ResultsScreen } from './components/ResultsScreen'
import { Sidebar } from './components/Sidebar'
import { TutorialCard } from './components/TutorialCard'
import { advanceTutorial, createInitialState, executeRound, getSelectedUnit, queueResearch, selectUnit, updateUnitProgram, validateSelectedProgram } from './game/engine'
import { tileKey, terrainNames } from './game/map'
import { LocalNetworkManager } from './multiplayer/network'
import type { GameMode, GameState, PlayerId, Tile } from './game/types'
import './index.css'
import { collectTips } from './programming/commandSystem'

const networkManager = new LocalNetworkManager()

function App() {
  const [screen, setScreen] = useState<'menu' | 'game' | 'settings'>('menu')
  const [game, setGame] = useState<GameState | null>(null)
  const [selectedTile, setSelectedTile] = useState<string | null>(null)
  const [highlightedAi, setHighlightedAi] = useState<PlayerId | null>(null)
  const [settings, setSettings] = useState({ fastMode: true, highContrast: false })

  const selectedUnit = useMemo(() => (game ? getSelectedUnit(game) : null), [game])
  const validationErrors = useMemo(() => (game ? validateSelectedProgram(game) : []), [game])

  const startGame = (mode: GameMode) => {
    setGame(createInitialState(mode))
    setScreen('game')
    setSelectedTile(null)
    setHighlightedAi(null)
  }

  const selectedTileLabel = useMemo(() => {
    if (!game || !selectedTile) return 'Select a tile to inspect terrain, ownership, and units.'
    const [x, y] = selectedTile.split(',').map(Number)
    return `${terrainNames[game.map[y][x].terrain]} tile at (${x + 1}, ${y + 1})`
  }, [game, selectedTile])

  const handleSelectTile = (tile: Tile) => {
    setSelectedTile(tileKey(tile.x, tile.y))
  }

  const handleRunProgram = () => {
    if (!game || !selectedUnit) return
    const details = validationErrors.length > 0 ? validationErrors : [`${selectedUnit.name} is ready for the execution phase.`]
    const tips = validationErrors.length === 0 ? collectTips(selectedUnit.program) : []
    setGame({
      ...game,
      report: {
        headline: validationErrors.length > 0 ? '⚠️ Program needs attention' : '▶ Program ready',
        details,
        tips,
      },
    })
  }

  const handleEndTurn = () => {
    if (!game) return
    const next = executeRound(networkManager.submitTurn(game))
    setGame(next.mode === 'tutorial' ? advanceTutorial(next) : next)
  }

  if (screen === 'menu') {
    return <MainMenu onStart={startGame} onOpenSettings={() => setScreen('settings')} />
  }

  if (screen === 'settings') {
    return (
      <section className="settings-screen panel">
        <h2>Settings</h2>
        <label>
          <input type="checkbox" checked={settings.fastMode} onChange={() => setSettings((current) => ({ ...current, fastMode: !current.fastMode }))} />
          Fast execution pacing
        </label>
        <label>
          <input type="checkbox" checked={settings.highContrast} onChange={() => setSettings((current) => ({ ...current, highContrast: !current.highContrast }))} />
          High-contrast ownership markers
        </label>
        <button type="button" onClick={() => setScreen('menu')}>
          Back to Menu
        </button>
      </section>
    )
  }

  if (!game) return null

  if (game.phase === 'results' && game.winner) {
    return <ResultsScreen game={game} onRestart={() => startGame(game.mode)} />
  }

  return (
    <main className={`app-shell ${settings.highContrast ? 'high-contrast' : ''}`}>
      <header className="top-bar panel">
        <div>
          <p className="eyebrow">Code Kingdoms</p>
          <h2>{game.mode === 'multiplayer' ? 'Local multiplayer-ready demo' : 'Single-player vs AI demo'}</h2>
        </div>
        <div className="top-actions">
          <button type="button" className="secondary" onClick={() => startGame(game.mode)}>
            Restart
          </button>
          <button type="button" className="secondary" onClick={() => setScreen('menu')}>
            Main Menu
          </button>
        </div>
      </header>
      <section className="layout">
        <div className="main-column">
          {game.mode === 'tutorial' ? <TutorialCard step={game.tutorialStep} /> : null}
          <GameBoard
            game={game}
            selectedTile={selectedTile}
            onSelectTile={handleSelectTile}
            onSelectUnit={(unitId) => setGame((current) => (current ? selectUnit(current, unitId) : current))}
          />
        </div>
        <Sidebar
          game={game}
          selectedUnit={selectedUnit}
          validationErrors={validationErrors}
          selectedTileLabel={selectedTileLabel}
          highlightedAi={highlightedAi}
          onHighlightAi={setHighlightedAi}
          onRunProgram={handleRunProgram}
          onQueueResearch={(tech) => setGame((current) => (current ? queueResearch(current, 'human', tech) : current))}
          onUpdateProgram={(program) => {
            if (!selectedUnit) return
            setGame((current) => (current ? updateUnitProgram(current, selectedUnit.id, program) : current))
          }}
          onEndTurn={handleEndTurn}
        />
      </section>
    </main>
  )
}

export default App
