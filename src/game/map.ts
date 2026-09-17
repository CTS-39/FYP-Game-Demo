import type { PlayerId, ResourceType, TerrainType, Tile } from './types'

export const MAP_SIZE = 12

const waterRing = new Set(['5,3', '5,4', '5,5', '6,5', '7,5', '4,7', '5,7', '6,7', '7,7', '7,8'])
const crystalBand = new Set(['8,1', '9,1', '8,2', '9,2', '9,3', '2,8', '2,9', '3,9'])
const villageTiles = new Set(['5,9', '6,9'])
const ruinTiles = new Set(['8,8', '3,2'])

export const startingPositions: Record<PlayerId, { x: number; y: number }> = {
  human: { x: 1, y: 10 },
  'explorer-ai': { x: 10, y: 10 },
  'scientist-ai': { x: 10, y: 1 },
  'conqueror-ai': { x: 1, y: 1 },
}

const terrainResource: Partial<Record<TerrainType, ResourceType>> = {
  plains: 'food',
  forest: 'wood',
  mountain: 'crystal',
  crystal: 'crystal',
  village: 'energy',
  ruins: 'energy',
}

export const terrainNames: Record<TerrainType, string> = {
  plains: 'Plains',
  forest: 'Forest',
  mountain: 'Mountain',
  water: 'River',
  crystal: 'Crystal Grove',
  village: 'Village',
  ruins: 'Ruins',
}

export const terrainPalette: Record<TerrainType, string> = {
  plains: 'var(--plains)',
  forest: 'var(--forest)',
  mountain: 'var(--mountain)',
  water: 'var(--water)',
  crystal: 'var(--crystal)',
  village: 'var(--village)',
  ruins: 'var(--ruins)',
}

export function tileKey(x: number, y: number) {
  return `${x},${y}`
}

export function isInBounds(x: number, y: number) {
  return x >= 0 && y >= 0 && x < MAP_SIZE && y < MAP_SIZE
}

export function createMap() {
  const map: Tile[][] = []
  for (let y = 0; y < MAP_SIZE; y += 1) {
    const row: Tile[] = []
    for (let x = 0; x < MAP_SIZE; x += 1) {
      const terrain = getTerrain(x, y)
      const resource = terrainResource[terrain] ?? null
      row.push({
        x,
        y,
        terrain,
        resource,
        amount: resource ? (terrain === 'crystal' ? 4 : 3) : 0,
        landmark: terrain === 'village' || terrain === 'ruins' ? terrain : undefined,
      })
    }
    map.push(row)
  }
  return map
}

function getTerrain(x: number, y: number): TerrainType {
  const key = tileKey(x, y)
  if (waterRing.has(key)) return 'water'
  if (crystalBand.has(key)) return 'crystal'
  if (villageTiles.has(key)) return 'village'
  if (ruinTiles.has(key)) return 'ruins'
  if ((x + y) % 5 === 0 || y === 0 || y === MAP_SIZE - 1) return 'mountain'
  if ((x * 2 + y) % 3 === 0) return 'forest'
  return 'plains'
}

export function getTile(map: Tile[][], x: number, y: number) {
  return isInBounds(x, y) ? map[y][x] : null
}

export function getNeighbors(x: number, y: number) {
  return [
    { x, y: y - 1 },
    { x, y: y + 1 },
    { x: x - 1, y },
    { x: x + 1, y },
  ].filter((point) => isInBounds(point.x, point.y))
}
