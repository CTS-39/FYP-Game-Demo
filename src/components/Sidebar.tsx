import { useEffect, useState } from 'react'
import type { GameState, PlayerId, ProgramNode, UnitState } from '../game/types'
import { HelpHint } from './HelpHint'
import {
  PROGRAM_LIMITS,
  canInsertNode,
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
  getProgramStats,
  updateNode,
} from '../programming/commandSystem'

interface SidebarProps {
  game: GameState
  selectedUnit: UnitState | null
  validationErrors: string[]
  selectedTileLabel: string
  selectedTileActions: string[]
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
  canInsertHere: (parentId?: string, branch?: 'then' | 'else' | 'children') => boolean,
  onInsertRequested: (factory: () => ProgramNode, parentId?: string, branch?: 'then' | 'else' | 'children') => void,
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
          <ul>{renderProgram(node.children, onUpdateProgram, program, canInsertHere, onInsertRequested, node.id, 'children')}</ul>
          <div className="button-row tiny">
            {actionButtons.map(([label, factory]) => (
              <button key={`${node.id}-${label}`} type="button" disabled={!canInsertHere(node.id, 'children')} onClick={() => onInsertRequested(factory, node.id, 'children')}>
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
            <ul>{renderProgram(node.thenChildren, onUpdateProgram, program, canInsertHere, onInsertRequested, node.id, 'then')}</ul>
            <div className="button-row tiny">
              {actionButtons.slice(0, 4).map(([label, factory]) => (
                <button key={`${node.id}-then-${label}`} type="button" disabled={!canInsertHere(node.id, 'then')} onClick={() => onInsertRequested(factory, node.id, 'then')}>
                  + {label}
                </button>
              ))}
            </div>
          </section>
          <section>
            <p>Else</p>
            <ul>{renderProgram(node.elseChildren, onUpdateProgram, program, canInsertHere, onInsertRequested, node.id, 'else')}</ul>
            <div className="button-row tiny">
              {actionButtons.slice(0, 4).map(([label, factory]) => (
                <button key={`${node.id}-else-${label}`} type="button" disabled={!canInsertHere(node.id, 'else')} onClick={() => onInsertRequested(factory, node.id, 'else')}>
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
  selectedTileActions,
  highlightedAi,
  onHighlightAi,
  onRunProgram,
  onUpdateProgram,
  onQueueResearch,
  onEndTurn,
}: SidebarProps) {
  const [limitMessage, setLimitMessage] = useState<string | null>(null)
  const leaderboard = Object.values(game.players).sort((left, right) => right.score - left.score)
  const selectedAi = highlightedAi ? game.players[highlightedAi] : null
  const hasConditions = game.players.human.researched.includes('conditions')
  const programStats = selectedUnit ? getProgramStats(selectedUnit.program) : null

  useEffect(() => {
    setLimitMessage(null)
  }, [selectedUnit?.id, selectedUnit?.program])

  const canInsertHere = (parentId?: string, branch: 'then' | 'else' | 'children' = 'children') => {
    if (!selectedUnit) return false
    return canInsertNode(selectedUnit.program, parentId, branch).allowed
  }

  const handleInsertNode = (factory: () => ProgramNode, parentId?: string, branch: 'then' | 'else' | 'children' = 'children') => {
    if (!selectedUnit) return
    const check = canInsertNode(selectedUnit.program, parentId, branch)
    if (!check.allowed) {
      setLimitMessage(check.reason ?? 'Cannot add more blocks here.')
      return
    }
    setLimitMessage(null)
    onUpdateProgram(insertNode(selectedUnit.program, factory(), parentId, branch))
  }

  return (
    <aside className="sidebar">
      <section className="panel resource-panel">
        <h3>
          Materials{' '}
          <HelpHint
            label="Materials help"
            text="Track your core resources: 🪵 wood for buildings, ⚡ energy for advanced progress, 💎 crystal for research and labs, and 🍎 food for growth. The line below shows the currently selected map tile information."
          />
        </h3>
        <div className="resource-row">
          <span>🪵 {game.players.human.resources.wood}</span>
          <span>⚡ {game.players.human.resources.energy}</span>
          <span>💎 {game.players.human.resources.crystal}</span>
          <span>🍎 {game.players.human.resources.food}</span>
        </div>
        <p>{selectedTileLabel}</p>
        <ul className="tile-action-list">
          {selectedTileActions.map((action) => (
            <li key={action}>{action}</li>
          ))}
        </ul>
      </section>

      <section className="panel">
        <h3>
          🤖 {selectedUnit ? `${selectedUnit.name} (${selectedUnit.role})` : 'Select a robot'}{' '}
          <HelpHint
            label="Robot panel help"
            text="This panel shows the selected unit's role, energy, and owner. Worker robots focus on collect/build economy actions. Explorer robots are your scouting unit: they reveal fog faster, find resource landmarks early, and set up safer expansion routes for workers. Select units by clicking a tile that contains your robot."
          />
        </h3>
        {selectedUnit ? (
          <>
            <p>Energy: {selectedUnit.energy}</p>
            <p>Owner: {game.players[selectedUnit.playerId].name}</p>
            <p className="muted">
              {selectedUnit.role === 'explorer'
                ? 'Explorer role: reveal fog quickly, scout safe routes, and claim vision around distant tiles.'
                : 'Worker role: collect resources and build structures to power your economy and research.'}
            </p>
          </>
        ) : (
          <p>Click a visible tile with one of your robots to program it.</p>
        )}
      </section>

      <section className="panel code-panel">
        <h3>
          🧠 Code Panel{' '}
          <HelpHint
            label="Code panel help"
            text="Create the unit program with blocks: MOVE changes tile, COLLECT gathers resources, BUILD places structures, WAIT recharges, REPEAT loops actions, and IF (after Conditions research) adds branching logic. Use RUN PROGRAM to validate before ending turn."
          />
        </h3>
        {selectedUnit ? (
          <>
            <ul className="code-tree">{renderProgram(selectedUnit.program, onUpdateProgram, selectedUnit.program, canInsertHere, handleInsertNode)}</ul>
            <p className="muted">
              Block limits: {programStats?.totalNodes ?? 0}/{PROGRAM_LIMITS.maxTotalNodes} total, {programStats?.rootNodes ?? 0}/{PROGRAM_LIMITS.maxRootNodes} top-level, depth {programStats?.maxDepth ?? 0}/{PROGRAM_LIMITS.maxNestingDepth}.
            </p>
            <div className="button-row">
              {actionButtons.map(([label, factory]) => (
                <button
                  key={label}
                  type="button"
                  disabled={(label === 'IF' && !hasConditions) || !canInsertHere()}
                  onClick={() => handleInsertNode(factory)}
                >
                  + {label}
                </button>
              ))}
            </div>
            {limitMessage ? <div className="error-box"><p>{limitMessage}</p></div> : null}
            <div className="button-row">
              <button type="button" onClick={onRunProgram}>▶ RUN PROGRAM</button>
            </div>
            {game.pendingMessages.length > 0 ? (
              <div className="run-feedback-box">
                {game.pendingMessages.map((message) => (
                  <p key={message}>{message}</p>
                ))}
              </div>
            ) : null}
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
        <h3>
          🔬 Technology Tree{' '}
          <HelpHint
            label="Technology tree help"
            text="Choose future upgrades here. Basic Logic is your starting tech. Conditions unlocks IF/ELSE decision-making. Automation supports faster strategic growth. Queued research is processed during execution if you can pay the resource cost."
          />
        </h3>
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
        <h3>
          🌍 Civilizations{' '}
          <HelpHint
            label="Civilizations help"
            text="Leaderboard ranking by score. Emblems identify each civilization and the number at right is current total score. Click an AI civilization to inspect its latest reasoning and strategy choices for this round."
          />
        </h3>
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
        <h3>
          ✨ Round Feedback{' '}
          <HelpHint
            label="Round feedback help"
            text="Shows recent execution results: movement outcomes, collection/build events, research updates, and validation messages. Tips below highlight programming improvements based on your current block structure."
          />
        </h3>
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
