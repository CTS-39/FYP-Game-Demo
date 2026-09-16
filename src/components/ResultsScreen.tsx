import type { GameState } from '../game/types'

interface ResultsScreenProps {
  game: GameState
  onRestart: () => void
}

export function ResultsScreen({ game, onRestart }: ResultsScreenProps) {
  const human = game.players.human
  const ordered = Object.values(game.players).sort((left, right) => right.score - left.score)

  return (
    <section className="results-screen">
      <h2>🏆 Game Complete</h2>
      <p>{game.winner?.summary}</p>
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
