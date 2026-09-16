import { generateAiTurn } from '../ai/controllers'
import { createMap, getNeighbors, getTile, startingPositions, tileKey } from './map'
import type {
  BuildingState,
  BuildingType,
  GameMode,
  GameState,
  PlayerId,
  PlayerState,
  ProgramNode,
  ResourceType,
  RoundReport,
  TechType,
  Tile,
  UnitState,
  VictoryState,
} from './types'
import { collectTips, createSampleExplorerProgram, createSampleWorkerProgram, expandProgram, summarizeConcepts, validateProgram } from '../programming/commandSystem'

const buildingCosts: Record<BuildingType, Partial<Record<ResourceType, number>>> = {
  base: { wood: 0, energy: 0, crystal: 0, food: 0 },
  farm: { wood: 3, food: 1 },
  laboratory: { wood: 2, crystal: 3, energy: 2 },
  mine: { wood: 2, energy: 1 },
  workshop: { wood: 4, energy: 2 },
}

const techCosts: Record<TechType, Partial<Record<ResourceType, number>>> = {
  'basic-logic': {},
  conditions: { crystal: 3, energy: 3 },
  automation: { wood: 4, crystal: 4, energy: 4 },
}

const buildingYields: Record<BuildingType, Partial<Record<ResourceType, number>>> = {
  base: { energy: 2, food: 1 },
  farm: { food: 3 },
  laboratory: { energy: 2, crystal: 1 },
  mine: { crystal: 2 },
  workshop: { wood: 2, energy: 1 },
}

const baseResources = { wood: 8, energy: 8, crystal: 4, food: 8 }

function createPlayer(id: PlayerId, name: string, accent: string, emblem: string, isHuman: boolean, aiStyle?: PlayerState['aiStyle']): PlayerState {
  return {
    id,
    name,
    accent,
    emblem,
    isHuman,
    aiStyle,
    resources: { ...baseResources },
    researched: ['basic-logic'],
    pendingResearch: null,
    territory: [],
    revealed: [],
    score: 0,
    lastReason: [],
    conceptsUsed: ['Sequence'],
  }
}

function createUnits(): UnitState[] {
  return Object.entries(startingPositions).flatMap(([playerId, position]) => [
    {
      id: `${playerId}-worker`,
      playerId: playerId as PlayerId,
      name: 'Worker Robot',
      role: 'worker' as const,
      x: position.x,
      y: position.y,
      energy: 5,
      program: createSampleWorkerProgram(),
    },
    {
      id: `${playerId}-explorer`,
      playerId: playerId as PlayerId,
      name: 'Explorer Robot',
      role: 'explorer' as const,
      x: Math.max(0, position.x - (position.x > 5 ? 1 : -1)),
      y: position.y,
      energy: 5,
      program: createSampleExplorerProgram(),
    },
  ])
}

function createBuildings(): BuildingState[] {
  return Object.entries(startingPositions).map(([playerId, position]) => ({
    id: `${playerId}-base`,
    playerId: playerId as PlayerId,
    type: 'base',
    x: position.x,
    y: position.y,
  }))
}

function clone<T>(value: T): T {
  return structuredClone(value)
}

export function createInitialState(mode: GameMode): GameState {
  const players: Record<PlayerId, PlayerState> = {
    human: createPlayer('human', mode === 'multiplayer' ? 'Local Player' : 'You', '#7be495', '🟢', true),
    'explorer-ai': createPlayer('explorer-ai', 'Explorer', '#6fa8ff', '🔵', false, 'explorer'),
    'scientist-ai': createPlayer('scientist-ai', 'Scientist', '#cf88ff', '🟣', false, 'scientist'),
    'conqueror-ai': createPlayer('conqueror-ai', 'Conqueror', '#ffad70', '🟠', false, 'conqueror'),
  }

  const state: GameState = {
    mode,
    phase: 'planning',
    round: 1,
    maxRounds: 12,
    map: createMap(),
    players,
    units: createUnits(),
    buildings: createBuildings(),
    selectedUnitId: 'human-worker',
    report: {
      headline: '🧠 Planning Phase',
      details: ['Program your robots, plan a build, choose research, then end the round.'],
      tips: mode === 'tutorial' ? ['Tutorial: select your Worker Robot, then try the starter REPEAT program.'] : [],
    },
    winner: null,
    tutorialStep: mode === 'tutorial' ? 0 : -1,
    pendingMessages: [],
  }

  refreshVision(state)
  updateScores(state)
  return state
}

function canAfford(player: PlayerState, cost: Partial<Record<ResourceType, number>>) {
  return Object.entries(cost).every(([resource, amount]) => player.resources[resource as ResourceType] >= (amount ?? 0))
}

function spend(player: PlayerState, cost: Partial<Record<ResourceType, number>>) {
  for (const [resource, amount] of Object.entries(cost)) {
    player.resources[resource as ResourceType] -= amount ?? 0
  }
}

function gain(player: PlayerState, resource: ResourceType, amount: number) {
  player.resources[resource] += amount
}

function claimTile(state: GameState, playerId: PlayerId, x: number, y: number) {
  const player = state.players[playerId]
  const key = tileKey(x, y)
  if (!player.territory.includes(key)) player.territory.push(key)
}

function revealAround(state: GameState, playerId: PlayerId, x: number, y: number, radius = 1) {
  const player = state.players[playerId]
  for (let dy = -radius; dy <= radius; dy += 1) {
    for (let dx = -radius; dx <= radius; dx += 1) {
      const rx = x + dx
      const ry = y + dy
      const tile = getTile(state.map, rx, ry)
      if (!tile) continue
      const key = tileKey(rx, ry)
      if (!player.revealed.includes(key)) player.revealed.push(key)
    }
  }
}

function refreshVision(state: GameState) {
  for (const player of Object.values(state.players)) {
    player.revealed = []
    player.territory = []
  }
  for (const building of state.buildings) {
    claimTile(state, building.playerId, building.x, building.y)
    for (const point of getNeighbors(building.x, building.y)) {
      claimTile(state, building.playerId, point.x, point.y)
    }
    revealAround(state, building.playerId, building.x, building.y, 2)
  }
  for (const unit of state.units) {
    claimTile(state, unit.playerId, unit.x, unit.y)
    revealAround(state, unit.playerId, unit.x, unit.y, unit.role === 'explorer' ? 2 : 1)
  }
}

function moveUnit(state: GameState, unit: UnitState, direction: ProgramNode extends never ? never : 'NORTH' | 'SOUTH' | 'EAST' | 'WEST') {
  const delta = {
    NORTH: { x: 0, y: -1 },
    SOUTH: { x: 0, y: 1 },
    EAST: { x: 1, y: 0 },
    WEST: { x: -1, y: 0 },
  }[direction]
  const nextX = unit.x + delta.x
  const nextY = unit.y + delta.y
  const tile = getTile(state.map, nextX, nextY)
  if (!tile || tile.terrain === 'water') return `${unit.name} could not cross the river.`
  if (state.units.some((other) => other.id !== unit.id && other.x === nextX && other.y === nextY)) {
    return `${unit.name} was blocked by another robot.`
  }
  unit.x = nextX
  unit.y = nextY
  unit.energy = Math.max(0, unit.energy - (tile.terrain === 'mountain' ? 2 : 1))
  claimTile(state, unit.playerId, nextX, nextY)
  revealAround(state, unit.playerId, nextX, nextY, unit.role === 'explorer' ? 2 : 1)
  return `${unit.name} moved ${direction.toLowerCase()}.`
}

function collectAtTile(state: GameState, unit: UnitState) {
  const tile = getTile(state.map, unit.x, unit.y)
  if (!tile?.resource || tile.amount <= 0) return `${unit.name} found nothing to collect here.`
  tile.amount -= 1
  gain(state.players[unit.playerId], tile.resource, 2)
  if (tile.landmark === 'ruins') {
    gain(state.players[unit.playerId], 'energy', 1)
  }
  if (tile.landmark === 'village') {
    gain(state.players[unit.playerId], 'food', 1)
  }
  return `${unit.name} collected ${tile.resource}.`
}

function buildOnTile(state: GameState, unit: UnitState, type: BuildingType) {
  const player = state.players[unit.playerId]
  const tile = getTile(state.map, unit.x, unit.y)
  if (!tile || tile.terrain === 'water' || tile.terrain === 'mountain') {
    return `⚠️ ${unit.name} needs flatter land to build ${type}.`
  }
  if (!player.territory.includes(tileKey(unit.x, unit.y))) {
    return `⚠️ Claim this tile before building ${type}.`
  }
  if (state.buildings.some((building) => building.x === unit.x && building.y === unit.y)) {
    return `⚠️ A building already stands on this tile.`
  }
  const cost = buildingCosts[type]
  if (!canAfford(player, cost)) {
    return `⚠️ ${player.name} does not have enough resources to build ${type}.`
  }
  spend(player, cost)
  state.buildings.push({
    id: `${unit.playerId}-${type}-${state.round}-${state.buildings.length}`,
    playerId: unit.playerId,
    type,
    x: unit.x,
    y: unit.y,
  })
  return `${unit.name} built a ${type}.`
}

function applyResearch(state: GameState, playerId: PlayerId, details: string[]) {
  const player = state.players[playerId]
  const tech = player.pendingResearch
  if (!tech || player.researched.includes(tech)) return
  if (!canAfford(player, techCosts[tech])) {
    details.push(`${player.name} could not afford ${tech}.`)
    return
  }
  spend(player, techCosts[tech])
  player.researched.push(tech)
  player.pendingResearch = null
  details.push(`${player.name} researched ${tech}.`)
}

function applyBuildingYields(state: GameState, details: string[]) {
  for (const building of state.buildings) {
    const player = state.players[building.playerId]
    const yields = buildingYields[building.type]
    for (const [resource, amount] of Object.entries(yields)) {
      gain(player, resource as ResourceType, amount ?? 0)
    }
  }
  details.push('Buildings generated fresh resources for every civilization.')
}

function scorePlayer(player: PlayerState) {
  const resourceTotal = Object.values(player.resources).reduce((total, amount) => total + amount, 0)
  return resourceTotal + player.territory.length * 2 + player.researched.length * 8 + player.conceptsUsed.length * 5
}

function updateScores(state: GameState) {
  for (const player of Object.values(state.players)) {
    player.score = scorePlayer(player)
  }
}

function detectVictory(state: GameState): VictoryState | null {
  const players = Object.values(state.players)
  const expansionWinner = players.find((player) => player.territory.length >= 24)
  if (expansionWinner) {
    return {
      winnerId: expansionWinner.id,
      type: 'expansion',
      summary: `${expansionWinner.name} spread across the map and secured an expansion victory.`,
    }
  }
  const scienceWinner = players.find((player) => player.researched.includes('conditions') && player.researched.includes('automation'))
  if (scienceWinner) {
    return {
      winnerId: scienceWinner.id,
      type: 'science',
      summary: `${scienceWinner.name} completed the logic tech path first.`,
    }
  }
  const economicWinner = players.find((player) => Object.values(player.resources).reduce((sum, value) => sum + value, 0) >= 70)
  if (economicWinner) {
    return {
      winnerId: economicWinner.id,
      type: 'economic',
      summary: `${economicWinner.name} built the strongest economy.`,
    }
  }
  const programmingWinner = players.find((player) => player.conceptsUsed.includes('Loops') && player.conceptsUsed.includes('Conditions') && player.resources.energy >= 18)
  if (programmingWinner) {
    return {
      winnerId: programmingWinner.id,
      type: 'programming',
      summary: `${programmingWinner.name} won by mastering strategic programming.`,
    }
  }
  if (state.round > state.maxRounds) {
    const sorted = [...players].sort((left, right) => right.score - left.score)
    return {
      winnerId: sorted[0].id,
      type: 'score',
      summary: `${sorted[0].name} finishes ahead on territory, science, and economy.`,
    }
  }
  return null
}

export function queueResearch(state: GameState, playerId: PlayerId, tech: TechType) {
  const next = clone(state)
  const player = next.players[playerId]
  player.pendingResearch = player.researched.includes(tech) ? null : tech
  next.pendingMessages = [`${player.name} prepared ${tech} for the next execution phase.`]
  return next
}

export function updateUnitProgram(state: GameState, unitId: string, program: ProgramNode[]) {
  const next = clone(state)
  const unit = next.units.find((entry) => entry.id === unitId)
  if (!unit) return state
  unit.program = program
  next.players[unit.playerId].conceptsUsed = summarizeConcepts(program)
  return next
}

export function selectUnit(state: GameState, unitId: string | null) {
  return { ...state, selectedUnitId: unitId }
}

export function validateSelectedProgram(state: GameState) {
  const unit = state.units.find((entry) => entry.id === state.selectedUnitId)
  if (!unit) return []
  return validateProgram(unit.program, state.players[unit.playerId], unit)
}

export function advanceTutorial(state: GameState) {
  if (state.mode !== 'tutorial') return state
  const next = clone(state)
  next.tutorialStep += 1
  return next
}

export function executeRound(current: GameState) {
  const state = clone(current)
  state.phase = 'execution'
  const report: RoundReport = {
    headline: '⚙️ Execution Phase',
    details: [],
    tips: [],
  }

  for (const playerId of ['explorer-ai', 'scientist-ai', 'conqueror-ai'] as const) {
    const decision = generateAiTurn(playerId, state)
    for (const [unitId, program] of decision.updates.entries()) {
      const unit = state.units.find((entry) => entry.id === unitId)
      if (unit) {
        unit.program = program
        state.players[playerId].conceptsUsed = Array.from(new Set([...state.players[playerId].conceptsUsed, ...summarizeConcepts(program)]))
      }
    }
    state.players[playerId].lastReason = decision.reason
    if (decision.research && !state.players[playerId].researched.includes(decision.research)) {
      state.players[playerId].pendingResearch = decision.research
    }
  }

  for (const unit of state.units) {
    const errors = validateProgram(unit.program, state.players[unit.playerId], unit)
    if (errors.length > 0) {
      report.details.push(errors[0])
      continue
    }
    const actions = expandProgram(unit.program, unit, state)
    if (unit.playerId === 'human') {
      report.tips.push(...collectTips(unit.program))
    }
    for (const action of actions) {
      if (action.type === 'MOVE' && action.direction) report.details.push(moveUnit(state, unit, action.direction))
      if (action.type === 'COLLECT') report.details.push(collectAtTile(state, unit))
      if (action.type === 'BUILD' && action.buildingType) report.details.push(buildOnTile(state, unit, action.buildingType))
      if (action.type === 'WAIT') {
        unit.energy = Math.min(6, unit.energy + 1)
        report.details.push(`${unit.name} waited to recharge.`)
      }
    }
    unit.energy = Math.min(6, unit.energy + 1)
  }

  for (const playerId of Object.keys(state.players) as PlayerId[]) {
    applyResearch(state, playerId, report.details)
  }
  applyBuildingYields(state, report.details)
  refreshVision(state)
  updateScores(state)
  state.round += 1
  state.winner = detectVictory(state)
  state.phase = state.winner ? 'results' : 'planning'
  report.headline = state.winner ? '🏆 Game Complete' : '✨ Round Complete'
  if (state.winner) {
    report.details.unshift(state.winner.summary)
  }
  if (!state.winner) {
    report.details.unshift(`Round ${state.round - 1} finished. Round ${state.round} is ready.`)
  }
  state.report = {
    ...report,
    tips: Array.from(new Set(report.tips)),
  }
  state.pendingMessages = []
  return state
}

export function getSelectedUnit(state: GameState) {
  return state.units.find((unit) => unit.id === state.selectedUnitId) ?? null
}

export function getTileSummary(tile: Tile, state: GameState) {
  const building = state.buildings.find((entry) => entry.x === tile.x && entry.y === tile.y)
  const units = state.units.filter((entry) => entry.x === tile.x && entry.y === tile.y)
  return { building, units }
}
