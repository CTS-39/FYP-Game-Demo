import { useEffect, useState } from 'react'
import type { BuildingType, GameState, PlayerId, ProgramNode, UnitRole, UnitState } from '../game/types'
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
  cycleRecruitRole,
  estimateProgramActionCount,
  getAllowedActionTypes,
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

const actionFactories = {
  MOVE: () => createActionNode('MOVE'),
  COLLECT: () => createActionNode('COLLECT'),
  BUILD: () => createActionNode('BUILD'),
  TRAIN: () => createActionNode('TRAIN'),
  UPGRADE: () => createActionNode('UPGRADE'),
  ATTACK: () => createActionNode('ATTACK'),
  DEFEND: () => createActionNode('DEFEND'),
  WAIT: () => createActionNode('WAIT'),
} as const

const structuralButtons = [
  ['REPEAT', () => createRepeatNode()],
  ['IF', () => createIfNode()],
] as const

function getActionButtonsForRole(role: UnitState['role']) {
  return getAllowedActionTypes(role).map((type) => [type, actionFactories[type]] as const)
}

const buildCosts: Record<BuildingType, string> = {
  base: 'free',
  farm: '🪵3 🍎1',
  laboratory: '🪵2 💎3 ⚡2',
  mine: '🪵2 ⚡1',
  workshop: '🪵4 ⚡2',
}

const trainCosts: Record<UnitRole, string> = {
  worker: '🪵2 ⚡2 💎1 🍎2',
  explorer: '🪵2 ⚡2 💎1 🍎1',
  attack: '🪵3 ⚡2 💎2 🍎1',
  defender: '🪵3 ⚡3 💎1 🍎2',
}

function getUpgradeCostLabel(role: UnitRole, level: number) {
  const baseCosts: Record<UnitRole, { wood: number; energy: number; crystal: number; food: number }> = {
    worker: { wood: 2, energy: 2, crystal: 1, food: 2 },
    explorer: { wood: 1, energy: 2, crystal: 2, food: 1 },
    attack: { wood: 2, energy: 2, crystal: 2, food: 1 },
    defender: { wood: 2, energy: 3, crystal: 1, food: 1 },
  }
  const scale = Math.max(0, level - 1)
  const costs = baseCosts[role]
  return `🪵${costs.wood + scale} ⚡${costs.energy + scale} 💎${costs.crystal + scale} 🍎${costs.food + scale}`
}

const directionLabels: Record<string, string> = {
  NORTH: 'UP',
  SOUTH: 'DOWN',
  EAST: 'RIGHT',
  WEST: 'LEFT',
}

function renderProgram(
  nodes: ProgramNode[],
  onUpdateProgram: (program: ProgramNode[]) => void,
  program: ProgramNode[],
  selectedUnit: UnitState,
  canInsertHere: (parentId?: string, branch?: 'then' | 'else' | 'children') => boolean,
  onInsertRequested: (factory: () => ProgramNode, parentId?: string, branch?: 'then' | 'else' | 'children') => void,
  actionButtons: ReadonlyArray<readonly [string, () => ProgramNode]>,
  parentId?: string,
  _branch: 'then' | 'else' | 'children' = 'children',
) {
  return nodes.map((node) => (
    <li key={node.id} className="code-node">
      <div className="node-row">
        <span>
          <strong>{node.type}</strong>{' '}
          {node.type === 'MOVE' && <button type="button" className="inline" onClick={() => onUpdateProgram(updateNode(program, node.id, (entry) => ({ ...entry, direction: cycleDirection(entry.type === 'MOVE' ? entry.direction : 'NORTH') })))}>{directionLabels[node.direction ?? 'NORTH']}</button>}
          {node.type === 'BUILD' && (
            <>
              <button type="button" className="inline" onClick={() => onUpdateProgram(updateNode(program, node.id, (entry) => ({ ...entry, buildingType: cycleBuildingType(entry.type === 'BUILD' ? entry.buildingType : 'farm') })))}>{node.buildingType}</button>
              <span className="node-cost">cost: {buildCosts[node.buildingType ?? 'farm']}</span>
            </>
          )}
          {node.type === 'TRAIN' && <button type="button" className="inline" onClick={() => onUpdateProgram(updateNode(program, node.id, (entry) => ({ ...entry, recruitRole: cycleRecruitRole(entry.type === 'TRAIN' ? entry.recruitRole : 'worker') })))}>{node.recruitRole}</button>}
          {node.type === 'TRAIN' && <span className="node-cost">cost: {trainCosts[node.recruitRole ?? 'worker']}</span>}
          {node.type === 'UPGRADE' && <span className="node-cost">cost: {getUpgradeCostLabel(selectedUnit.role, selectedUnit.level)}</span>}
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
          <ul>{renderProgram(node.children, onUpdateProgram, program, selectedUnit, canInsertHere, onInsertRequested, actionButtons, node.id, 'children')}</ul>
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
            <ul>{renderProgram(node.thenChildren, onUpdateProgram, program, selectedUnit, canInsertHere, onInsertRequested, actionButtons, node.id, 'then')}</ul>
            <div className="button-row tiny">
              {actionButtons.map(([label, factory]) => (
                <button key={`${node.id}-then-${label}`} type="button" disabled={!canInsertHere(node.id, 'then')} onClick={() => onInsertRequested(factory, node.id, 'then')}>
                  + {label}
                </button>
              ))}
            </div>
          </section>
          <section>
            <p>Else</p>
            <ul>{renderProgram(node.elseChildren, onUpdateProgram, program, selectedUnit, canInsertHere, onInsertRequested, actionButtons, node.id, 'else')}</ul>
            <div className="button-row tiny">
              {actionButtons.map(([label, factory]) => (
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
  const actionBudget = selectedUnit?.energy ?? 0
  const availableActionButtons = selectedUnit ? getActionButtonsForRole(selectedUnit.role) : []

  useEffect(() => {
    setLimitMessage(null)
  }, [selectedUnit?.id, selectedUnit?.program])

  const canInsertHere = (parentId?: string, branch: 'then' | 'else' | 'children' = 'children') => {
    if (!selectedUnit) return false
    return canInsertNode(selectedUnit.program, parentId, branch, actionBudget).allowed
  }

  const handleInsertNode = (factory: () => ProgramNode, parentId?: string, branch: 'then' | 'else' | 'children' = 'children') => {
    if (!selectedUnit) return
    const check = canInsertNode(selectedUnit.program, parentId, branch, actionBudget)
    if (!check.allowed) {
      setLimitMessage(check.reason ?? 'Cannot add more blocks here.')
      return
    }

    const candidate = insertNode(selectedUnit.program, factory(), parentId, branch)
    if (estimateProgramActionCount(candidate) > actionBudget) {
      setLimitMessage(`Action budget reached by energy: max ${actionBudget} queued actions for this robot right now.`)
      return
    }

    setLimitMessage(null)
    onUpdateProgram(candidate)
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
            <p>Battery: {selectedUnit.energy}</p>
            <p>Level: {selectedUnit.level}</p>
            <p>Owner: {game.players[selectedUnit.playerId].name}</p>
            <p className="muted">
              {selectedUnit.role === 'explorer'
                ? 'Explorer role: reveal fog quickly; higher levels reduce battery cost and can escape lower-level attackers.'
                : selectedUnit.role === 'attack'
                  ? 'Attack role: uses ATTACK to destroy nearby enemies; higher level wins against weaker defenders.'
                  : selectedUnit.role === 'defender'
                    ? 'Defender role: uses DEFEND to guard nearby allies; higher level can counter weaker attackers.'
                : 'Worker role: collect/build/train; higher levels recover battery faster each round.'}
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
            text="Each robot has role-specific actions plus common MOVE, UPGRADE, WAIT, and REPEAT. Worker: BUILD/COLLECT/TRAIN. Explorer: BUILD/COLLECT. Attack: ATTACK/TRAIN. Defender: DEFEND/TRAIN. TRAIN can create Worker, Explorer, Attack, or Defender units. UPGRADE uses resources to improve level effects. Queued action count cannot exceed current battery."
          />
        </h3>
        {selectedUnit ? (
          <>
            <ul className="code-tree">{renderProgram(selectedUnit.program, onUpdateProgram, selectedUnit.program, selectedUnit, canInsertHere, handleInsertNode, availableActionButtons)}</ul>
            <p className="muted">
              Block limits: {programStats?.totalNodes ?? 0}/{PROGRAM_LIMITS.maxTotalNodes} total, {programStats?.rootNodes ?? 0}/{PROGRAM_LIMITS.maxRootNodes} top-level, depth {programStats?.maxDepth ?? 0}/{PROGRAM_LIMITS.maxNestingDepth}, queued actions {estimateProgramActionCount(selectedUnit.program)}/{selectedUnit.energy} (energy).
            </p>
            <div className="button-row">
              {[...availableActionButtons, ...structuralButtons].map(([label, factory]) => (
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
