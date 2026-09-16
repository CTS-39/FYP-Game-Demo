import { getTile, tileKey } from '../game/map'
import type { GameState, PlayerId, ProgramNode, TechType, UnitState } from '../game/types'
import { createActionNode, createIfNode, createSampleExplorerProgram, createRepeatNode } from '../programming/commandSystem'

const directionTo = (from: { x: number; y: number }, to: { x: number; y: number }) => {
  if (to.x > from.x) return 'EAST'
  if (to.x < from.x) return 'WEST'
  if (to.y > from.y) return 'SOUTH'
  return 'NORTH'
}

function nearestTarget(unit: UnitState, state: GameState, predicate: (x: number, y: number) => boolean) {
  let best: { x: number; y: number; distance: number } | null = null
  for (let y = 0; y < state.map.length; y += 1) {
    for (let x = 0; x < state.map[y].length; x += 1) {
      if (!predicate(x, y)) continue
      const distance = Math.abs(unit.x - x) + Math.abs(unit.y - y)
      if (!best || distance < best.distance) best = { x, y, distance }
    }
  }
  return best
}

function buildExplorerProgram(unit: UnitState, state: GameState): ProgramNode[] {
  const player = state.players[unit.playerId]
  const hidden = nearestTarget(unit, state, (x, y) => !player.revealed.includes(tileKey(x, y)))
  if (hidden) {
    return [
      {
        ...createRepeatNode(),
        times: 2,
        children: [{ ...createActionNode('MOVE'), direction: directionTo(unit, hidden) }],
      },
      createActionNode('COLLECT'),
    ]
  }
  return createSampleExplorerProgram()
}

function buildScientistProgram(unit: UnitState, state: GameState): ProgramNode[] {
  const crystal = nearestTarget(unit, state, (x, y) => getTile(state.map, x, y)?.resource === 'crystal')
  const direction = crystal ? directionTo(unit, crystal) : 'WEST'
  const collector = createIfNode()
  collector.condition = 'ON_RESOURCE'
  collector.elseChildren = [{ ...createActionNode('MOVE'), direction }]
  return [collector]
}

function buildConquerorProgram(unit: UnitState, state: GameState): ProgramNode[] {
  const enemyBase = nearestTarget(unit, state, (x, y) => state.buildings.some((building) => building.type === 'base' && building.playerId !== unit.playerId && building.x === x && building.y === y))
  const direction = enemyBase ? directionTo(unit, enemyBase) : 'SOUTH'
  return [
    {
      ...createRepeatNode(),
      times: 2,
      children: [{ ...createActionNode('MOVE'), direction }],
    },
    createActionNode('COLLECT'),
  ]
}

export function generateAiTurn(playerId: PlayerId, state: GameState): {
  updates: Map<string, ProgramNode[]>
  reason: string[]
  research: TechType | null
} {
  const player = state.players[playerId]
  const updates = new Map<string, ProgramNode[]>()
  const units = state.units.filter((unit) => unit.playerId === playerId)

  for (const unit of units) {
    if (player.aiStyle === 'explorer') updates.set(unit.id, buildExplorerProgram(unit, state))
    if (player.aiStyle === 'scientist') updates.set(unit.id, buildScientistProgram(unit, state))
    if (player.aiStyle === 'conqueror') updates.set(unit.id, buildConquerorProgram(unit, state))
  }

  const reasons = {
    explorer: ['An unexplored area was nearby.', 'The route had low movement cost.', 'Exploration may reveal fresh resources.'],
    scientist: ['Crystal and village tiles fuel research.', 'A condition block makes the robot react intelligently.', 'More science means faster tech unlocks.'],
    conqueror: ['Territory near rival bases is strategic.', 'Short loops help the unit advance quickly.', 'Claiming space makes it harder for opponents to grow.'],
  }

  return {
    updates,
    reason: player.aiStyle ? reasons[player.aiStyle] : [],
    research: player.aiStyle === 'scientist' ? 'conditions' : player.aiStyle === 'conqueror' ? null : 'automation',
  }
}
