export type PlayerId = 'human' | 'explorer-ai' | 'scientist-ai' | 'conqueror-ai'
export type TerrainType = 'plains' | 'forest' | 'mountain' | 'water' | 'crystal' | 'village' | 'ruins'
export type ResourceType = 'wood' | 'energy' | 'crystal' | 'food'
export type BuildingType = 'base' | 'farm' | 'laboratory' | 'mine' | 'workshop'
export type UnitRole = 'worker' | 'explorer'
export type Direction = 'NORTH' | 'SOUTH' | 'EAST' | 'WEST'
export type GameMode = 'quick' | 'vs-ai' | 'multiplayer' | 'tutorial'
export type TechType = 'basic-logic' | 'conditions' | 'automation'
export type ConditionType = 'ON_RESOURCE' | 'HAS_LOW_ENERGY' | 'UNEXPLORED_NEARBY' | 'HAS_CRYSTAL'
export type Phase = 'planning' | 'execution' | 'results'
export type VictoryType = 'expansion' | 'science' | 'economic' | 'programming' | 'score'

export interface Tile {
  x: number
  y: number
  terrain: TerrainType
  resource: ResourceType | null
  amount: number
  landmark?: 'village' | 'ruins'
}

export interface PlayerState {
  id: PlayerId
  name: string
  accent: string
  emblem: string
  isHuman: boolean
  aiStyle?: 'explorer' | 'scientist' | 'conqueror'
  resources: Record<ResourceType, number>
  researched: TechType[]
  pendingResearch: TechType | null
  territory: string[]
  revealed: string[]
  score: number
  lastReason: string[]
  conceptsUsed: string[]
}

export interface UnitState {
  id: string
  playerId: PlayerId
  name: string
  role: UnitRole
  x: number
  y: number
  energy: number
  program: ProgramNode[]
}

export interface BuildingState {
  id: string
  playerId: PlayerId
  type: BuildingType
  x: number
  y: number
}

export interface RoundReport {
  headline: string
  details: string[]
  tips: string[]
}

export interface VictoryState {
  winnerId: PlayerId
  type: VictoryType
  summary: string
}

export interface GameState {
  mode: GameMode
  phase: Phase
  round: number
  maxRounds: number
  map: Tile[][]
  players: Record<PlayerId, PlayerState>
  units: UnitState[]
  buildings: BuildingState[]
  selectedUnitId: string | null
  report: RoundReport
  winner: VictoryState | null
  tutorialStep: number
  pendingMessages: string[]
}

export interface ActionNode {
  id: string
  type: 'MOVE' | 'COLLECT' | 'BUILD' | 'WAIT'
  direction?: Direction
  buildingType?: BuildingType
}

export interface RepeatNode {
  id: string
  type: 'REPEAT'
  times: number
  children: ProgramNode[]
}

export interface IfNode {
  id: string
  type: 'IF'
  condition: ConditionType
  thenChildren: ProgramNode[]
  elseChildren: ProgramNode[]
}

export type ProgramNode = ActionNode | RepeatNode | IfNode

export interface ResolvedAction {
  unitId: string
  playerId: PlayerId
  type: 'MOVE' | 'COLLECT' | 'BUILD' | 'WAIT'
  direction?: Direction
  buildingType?: BuildingType
}
