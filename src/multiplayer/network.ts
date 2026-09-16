import type { GameState } from '../game/types'

export interface TurnSubmission {
  state: GameState
}

export class LocalNetworkManager {
  submitTurn(submission: TurnSubmission) {
    return submission.state
  }
}
