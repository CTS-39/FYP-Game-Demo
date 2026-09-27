interface TutorialCardProps {
  step: number
}

const steps = [
  {
    title: 'Step 1: Select a Robot',
    goal: 'Click a tile that contains your Worker or Explorer to open that robot in the code panel.',
  },
  {
    title: 'Step 2: Edit Program Blocks',
    goal: 'Add or adjust MOVE, COLLECT, BUILD, WAIT, and REPEAT blocks to define your turn plan.',
  },
  {
    title: 'Step 3: Validate Then Execute',
    goal: 'Press RUN PROGRAM to check for errors, then END TURN to execute all civilizations at once.',
  },
  {
    title: 'Step 4: Expand Your Economy',
    goal: 'Use BUILD on claimed flat tiles to place Farms, Mines, Workshops, and Laboratories.',
  },
  {
    title: 'Step 5: Unlock Conditions',
    goal: 'Queue Conditions research to unlock IF / ELSE logic for smarter automated choices.',
  },
  {
    title: 'Step 6: Adapt and Win',
    goal: 'Combine loops and conditions to expand territory, grow resources, and beat AI scores.',
  },
]

export function TutorialCard({ step }: TutorialCardProps) {
  const current = steps[Math.min(step, steps.length - 1)]

  return (
    <aside className="tutorial-card panel">
      <h3>📘 Tutorial</h3>
      <p>
        <strong>{current.title}</strong>
      </p>
      <p>{current.goal}</p>

      <div className="tutorial-accordion">
        <details className="tutorial-topic" open>
          <summary>Quick Start Flow</summary>
          <ul>
            <li>Select a robot on the map to open its programmable actions in the Code Panel.</li>
            <li>Build a short battery-safe program first, then press RUN PROGRAM to validate it.</li>
            <li>End Turn to execute every civilization: your actions, AI actions, research, income, and combat resolution.</li>
            <li>Read Round Feedback to understand what succeeded, what failed, and what to improve next turn.</li>
          </ul>
        </details>

        <details className="tutorial-topic" open>
          <summary>Interface and Button Functions</summary>
          <ul>
            <li>Materials panel: shows global resources (wood, energy, crystal, food), selected-tile info, and tile-specific possible actions.</li>
            <li>Robot panel: shows selected robot type, battery, level, owner, and role purpose.</li>
            <li>Code Panel: where you compose action logic with MOVE/BUILD/TRAIN/UPGRADE and control logic (REPEAT, IF/ELSE).</li>
            <li>RUN PROGRAM: checks role restrictions, action limits, and battery budget before execution.</li>
            <li>Technology Tree: queue Conditions or Automation to unlock better strategic programming options.</li>
            <li>Civilizations: score ranking and AI reasoning snapshots for opponent behavior insight.</li>
            <li>End Turn: commits your plan and advances the simulation by one full round.</li>
          </ul>
        </details>

        <details className="tutorial-topic">
          <summary>Map Tiles, Buildings, and Icons</summary>
          <ul>
            <li>🌾 Plains: low-risk movement and common expansion space.</li>
            <li>🌲 Forest: reliable wood source, useful for training/building-heavy plans.</li>
            <li>⛰️ Mountain: crystal-adjacent routes with higher movement battery cost; cannot host buildings.</li>
            <li>💧 Water: hard movement barrier, creates natural chokepoints and defensive lines.</li>
            <li>💎 Crystal Grove: key science/economy area for upgrade and research pressure.</li>
            <li>🏡 Village and 🪄 Ruins: landmark tiles that improve collection value and momentum.</li>
            <li>🏠 Base: initial foothold and territory anchor.</li>
            <li>🌱 Farm: boosts food economy.</li>
            <li>🔬 Laboratory: strengthens energy/crystal science flow.</li>
            <li>⛏️ Mine: crystal-focused production.</li>
            <li>⚙️ Workshop: mixed production support (wood + energy).</li>
            <li>Unit icons: 🤖 worker, 🚀 explorer, ⚔️ attack, 🛡️ defender. Colored dots indicate ownership.</li>
            <li>❔ Fog icon: hidden area; send explorers to reveal and plan safely.</li>
          </ul>
        </details>

        <details className="tutorial-topic">
          <summary>Robot Roles, Actions, and Limits</summary>
          <ul>
            <li>Common actions for all roles: MOVE, UPGRADE, WAIT, REPEAT.</li>
            <li>Worker unique actions: BUILD, TRAIN, COLLECT.</li>
            <li>Explorer unique actions: BUILD, COLLECT.</li>
            <li>Attack unique actions: TRAIN, ATTACK.</li>
            <li>Defender unique actions: TRAIN, DEFEND.</li>
            <li>Training limits differ by robot type, so decide who should be your main producer role each match phase.</li>
            <li>Program action count must not exceed current battery budget; short efficient programs are often stronger.</li>
          </ul>
        </details>

        <details className="tutorial-topic">
          <summary>Upgrade System and Level Effects</summary>
          <ul>
            <li>UPGRADE consumes resources and increases robot level (up to max level).</li>
            <li>Attack: higher level improves outcomes against defenders and attackers.</li>
            <li>Defender: higher level can counter weaker attackers and protect allies more reliably.</li>
            <li>Explorer: higher level lowers battery cost for utility actions and can escape lower-level attackers.</li>
            <li>Worker: higher level improves battery recovery speed each round, enabling heavier workloads.</li>
            <li>Upgrade costs scale with level, so timing upgrades around your economy curve matters.</li>
          </ul>
        </details>

        <details className="tutorial-topic">
          <summary>Programming Concepts and Usage</summary>
          <ul>
            <li>Sequence: base concept, actions run in order from top to bottom.</li>
            <li>REPEAT: compresses repeated behavior and saves block space for strategic complexity.</li>
            <li>IF/ELSE: enables reactive behavior based on map/resource/battery conditions.</li>
            <li>Best practice: put low-cost scouting/economy steps first, then costly combat/build decisions.</li>
            <li>Use WAIT intentionally when preserving battery for next round gives stronger tempo.</li>
          </ul>
        </details>

        <details className="tutorial-topic">
          <summary>Round Cycle, Combat, and Defense Logic</summary>
          <ul>
            <li>Planning phase: edit programs, queue research, prepare positioning.</li>
            <li>Execution phase: every unit performs validated actions; combat interactions resolve from those actions.</li>
            <li>DEFEND establishes protection states; ATTACK checks nearby targets and compares level interactions.</li>
            <li>Economy tick and recharge occur after action processing, then score/victory checks update.</li>
          </ul>
        </details>

        <details className="tutorial-topic">
          <summary>Win Conditions and Strategy Priorities</summary>
          <ul>
            <li>Expansion victory: control enough territory tiles.</li>
            <li>Science victory: complete required research path.</li>
            <li>Economic victory: hit resource threshold.</li>
            <li>Programming victory: demonstrate advanced logic patterns with strong energy posture.</li>
            <li>Score victory: lead by total score at max rounds.</li>
            <li>Balanced strategy usually wins: scout early, stabilize economy, then transition into levelled combat pressure.</li>
          </ul>
        </details>
      </div>

      <p className="muted">Tip: loops repeat actions, and conditions let robots adapt to the map.</p>
    </aside>
  )
}
