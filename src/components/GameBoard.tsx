import { terrainNames, terrainPalette, tileKey } from '../game/map'
import { getTileSummary } from '../game/engine'
import type { GameState, Tile } from '../game/types'

interface GameBoardProps {
  game: GameState
  onSelectUnit: (unitId: string | null) => void
  selectedTile: string | null
  onSelectTile: (tile: Tile) => void
}

const terrainIcons = {
  plains: '🌾',
  forest: '🌲',
  mountain: '⛰️',
  water: '💧',
  crystal: '💎',
  village: '🏡',
  ruins: '🪄',
}

const buildingIcons = {
  base: '🏠',
  farm: '🌱',
  laboratory: '🔬',
  mine: '⛏️',
  workshop: '⚙️',
}

const roleIcons = {
  worker: '🤖',
  explorer: '🚀',
}

export function GameBoard({ game, onSelectUnit, selectedTile, onSelectTile }: GameBoardProps) {
  const humanVision = game.players.human.revealed
  const ownerByTile = new Map<string, (typeof game.players)[keyof typeof game.players]>()

  for (const player of Object.values(game.players)) {
    for (const key of player.territory) ownerByTile.set(key, player)
  }

  return (
    <section className="world-section panel">
      <div className="world-header">
        <div>
          <strong>{game.report.headline}</strong>
          <p>{game.report.details[0]}</p>
        </div>
        <div className="phase-pill">Round {game.round}/{game.maxRounds}</div>
      </div>
      <div className="board-wrap">
        <div className="board-grid" style={{ gridTemplateColumns: `repeat(${game.map[0].length}, minmax(0, 1fr))` }}>
          {game.map.flat().map((tile) => {
            const key = tileKey(tile.x, tile.y)
            const visible = humanVision.includes(key)
            const owner = ownerByTile.get(key)
            const { building, units } = getTileSummary(tile, game)
            const selected = selectedTile === key
            return (
              <button
                key={key}
                type="button"
                className={`tile ${selected ? 'selected' : ''} ${visible ? '' : 'fogged'}`}
                style={{ background: visible ? terrainPalette[tile.terrain] : 'var(--fog)' }}
                onClick={() => {
                  onSelectTile(tile)
                  const ownUnit = units.find((unit) => unit.playerId === 'human')
                  onSelectUnit(ownUnit?.id ?? null)
                }}
              >
                <span className="tile-top">
                  <span>{visible ? terrainIcons[tile.terrain] : '❔'}</span>
                  {visible && owner ? <span className="owner-dot" style={{ background: owner.accent }} /> : null}
                </span>
                <span className="tile-label">{visible ? terrainNames[tile.terrain] : 'Fog'}</span>
                <span className="tile-stack">
                  {visible && building ? <span>{buildingIcons[building.type]}</span> : null}
                  {visible
                    ? units.map((unit) => (
                        <span key={unit.id} className={unit.playerId === 'human' ? 'human-unit' : ''}>
                          {roleIcons[unit.role]}
                        </span>
                      ))
                    : null}
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </section>
  )
}
