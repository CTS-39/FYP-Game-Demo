import { useEffect, useMemo, useState } from 'react'
import { GameBoard } from './components/GameBoard'
import { MainMenu } from './components/MainMenu'
import { ResultsScreen } from './components/ResultsScreen'
import { Sidebar } from './components/Sidebar'
import { TutorialCard } from './components/TutorialCard'
import { advanceTutorial, createInitialState, executeRound, getSelectedUnit, getTileSummary, queueResearch, selectUnit, updateUnitProgram, validateSelectedProgram } from './game/engine'
import { tileKey, terrainNames } from './game/map'
import { LocalNetworkManager } from './multiplayer/network'
import type { GameMode, GameState, PlayerId, Tile } from './game/types'
import './index.css'
import { collectTips, expandProgram } from './programming/commandSystem'

const networkManager = new LocalNetworkManager()
const VS_AI_SAVE_KEY = 'code-kingdoms-vs-ai-save-v1'

function loadVsAiGame() {
  try {
    const raw = localStorage.getItem(VS_AI_SAVE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as GameState
    return parsed.mode === 'vs-ai' ? parsed : null
  } catch {
    return null
  }
}

function persistVsAiGame(state: GameState) {
  if (state.mode !== 'vs-ai') return
  localStorage.setItem(VS_AI_SAVE_KEY, JSON.stringify(state))
}

function App() {
  const [screen, setScreen] = useState<'menu' | 'game' | 'settings'>('menu')
  const [game, setGame] = useState<GameState | null>(null)
  const [selectedTile, setSelectedTile] = useState<string | null>(null)
  const [highlightedAi, setHighlightedAi] = useState<PlayerId | null>(null)
  const [settings, setSettings] = useState({ fastMode: true, highContrast: false })

  const selectedUnit = useMemo(() => (game ? getSelectedUnit(game) : null), [game])
  const validationErrors = useMemo(() => (game ? validateSelectedProgram(game) : []), [game])
  const hasVsAiSave = useMemo(() => loadVsAiGame() !== null, [screen, game])

  const startGame = (mode: GameMode) => {
    const next = createInitialState(mode)
    setGame(next)
    setScreen('game')
    setSelectedTile(null)
    setHighlightedAi(null)
    persistVsAiGame(next)
  }

  const handleLoadVsAiGame = () => {
    const saved = loadVsAiGame()
    if (!saved) return
    setGame(saved)
    setScreen('game')
    setSelectedTile(null)
    setHighlightedAi(null)
  }

  useEffect(() => {
    if (!game || game.mode !== 'vs-ai') return
    persistVsAiGame(game)
  }, [game])

  const selectedTileLabel = useMemo(() => {
    if (!game || !selectedTile) return 'Select a tile to inspect terrain, ownership, and units.'
    const [x, y] = selectedTile.split(',').map(Number)
    return `${terrainNames[game.map[y][x].terrain]} tile at (${x + 1}, ${y + 1})`
  }, [game, selectedTile])

  const selectedTileActions = useMemo(() => {
    if (!game || !selectedTile) {
      return ['Click any tile to see what actions are possible there.']
    }

    const [x, y] = selectedTile.split(',').map(Number)
    const tile = game.map[y]?.[x]
    if (!tile) return ['Selected tile is invalid. Choose another tile.']

    const key = tileKey(x, y)
    const visible = game.players.human.revealed.includes(key)
    const isClaimedByHuman = game.players.human.territory.includes(key)
    const { building, units } = getTileSummary(tile, game)
    const hasWorkerHere = units.some((unit) => unit.playerId === 'human' && unit.role === 'worker')
    const hasExplorerHere = units.some((unit) => unit.playerId === 'human' && unit.role === 'explorer')

    if (!visible) {
      return [
        'This tile is in fog of war. Move an Explorer nearby to reveal it safely.',
        'You cannot reliably plan COLLECT or BUILD here until it is revealed.',
      ]
    }

    const actions: string[] = []
    if (tile.terrain === 'water') {
      actions.push('Movement: robots cannot enter water tiles.')
      actions.push('Building: cannot build on water.')
    } else {
      actions.push('Movement: robots can move onto this tile if it is not occupied by another unit.')
      if (tile.terrain === 'mountain') {
        actions.push('Movement cost: mountain travel consumes extra energy.')
        actions.push('Building: cannot build on mountain tiles.')
      }
    }

    if (tile.resource && tile.amount > 0) {
      actions.push(`Collect: this tile has ${tile.resource} (${tile.amount} remaining). Use a robot with COLLECT while standing here.`)
    } else if (tile.resource) {
      actions.push(`Collect: this ${tile.resource} source is depleted.`)
    } else {
      actions.push('Collect: no resource node on this tile.')
    }

    if (building) {
      const owner = game.players[building.playerId].name
      actions.push(`Building: occupied by ${building.type} (${owner}). No additional building can be placed here.`)
    } else if (tile.terrain !== 'water' && tile.terrain !== 'mountain') {
      if (!isClaimedByHuman) {
        actions.push('Building: claim this tile first by moving your unit through nearby territory, then build with a Worker.')
      } else if (!hasWorkerHere) {
        actions.push('Building: this tile is claimable and valid, but you need your Worker standing here to execute BUILD.')
      } else {
        actions.push('Building: valid target. Queue a BUILD action on your Worker to place a structure here.')
      }
    }

    if (hasExplorerHere) {
      actions.push('Explorer usage: good scouting position. Continue revealing fog and identifying future resource routes.')
    }

    return actions
  }, [game, selectedTile])

  const handleSelectTile = (tile: Tile) => {
    setSelectedTile(tileKey(tile.x, tile.y))
  }

  const handleRunProgram = () => {
    if (!game || !selectedUnit) return
    const details = validationErrors.length > 0 ? validationErrors : [`${selectedUnit.name} is ready for the execution phase.`]
    const tips = validationErrors.length === 0 ? collectTips(selectedUnit.program) : []
    const actionCount = validationErrors.length === 0 ? expandProgram(selectedUnit.program, selectedUnit, game).length : 0
    const pendingMessages =
      validationErrors.length > 0
        ? ['Program check found issues. Fix the errors in the Code Panel before ending turn.', ...validationErrors.slice(0, 2)]
        : [`Program validated for ${selectedUnit.name}.`, `${actionCount} action${actionCount === 1 ? '' : 's'} queued for execution this turn.`]

    setGame({
      ...game,
      report: {
        headline: validationErrors.length > 0 ? '⚠️ Program needs attention' : '▶ Program ready',
        details,
        tips,
      },
      pendingMessages,
    })
  }

  const handleEndTurn = () => {
    if (!game) return
    const next = executeRound(networkManager.submitTurn(game))
    const resolved = next.mode === 'tutorial' ? advanceTutorial(next) : next
    setGame(resolved)
    persistVsAiGame(resolved)
  }

  if (screen === 'menu') {
    return <MainMenu onStart={startGame} onLoadVsAi={handleLoadVsAiGame} canLoadVsAi={hasVsAiSave} onOpenSettings={() => setScreen('settings')} />
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
    <main className={`app-shell ${settings.highContrast ? 'high-contrast' : ''} ${settings.fastMode ? 'fast-mode' : 'slow-mode'}`}>
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
          selectedTileActions={selectedTileActions}
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
