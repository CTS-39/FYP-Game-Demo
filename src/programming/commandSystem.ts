import { getNeighbors, getTile, tileKey } from '../game/map'
import type {
  ActionNode,
  BuildingType,
  ConditionType,
  Direction,
  GameState,
  IfNode,
  PlayerState,
  ProgramNode,
  RepeatNode,
  ResolvedAction,
  UnitState,
} from '../game/types'

let nextNodeId = 0

const directions: Direction[] = ['NORTH', 'EAST', 'SOUTH', 'WEST']
const buildingTypes: BuildingType[] = ['farm', 'laboratory', 'mine', 'workshop']
const conditions: ConditionType[] = ['ON_RESOURCE', 'UNEXPLORED_NEARBY', 'HAS_LOW_ENERGY', 'HAS_CRYSTAL']

export const commandHelp: Record<string, string> = {
  MOVE: 'Move your robot one tile.',
  COLLECT: 'Gather the resource on the current tile.',
  BUILD: 'Construct a building on a claimed tile.',
  WAIT: 'Save energy and skip this step.',
  REPEAT: 'Use a loop to repeat actions.',
  IF: 'Use a condition so a robot can make a choice.',
}

export function createNodeId() {
  nextNodeId += 1
  return `node-${nextNodeId}`
}

export function createActionNode(type: ActionNode['type']): ActionNode {
  return {
    id: createNodeId(),
    type,
    direction: type === 'MOVE' ? 'NORTH' : undefined,
    buildingType: type === 'BUILD' ? 'farm' : undefined,
  }
}

export function createRepeatNode(): RepeatNode {
  return {
    id: createNodeId(),
    type: 'REPEAT',
    times: 2,
    children: [createActionNode('MOVE')],
  }
}

export function createIfNode(): IfNode {
  return {
    id: createNodeId(),
    type: 'IF',
    condition: 'ON_RESOURCE',
    thenChildren: [createActionNode('COLLECT')],
    elseChildren: [createActionNode('MOVE')],
  }
}

export function createSampleWorkerProgram() {
  return [
    {
      id: createNodeId(),
      type: 'REPEAT' as const,
      times: 3,
      children: [
        { id: createNodeId(), type: 'MOVE' as const, direction: 'NORTH' as const },
        { id: createNodeId(), type: 'COLLECT' as const },
      ],
    },
  ]
}

export function createSampleExplorerProgram() {
  return [
    { id: createNodeId(), type: 'MOVE' as const, direction: 'EAST' as const },
    { id: createNodeId(), type: 'MOVE' as const, direction: 'NORTH' as const },
    { id: createNodeId(), type: 'COLLECT' as const },
  ]
}

export function validateProgram(program: ProgramNode[], player: PlayerState, unit: UnitState) {
  const messages: string[] = []

  if (program.length === 0) {
    messages.push(`⚠️ ${unit.name} needs at least one command before the round starts.`)
  }

  const visit = (nodes: ProgramNode[]) => {
    for (const node of nodes) {
      if (node.type === 'REPEAT') {
        if (node.children.length === 0) {
          messages.push("⚠️ Your robot doesn't know what to repeat yet. Add a command inside the REPEAT block.")
        }
        visit(node.children)
      }
      if (node.type === 'IF') {
        if (!player.researched.includes('conditions')) {
          messages.push('⚠️ Research Conditions before using IF / ELSE blocks.')
        }
        if (node.thenChildren.length === 0) {
          messages.push('⚠️ Add a command to the IF branch so your robot knows what to do.')
        }
        visit(node.thenChildren)
        visit(node.elseChildren)
      }
    }
  }

  visit(program)
  return Array.from(new Set(messages))
}

export function expandProgram(program: ProgramNode[], unit: UnitState, state: GameState) {
  const actions: ResolvedAction[] = []

  const walk = (nodes: ProgramNode[]) => {
    for (const node of nodes) {
      if (actions.length >= 8) return
      if (node.type === 'REPEAT') {
        for (let index = 0; index < node.times; index += 1) {
          walk(node.children)
        }
        continue
      }
      if (node.type === 'IF') {
        const branch = evaluateCondition(node.condition, unit, state) ? node.thenChildren : node.elseChildren
        walk(branch)
        continue
      }
      actions.push({
        unitId: unit.id,
        playerId: unit.playerId,
        type: node.type,
        direction: node.direction,
        buildingType: node.buildingType,
      })
    }
  }

  walk(program)
  return actions
}

export function evaluateCondition(condition: ConditionType, unit: UnitState, state: GameState) {
  if (condition === 'ON_RESOURCE') {
    const tile = getTile(state.map, unit.x, unit.y)
    return Boolean(tile?.resource && tile.amount > 0)
  }
  if (condition === 'HAS_LOW_ENERGY') {
    return unit.energy <= 2
  }
  if (condition === 'HAS_CRYSTAL') {
    return state.players[unit.playerId].resources.crystal >= 4
  }
  return getNeighbors(unit.x, unit.y).some((point) => !state.players[unit.playerId].revealed.includes(tileKey(point.x, point.y)))
}

export function summarizeConcepts(program: ProgramNode[]) {
  const concepts = new Set<string>(['Sequence'])
  const visit = (nodes: ProgramNode[]) => {
    for (const node of nodes) {
      if (node.type === 'REPEAT') {
        concepts.add('Loops')
        visit(node.children)
      }
      if (node.type === 'IF') {
        concepts.add('Conditions')
        visit(node.thenChildren)
        visit(node.elseChildren)
      }
    }
  }
  visit(program)
  return Array.from(concepts)
}

export function collectTips(program: ProgramNode[]) {
  const tips: string[] = []
  const concepts = summarizeConcepts(program)
  if (concepts.includes('Loops')) {
    tips.push('💡 Nice! You used a loop to repeat actions instead of writing them again and again.')
  }
  if (concepts.includes('Conditions')) {
    tips.push('💡 Conditional logic lets your robot react to the world instead of following only one path.')
  }
  return tips
}

export function cycleDirection(direction: Direction | undefined) {
  const current = directions.indexOf(direction ?? 'NORTH')
  return directions[(current + 1) % directions.length]
}

export function cycleBuildingType(type: BuildingType | undefined) {
  const current = buildingTypes.indexOf(type ?? 'farm')
  return buildingTypes[(current + 1) % buildingTypes.length]
}

export function cycleCondition(condition: ConditionType) {
  const current = conditions.indexOf(condition)
  return conditions[(current + 1) % conditions.length]
}

export function insertNode(
  nodes: ProgramNode[],
  newNode: ProgramNode,
  parentId?: string,
  branch: 'then' | 'else' | 'children' = 'children',
): ProgramNode[] {
  if (!parentId) return [...nodes, newNode]
  return nodes.map((node) => {
    if (node.id === parentId && node.type === 'REPEAT' && branch === 'children') {
      return { ...node, children: [...node.children, newNode] }
    }
    if (node.id === parentId && node.type === 'IF') {
      if (branch === 'then') return { ...node, thenChildren: [...node.thenChildren, newNode] }
      if (branch === 'else') return { ...node, elseChildren: [...node.elseChildren, newNode] }
    }
    if (node.type === 'REPEAT') return { ...node, children: insertNode(node.children, newNode, parentId, branch) }
    if (node.type === 'IF') {
      return {
        ...node,
        thenChildren: insertNode(node.thenChildren, newNode, parentId, branch),
        elseChildren: insertNode(node.elseChildren, newNode, parentId, branch),
      }
    }
    return node
  })
}

export function updateNode(nodes: ProgramNode[], nodeId: string, updater: (node: ProgramNode) => ProgramNode): ProgramNode[] {
  return nodes.map((node) => {
    if (node.id === nodeId) return updater(node)
    if (node.type === 'REPEAT') return { ...node, children: updateNode(node.children, nodeId, updater) }
    if (node.type === 'IF') {
      return {
        ...node,
        thenChildren: updateNode(node.thenChildren, nodeId, updater),
        elseChildren: updateNode(node.elseChildren, nodeId, updater),
      }
    }
    return node
  })
}

export function removeNode(nodes: ProgramNode[], nodeId: string): ProgramNode[] {
  return nodes
    .filter((node) => node.id !== nodeId)
    .map((node) => {
      if (node.type === 'REPEAT') return { ...node, children: removeNode(node.children, nodeId) }
      if (node.type === 'IF') {
        return {
          ...node,
          thenChildren: removeNode(node.thenChildren, nodeId),
          elseChildren: removeNode(node.elseChildren, nodeId),
        }
      }
      return node
    })
}

function reorderList<T extends { id: string }>(items: T[], itemId: string, delta: number) {
  const index = items.findIndex((item) => item.id === itemId)
  if (index < 0) return items
  const nextIndex = index + delta
  if (nextIndex < 0 || nextIndex >= items.length) return items
  const clone = [...items]
  const [item] = clone.splice(index, 1)
  clone.splice(nextIndex, 0, item)
  return clone
}

export function moveNode(nodes: ProgramNode[], nodeId: string, delta: number): ProgramNode[] {
  const direct = reorderList(nodes, nodeId, delta)
  if (direct !== nodes) return direct
  return nodes.map((node) => {
    if (node.type === 'REPEAT') return { ...node, children: moveNode(node.children, nodeId, delta) }
    if (node.type === 'IF') {
      return {
        ...node,
        thenChildren: moveNode(node.thenChildren, nodeId, delta),
        elseChildren: moveNode(node.elseChildren, nodeId, delta),
      }
    }
    return node
  })
}
