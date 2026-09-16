import type { GameState, PlayerId, ProgramNode, UnitState } from '../game/types'
import {
  commandHelp,
  createActionNode,
  createIfNode,
  createRepeatNode,
  cycleBuildingType,
  cycleCondition,
  cycleDirection,
  insertNode,
  moveNode,
  removeNode,
  updateNode,
} from '../programming/commandSystem'

interface SidebarProps {
  game: GameState
  selectedUnit: UnitState | null
  validationErrors: string[]
  selectedTileLabel: string
  highlightedAi: PlayerId | null
  onHighlightAi: (playerId: PlayerId | null) => void
  onRunProgram: () => void
  onUpdateProgram: (program: ProgramNode[]) => void
  onQueueResearch: (tech: 'conditions' | 'automation') => void
  onEndTurn: () => void
}

const actionButtons = [
  ['MOVE', () => createActionNode('MOVE')],
  ['COLLECT', () => createActionNode('COLLECT')],
  ['BUILD', () => createActionNode('BUILD')],
  ['WAIT', () => createActionNode('WAIT')],
  ['REPEAT', () => createRepeatNode()],
  ['IF', () => createIfNode()],
] as const

function renderProgram(
  nodes: ProgramNode[],
  onUpdateProgram: (program: ProgramNode[]) => void,
  program: ProgramNode[],
  parentId?: string,
  _branch: 'then' | 'else' | 'children' = 'children',
) {
  return nodes.map((node) => (
    <li key={node.id} className="code-node">
      <div className="node-row">
        <span>
          <strong>{node.type}</strong>{' '}
          {node.type === 'MOVE' && <button type="button" className="inline" onClick={() => onUpdateProgram(updateNode(program, node.id, (entry) => ({ ...entry, direction: cycleDirection(entry.type === 'MOVE' ? entry.direction : 'NORTH') })))}>{node.direction}</button>}
          {node.type === 'BUILD' && <button type="button" className="inline" onClick={() => onUpdateProgram(updateNode(program, node.id, (entry) => ({ ...entry, buildingType: cycleBuildingType(entry.type === 'BUILD' ? entry.buildingType : 'farm') })))}>{node.buildingType}</button>}
          {node.type === 'REPEAT' && (
            <>
              <button type="button" className="inline" onClick={() => onUpdateProgram(updateNode(program, node.id, (entry) => entry.type === 'REPEAT' ? { ...entry, times: Math.min(5, entry.times + 1) } : entry))}>+</button>
              <span>{node.times} times</span>
              <button type="button" className="inline" onClick={() => onUpdateProgram(updateNode(program, node.id, (entry) => entry.type === 'REPEAT' ? { ...entry, times: Math.max(1, entry.times - 1) } : entry))}>-</button>
            </>
          )}
          {node.type === 'IF' && <button type="button" className="inline" onClick={() => onUpdateProgram(updateNode(program, node.id, (entry) => entry.type === 'IF' ? { ...entry, condition: cycleCondition(entry.condition) } : entry))}>{node.condition}</button>}
        </span>
        <span className="node-actions">
          <button type="button" className="inline" onClick={() => onUpdateProgram(moveNode(program, node.id, -1))}>↑</button>
          <button type="button" className="inline" onClick={() => onUpdateProgram(moveNode(program, node.id, 1))}>↓</button>
          <button type="button" className="inline" onClick={() => onUpdateProgram(removeNode(program, node.id))}>✕</button>
        </span>
      </div>
      {node.type === 'REPEAT' ? (
        <div className="nested-block">
          <ul>{renderProgram(node.children, onUpdateProgram, program, node.id, 'children')}</ul>
          <div className="button-row tiny">
            {actionButtons.map(([label, factory]) => (
              <button key={`${node.id}-${label}`} type="button" onClick={() => onUpdateProgram(insertNode(program, factory(), node.id, 'children'))}>
                + {label}
              </button>
            ))}
          </div>
        </div>
      ) : null}
      {node.type === 'IF' ? (
        <div className="nested-block split">
          <section>
            <p>Then</p>
            <ul>{renderProgram(node.thenChildren, onUpdateProgram, program, node.id, 'then')}</ul>
            <div className="button-row tiny">
              {actionButtons.slice(0, 4).map(([label, factory]) => (
                <button key={`${node.id}-then-${label}`} type="button" onClick={() => onUpdateProgram(insertNode(program, factory(), node.id, 'then'))}>
                  + {label}
                </button>
              ))}
            </div>
          </section>
          <section>
            <p>Else</p>
            <ul>{renderProgram(node.elseChildren, onUpdateProgram, program, node.id, 'else')}</ul>
            <div className="button-row tiny">
              {actionButtons.slice(0, 4).map(([label, factory]) => (
                <button key={`${node.id}-else-${label}`} type="button" onClick={() => onUpdateProgram(insertNode(program, factory(), node.id, 'else'))}>
                  + {label}
                </button>
              ))}
            </div>
          </section>
        </div>
      ) : null}
      {!parentId ? <p className="command-help">{commandHelp[node.type]}</p> : null}
    </li>
  ))
}

export function Sidebar({
  game,
  selectedUnit,
  validationErrors,
  selectedTileLabel,
  highlightedAi,
  onHighlightAi,
  onRunProgram,
  onUpdateProgram,
  onQueueResearch,
  onEndTurn,
}: SidebarProps) {
  const leaderboard = Object.values(game.players).sort((left, right) => right.score - left.score)
  const selectedAi = highlightedAi ? game.players[highlightedAi] : null
  const hasConditions = game.players.human.researched.includes('conditions')

  return (
    <aside className="sidebar">
      <section className="panel resource-panel">
        <div className="resource-row">
          <span>🪵 {game.players.human.resources.wood}</span>
          <span>⚡ {game.players.human.resources.energy}</span>
          <span>💎 {game.players.human.resources.crystal}</span>
          <span>🍎 {game.players.human.resources.food}</span>
        </div>
        <p>{selectedTileLabel}</p>
      </section>

      <section className="panel">
        <h3>🤖 {selectedUnit ? `${selectedUnit.name} (${selectedUnit.role})` : 'Select a robot'}</h3>
        {selectedUnit ? (
          <>
            <p>Energy: {selectedUnit.energy}</p>
            <p>Owner: {game.players[selectedUnit.playerId].name}</p>
          </>
        ) : (
          <p>Click a visible tile with one of your robots to program it.</p>
        )}
      </section>

      <section className="panel code-panel">
        <h3>🧠 Code Panel</h3>
        {selectedUnit ? (
          <>
            <ul className="code-tree">{renderProgram(selectedUnit.program, onUpdateProgram, selectedUnit.program)}</ul>
            <div className="button-row">
              {actionButtons.map(([label, factory]) => (
                <button
                  key={label}
                  type="button"
                  disabled={label === 'IF' && !hasConditions}
                  onClick={() => onUpdateProgram(insertNode(selectedUnit.program, factory()))}
                >
                  + {label}
                </button>
              ))}
            </div>
            <div className="button-row">
              <button type="button" onClick={onRunProgram}>▶ RUN PROGRAM</button>
            </div>
            {validationErrors.length > 0 ? (
              <div className="error-box">
                {validationErrors.map((error) => (
                  <p key={error}>{error}</p>
                ))}
              </div>
            ) : (
              <p className="success-box">Your program is ready — press RUN PROGRAM to validate it, then END TURN to execute it.</p>
            )}
          </>
        ) : (
          <p>Choose a robot to unlock the visual programming editor.</p>
        )}
      </section>

      <section className="panel">
        <h3>🔬 Technology Tree</h3>
        <div className="tech-tree">
          <div className="tech-node unlocked">Basic Logic</div>
          <button type="button" className={game.players.human.researched.includes('conditions') ? 'tech-node unlocked' : 'tech-node'} onClick={() => onQueueResearch('conditions')}>
            Conditions {game.players.human.researched.includes('conditions') ? '✓' : '(IF / ELSE)'}
          </button>
          <button type="button" className={game.players.human.researched.includes('automation') ? 'tech-node unlocked' : 'tech-node'} onClick={() => onQueueResearch('automation')}>
            Automation {game.players.human.researched.includes('automation') ? '✓' : '(science)'}
          </button>
        </div>
      </section>

      <section className="panel">
        <h3>🌍 Civilizations</h3>
        <ol className="leaderboard">
          {leaderboard.map((player) => (
            <li key={player.id}>
              <button type="button" className="leader-button" onClick={() => onHighlightAi(player.isHuman ? null : player.id)}>
                <span>
                  {player.emblem} {player.name}
                </span>
                <strong>{player.score}</strong>
              </button>
            </li>
          ))}
        </ol>
        {selectedAi ? (
          <div className="ai-reason-box">
            <strong>{selectedAi.name} reasoning</strong>
            <ul>
              {selectedAi.lastReason.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      <section className="panel report-panel">
        <h3>✨ Round Feedback</h3>
        <ul>
          {game.report.details.slice(0, 6).map((detail, index) => (
            <li key={`${detail}-${index}`}>{detail}</li>
          ))}
        </ul>
        {game.report.tips.length > 0 ? (
          <div className="tip-box">
            {game.report.tips.map((tip) => (
              <p key={tip}>{tip}</p>
            ))}
          </div>
        ) : null}
      </section>

      <button type="button" className="end-turn" onClick={onEndTurn}>
        End Turn
      </button>
    </aside>
  )
}
