import type { GameState } from '../game/types'
import { terrainNames, tileKey } from '../game/map'

interface ResultsScreenProps {
  game: GameState
  onRestart: () => void
}

export function ResultsScreen({ game, onRestart }: ResultsScreenProps) {
  const human = game.players.human
  const ordered = Object.values(game.players).sort((left, right) => right.score - left.score)
  const ownerByTile = new Map<string, (typeof game.players)[keyof typeof game.players]>()

  for (const player of Object.values(game.players)) {
    for (const key of player.territory) ownerByTile.set(key, player)
  }

  const unitIcon: Record<string, string> = {
    worker: '🤖',
    explorer: '🚀',
    attack: '⚔️',
    defender: '🛡️',
  }

  const terrainIcons: Record<string, string> = {
    plains: '🌾',
    forest: '🌲',
    mountain: '⛰️',
    water: '💧',
    crystal: '💎',
    village: '🏡',
    ruins: '🪄',
  }

  const buildingIcon: Record<string, string> = {
    base: '🏠',
    farm: '🌱',
    laboratory: '🔬',
    mine: '⛏️',
    workshop: '⚙️',
  }

  return (
    <section className="results-screen">
      <h2>🏆 Game Complete</h2>
      <p>{game.winner?.summary}</p>
      <article className="panel results-map-panel">
        <h3>Final World Map</h3>
        <div className="results-map-grid" style={{ gridTemplateColumns: `repeat(${game.map[0].length}, minmax(0, 1fr))` }}>
          {game.map.flat().map((tile) => {
            const key = tileKey(tile.x, tile.y)
            const owner = ownerByTile.get(key)
            const building = game.buildings.find((entry) => entry.x === tile.x && entry.y === tile.y)
            const units = game.units.filter((entry) => entry.x === tile.x && entry.y === tile.y)

            return (
              <div key={key} className="results-map-tile">
                <div className="results-map-top">
                  <span>{terrainIcons[tile.terrain]}</span>
                  {owner ? <span className={`results-owner ${owner.id === 'human' ? 'friendly' : 'enemy'}`}>{owner.id === 'human' ? '🟢' : '🔴'}</span> : null}
                </div>
                <p>{terrainNames[tile.terrain]}</p>
                <div className="results-map-stack">
                  {building ? <span>{buildingIcon[building.type]}</span> : null}
                  {units.map((unit) => (
                    <span key={unit.id}>{unitIcon[unit.role]}</span>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </article>
      <div className="results-grid">
        <article className="panel">
          <h3>{human.name}</h3>
          <p>Territory: {'█'.repeat(Math.max(1, Math.min(8, Math.round(human.territory.length / 3))))}</p>
          <p>Science: {'█'.repeat(human.researched.length + 1)}</p>
          <p>Economy: {'█'.repeat(Math.max(1, Math.min(8, Math.round(Object.values(human.resources).reduce((sum, value) => sum + value, 0) / 12))))}</p>
          <p>Programming: {'█'.repeat(human.conceptsUsed.length + 1)}</p>
          <ul className="resource-list">
            <li>🪵 {human.resources.wood}</li>
            <li>⚡ {human.resources.energy}</li>
            <li>💎 {human.resources.crystal}</li>
            <li>🍎 {human.resources.food}</li>
          </ul>
          <p>Programming concepts used: {human.conceptsUsed.join(', ')}</p>
        </article>
        <article className="panel">
          <h3>Civilizations</h3>
          <ol className="leaderboard large">
            {ordered.map((player) => (
              <li key={player.id}>
                <span>
                  {player.emblem} {player.name}
                </span>
                <strong>{player.score}</strong>
              </li>
            ))}
          </ol>
        </article>
      </div>
      <button type="button" onClick={onRestart}>
        Restart Game
      </button>
    </section>
  )
}
