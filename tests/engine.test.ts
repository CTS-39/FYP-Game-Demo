import { describe, expect, it } from 'vitest'
import { createInitialState, executeRound, queueResearch, updateUnitProgram } from '../src/game/engine'
import type { ProgramNode } from '../src/game/types'
import { createNodeId } from '../src/programming/commandSystem'

describe('Code Kingdoms engine', () => {
  it('executes repeat move and collect programs for the human worker', () => {
    const state = createInitialState('quick')
    const worker = state.units.find((unit) => unit.id === 'human-worker')
    if (!worker) throw new Error('worker missing')

    const next = executeRound(state)
    const updatedWorker = next.units.find((unit) => unit.id === 'human-worker')
    expect(updatedWorker?.y).toBeLessThan(worker.y)
    expect(next.players.human.resources.wood).toBeGreaterThanOrEqual(state.players.human.resources.wood)
    expect(next.report.tips.some((tip) => tip.includes('loop'))).toBe(true)
  })

  it('unlocks conditions research and follows the IF branch on a resource tile', () => {
    let state = createInitialState('quick')
    state = queueResearch(state, 'human', 'conditions')
    state.players.human.resources.crystal = 10
    state.players.human.resources.energy = 10
    state = executeRound(state)
    expect(state.players.human.researched).toContain('conditions')

    const worker = state.units.find((unit) => unit.id === 'human-worker')
    if (!worker) throw new Error('worker missing')
    const program: ProgramNode[] = [
      {
        id: createNodeId(),
        type: 'IF',
        condition: 'ON_RESOURCE',
        thenChildren: [{ id: createNodeId(), type: 'COLLECT' }],
        elseChildren: [{ id: createNodeId(), type: 'WAIT' }],
      },
    ]
    worker.x = 3
    worker.y = 3
    state.map[3][3].resource = 'wood'
    state.map[3][3].amount = 2
    const updated = updateUnitProgram(state, worker.id, program)
    const next = executeRound(updated)
    expect(next.players.human.resources.wood).toBeGreaterThan(state.players.human.resources.wood)
    expect(next.players.human.conceptsUsed).toContain('Conditions')
  })
})
