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
  UnitRole,
  UnitState,
  VictoryState,
} from './types'
import { collectTips, expandProgram, summarizeConcepts, validateProgram } from '../programming/commandSystem'

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

const recruitCosts: Record<UnitRole, Partial<Record<ResourceType, number>>> = {
  worker: { wood: 2, energy: 2, crystal: 1, food: 2 },
  explorer: { wood: 2, energy: 2, crystal: 1, food: 1 },
  attack: { wood: 3, energy: 2, crystal: 2, food: 1 },
  defender: { wood: 3, energy: 3, crystal: 1, food: 2 },
}

const maxUnitLevel = 3

const upgradeBaseCosts: Record<UnitRole, Partial<Record<ResourceType, number>>> = {
  worker: { wood: 2, energy: 2, crystal: 1, food: 2 },
  explorer: { wood: 1, energy: 2, crystal: 2, food: 1 },
  attack: { wood: 2, energy: 2, crystal: 2, food: 1 },
  defender: { wood: 2, energy: 3, crystal: 1, food: 1 },
}

const unitEnergyProfile: Record<UnitRole, { start: number; max: number; trainLimit: number }> = {
  worker: { start: 7, max: 8, trainLimit: 4 },
  explorer: { start: 5, max: 6, trainLimit: 3 },
  attack: { start: 4, max: 5, trainLimit: 2 },
  defender: { start: 6, max: 7, trainLimit: 2 },
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
      level: 1,
      x: position.x,
      y: position.y,
      energy: unitEnergyProfile.worker.start,
      trainingsUsed: 0,
      isDefending: false,
      program: [{ id: `${playerId}-worker-start-wait`, type: 'WAIT' }],
    },
    {
      id: `${playerId}-explorer`,
      playerId: playerId as PlayerId,
      name: 'Explorer Robot',
      role: 'explorer' as const,
      level: 1,
      x: Math.max(0, position.x - (position.x > 5 ? 1 : -1)),
      y: position.y,
      energy: unitEnergyProfile.explorer.start,
      trainingsUsed: 0,
      isDefending: false,
      program: [{ id: `${playerId}-explorer-start-wait`, type: 'WAIT' }],
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
    maxRounds: mode === 'vs-ai' ? 18 : 12,
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

function moveUnit(state: GameState, unit: UnitState, direction: import('./types').Direction) {
  const directionLabel = {
    NORTH: 'up',
    SOUTH: 'down',
    EAST: 'right',
    WEST: 'left',
  }[direction]
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
  const explorerDiscount = unit.role === 'explorer' ? Math.max(0, unit.level - 1) : 0
  const energyCost = Math.max(0, (tile.terrain === 'mountain' ? 2 : 1) - explorerDiscount)
  if (unit.energy < energyCost) {
    return `${unit.name} is too low on energy to move ${directionLabel}.`
  }
  if (state.units.some((other) => other.id !== unit.id && other.x === nextX && other.y === nextY)) {
    return `${unit.name} was blocked by another robot.`
  }
  unit.x = nextX
  unit.y = nextY
  unit.energy = Math.max(0, unit.energy - energyCost)
  claimTile(state, unit.playerId, nextX, nextY)
  revealAround(state, unit.playerId, nextX, nextY, unit.role === 'explorer' ? 2 : 1)
  return `${unit.name} moved ${directionLabel}.`
}

function collectAtTile(state: GameState, unit: UnitState) {
  const energyCost = unit.role === 'explorer' ? Math.max(0, 1 - Math.max(0, unit.level - 1)) : 1
  if (unit.energy < energyCost) return `${unit.name} is too low on energy to collect.`
  const tile = getTile(state.map, unit.x, unit.y)
  if (!tile?.resource || tile.amount <= 0) return `${unit.name} found nothing to collect here.`
  unit.energy = Math.max(0, unit.energy - energyCost)
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
  const energyCost = unit.role === 'explorer' ? Math.max(0, 2 - Math.max(0, unit.level - 1)) : 2
  if (unit.energy < energyCost) {
    return `⚠️ ${unit.name} needs at least 2 energy to build ${type}.`
  }
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
  unit.energy = Math.max(0, unit.energy - energyCost)
  state.buildings.push({
    id: `${unit.playerId}-${type}-${state.round}-${state.buildings.length}`,
    playerId: unit.playerId,
    type,
    x: unit.x,
    y: unit.y,
  })
  return `${unit.name} built a ${type}.`
}

function createUnitName(role: UnitRole) {
  if (role === 'worker') return 'Worker Robot'
  if (role === 'explorer') return 'Explorer Robot'
  if (role === 'attack') return 'Attack Robot'
  return 'Defender Robot'
}

function getUpgradeCost(unit: UnitState): Partial<Record<ResourceType, number>> {
  const base = upgradeBaseCosts[unit.role]
  const multiplier = unit.level
  return {
    wood: (base.wood ?? 0) + (multiplier - 1),
    energy: (base.energy ?? 0) + (multiplier - 1),
    crystal: (base.crystal ?? 0) + (multiplier - 1),
    food: (base.food ?? 0) + (multiplier - 1),
  }
}

function upgradeUnit(state: GameState, unit: UnitState) {
  if (unit.level >= maxUnitLevel) {
    return `⚠️ ${unit.name} is already at max level.`
  }
  if (unit.energy < 1) {
    return `⚠️ ${unit.name} needs at least 1 energy to upgrade.`
  }
  const player = state.players[unit.playerId]
  const cost = getUpgradeCost(unit)
  if (!canAfford(player, cost)) {
    return `⚠️ ${player.name} lacks resources to upgrade ${unit.name}.`
  }
  spend(player, cost)
  unit.energy = Math.max(0, unit.energy - 1)
  unit.level += 1
  return `${unit.name} upgraded to level ${unit.level}.`
}

function trainUnit(state: GameState, unit: UnitState, recruitRole: UnitRole) {
  if (!['worker', 'explorer', 'attack', 'defender'].includes(unit.role)) {
    return `⚠️ ${unit.name} cannot train units.`
  }
  if (unit.trainingsUsed >= unitEnergyProfile[unit.role].trainLimit) {
    return `⚠️ ${unit.name} reached its training limit (${unitEnergyProfile[unit.role].trainLimit}).`
  }
  if (unit.energy < 2) {
    return `⚠️ ${unit.name} needs at least 2 energy to train a ${createUnitName(recruitRole)}.`
  }
  const player = state.players[unit.playerId]
  const cost = recruitCosts[recruitRole]
  if (!canAfford(player, cost)) {
    return `⚠️ ${player.name} does not have enough resources to train a ${createUnitName(recruitRole)}.`
  }
  const sameTileUnits = state.units.filter((entry) => entry.playerId === unit.playerId && entry.x === unit.x && entry.y === unit.y)
  if (sameTileUnits.length >= 3) {
    return `⚠️ Tile is too crowded to train another robot here.`
  }

  spend(player, cost)
  unit.energy = Math.max(0, unit.energy - 2)
  unit.trainingsUsed += 1

  const id = `${unit.playerId}-${recruitRole}-${state.round}-${state.units.length}`
  const profile = unitEnergyProfile[recruitRole]
  state.units.push({
    id,
    playerId: unit.playerId,
    name: createUnitName(recruitRole),
    role: recruitRole,
    level: 1,
    x: unit.x,
    y: unit.y,
    energy: profile.start,
    trainingsUsed: 0,
    isDefending: false,
    program: [{ id: `seed-${id}`, type: 'WAIT' }],
  })

  return `${unit.name} trained a ${createUnitName(recruitRole)}.`
}

function manhattan(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y)
}

function findProtectingDefender(state: GameState, target: UnitState) {
  return state.units.find(
    (entry) => entry.playerId === target.playerId && entry.role === 'defender' && entry.isDefending && entry.energy > 0 && manhattan(entry, target) <= 1,
  )
}

function findProtectingDefenderOnTile(state: GameState, playerId: PlayerId, x: number, y: number) {
  return state.units.find(
    (entry) => entry.playerId === playerId && entry.role === 'defender' && entry.isDefending && entry.energy > 0 && manhattan(entry, { x, y }) <= 1,
  )
}

function defend(state: GameState, unit: UnitState) {
  if (unit.role !== 'defender') return `⚠️ ${unit.name} cannot use DEFEND.`
  if (unit.energy < 1) return `${unit.name} is too low on energy to defend.`
  unit.energy = Math.max(0, unit.energy - 1)
  unit.isDefending = true
  return `${unit.name} is defending nearby allies.`
}

function attack(state: GameState, unit: UnitState) {
  if (unit.role !== 'attack') return `⚠️ ${unit.name} cannot use ATTACK.`
  if (unit.energy < 2) return `${unit.name} is too low on energy to attack.`

  const nearbyEnemies = state.units.filter((entry) => entry.playerId !== unit.playerId && manhattan(entry, unit) <= 1)
  const nearbyEnemyBases = state.buildings.filter((building) => building.type === 'base' && building.playerId !== unit.playerId && manhattan(building, unit) <= 1)
  if (nearbyEnemies.length === 0 && nearbyEnemyBases.length === 0) return `${unit.name} found no nearby enemy to attack.`

  const priorityOrder: Record<UnitRole, number> = {
    attack: 4,
    worker: 3,
    explorer: 2,
    defender: 1,
  }
  nearbyEnemies.sort((left, right) => priorityOrder[right.role] - priorityOrder[left.role])
  const target = nearbyEnemies[0]

  if (!target) {
    const baseTarget = nearbyEnemyBases[0]
    const baseDefender = findProtectingDefenderOnTile(state, baseTarget.playerId, baseTarget.x, baseTarget.y)
    if (baseDefender) {
      if (unit.level > baseDefender.level) {
        unit.energy = Math.max(0, unit.energy - 2)
        state.units = state.units.filter((entry) => entry.id !== baseDefender.id)
        return `${unit.name} overpowered ${baseDefender.name} while attacking a base.`
      }
      if (baseDefender.level > unit.level) {
        baseDefender.energy = Math.max(0, baseDefender.energy - 1)
        state.units = state.units.filter((entry) => entry.id !== unit.id)
        return `${baseDefender.name} countered and destroyed ${unit.name} while defending a base.`
      }
      baseDefender.energy = Math.max(0, baseDefender.energy - 1)
      unit.energy = Math.max(0, unit.energy - 1)
      return `${baseDefender.name} blocked ${unit.name}'s base attack.`
    }

    unit.energy = Math.max(0, unit.energy - 2)
    state.buildings = state.buildings.filter((building) => building.id !== baseTarget.id)
    const defeatedName = state.players[baseTarget.playerId].name
    return `${unit.name} destroyed ${defeatedName}'s base.`
  }

  if (target.role === 'explorer' && target.level > unit.level) {
    unit.energy = Math.max(0, unit.energy - 1)
    return `${target.name} escaped ${unit.name}'s attack thanks to higher level mobility.`
  }

  const defender = findProtectingDefender(state, target)
  if (defender && defender.id !== target.id) {
    if (unit.level > defender.level) {
      unit.energy = Math.max(0, unit.energy - 2)
      state.units = state.units.filter((entry) => entry.id !== defender.id)
      return `${unit.name} overpowered and destroyed ${defender.name}.`
    }
    if (defender.level > unit.level) {
      defender.energy = Math.max(0, defender.energy - 1)
      state.units = state.units.filter((entry) => entry.id !== unit.id)
      return `${defender.name} countered and destroyed ${unit.name}.`
    }
    defender.energy = Math.max(0, defender.energy - 1)
    unit.energy = Math.max(0, unit.energy - 1)
    return `${defender.name} blocked ${unit.name}; same level stalemate.`
  }

  if (target.role === 'attack') {
    if (unit.level === target.level) {
      state.units = state.units.filter((entry) => entry.id !== unit.id && entry.id !== target.id)
      return `${unit.name} and ${target.name} destroyed each other in equal-level combat.`
    }
    if (unit.level < target.level) {
      state.units = state.units.filter((entry) => entry.id !== unit.id)
      return `${target.name} repelled and destroyed ${unit.name}.`
    }
  }

  unit.energy = Math.max(0, unit.energy - 2)
  state.units = state.units.filter((entry) => entry.id !== target.id)
  return `${unit.name} destroyed ${target.name}.`
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

function refreshPlayerConcepts(state: GameState, playerId: PlayerId) {
  const concepts = new Set<string>(['Sequence'])
  for (const unit of state.units.filter((entry) => entry.playerId === playerId)) {
    for (const concept of summarizeConcepts(unit.program)) {
      concepts.add(concept)
    }
  }
  state.players[playerId].conceptsUsed = Array.from(concepts)
}

function refreshAllConcepts(state: GameState) {
  for (const playerId of Object.keys(state.players) as PlayerId[]) {
    refreshPlayerConcepts(state, playerId)
  }
}

function detectVictory(state: GameState): VictoryState | null {
  const players = Object.values(state.players)
  const activeBaseOwners = new Set(
    state.buildings
      .filter((building) => building.type === 'base')
      .map((building) => building.playerId),
  )

  if (activeBaseOwners.size === 1) {
    const winnerId = Array.from(activeBaseOwners)[0]
    const winner = state.players[winnerId]
    return {
      winnerId,
      type: 'expansion',
      summary: `${winner.name} wins by elimination after all rival bases were destroyed.`,
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
  refreshPlayerConcepts(next, unit.playerId)
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
  for (const unit of state.units) {
    unit.isDefending = false
  }
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
      }
    }
    state.players[playerId].lastReason = decision.reason
    if (decision.research && !state.players[playerId].researched.includes(decision.research)) {
      state.players[playerId].pendingResearch = decision.research
    }
  }

  const unitOrder = state.units.map((unit) => unit.id)
  for (const unitId of unitOrder) {
    const unit = state.units.find((entry) => entry.id === unitId)
    if (!unit) continue
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
      if (action.type === 'TRAIN' && action.recruitRole) report.details.push(trainUnit(state, unit, action.recruitRole))
      if (action.type === 'UPGRADE') report.details.push(upgradeUnit(state, unit))
      if (action.type === 'ATTACK') report.details.push(attack(state, unit))
      if (action.type === 'DEFEND') report.details.push(defend(state, unit))
      if (action.type === 'WAIT') report.details.push(`${unit.name} waited to recharge.`)
    }
    const rechargeBoost = unit.role === 'worker' ? Math.max(0, unit.level - 1) : 0
    unit.energy = Math.min(unitEnergyProfile[unit.role].max, unit.energy + 1 + rechargeBoost)
  }

  for (const playerId of Object.keys(state.players) as PlayerId[]) {
    applyResearch(state, playerId, report.details)
  }
  applyBuildingYields(state, report.details)
  refreshVision(state)
  refreshAllConcepts(state)
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
