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

      <div className="tutorial-section">
        <strong>Game Buttons</strong>
        <ul>
          <li>▶ RUN PROGRAM: checks your selected robot code and shows mistakes before execution.</li>
          <li>End Turn: runs all robots, AI decisions, resource income, and research for the round.</li>
          <li>Technology Tree buttons: queue Conditions or Automation to unlock stronger strategies.</li>
        </ul>
      </div>

      <div className="tutorial-section">
        <strong>Map Tiles and Icons</strong>
        <ul>
          <li>🌾 Plains: basic expansion land; usually good for growth and safe worker routes.</li>
          <li>🌲 Forest: strong wood source for construction-heavy strategies.</li>
          <li>⛰️ Mountain: crystal-rich but costly to cross; cannot build structures on mountains.</li>
          <li>💧 Water (River): blocks land movement; use it to predict chokepoints and paths.</li>
          <li>💎 Crystal Grove: premium crystal collection zone for faster tech progression.</li>
          <li>🏡 Village: energy-focused landmark with bonus food value while collecting nearby.</li>
          <li>🪄 Ruins: energy-focused landmark ideal for scouting and early momentum.</li>
          <li>🏠 Base: core starter structure; anchors early territory and baseline production.</li>
          <li>🌱 Farm: boosts food income to support steady economy and expansion pace.</li>
          <li>🔬 Laboratory: supports science progression and crystal/energy-oriented plans.</li>
          <li>⛏️ Mine: increases crystal income to unlock advanced technologies sooner.</li>
          <li>⚙️ Workshop: improves production flexibility with extra wood and energy output.</li>
          <li>Unit icons: 🤖 worker, 🚀 explorer. Colored dots show tile ownership.</li>
          <li>❔ means fog of war: explore with units to reveal that area.</li>
        </ul>
      </div>

      <div className="tutorial-section">
        <strong>Unit Roles</strong>
        <ul>
          <li>🤖 Worker: your economy unit. Use it to COLLECT resources and BUILD structures.</li>
          <li>🚀 Explorer: your scouting unit. Use it to reveal fog faster, discover villages/ruins, and map safe paths.</li>
          <li>Best flow: send Explorer first, then move Worker into revealed resource-rich tiles.</li>
        </ul>
      </div>

      <div className="tutorial-section">
        <strong>Game Process</strong>
        <ul>
          <li>1. Planning: edit robot programs and queue research.</li>
          <li>2. Execution: all players run their programmed actions.</li>
          <li>3. Results: check round feedback, score changes, and AI reasoning.</li>
        </ul>
      </div>

      <div className="tutorial-section">
        <strong>Win Conditions</strong>
        <ul>
          <li>Expansion: control at least 24 tiles.</li>
          <li>Science: research both Conditions and Automation.</li>
          <li>Economic: reach a total of 70 resources.</li>
          <li>Programming: use loops and conditions while maintaining high energy.</li>
          <li>Score: highest score when max rounds are complete.</li>
        </ul>
      </div>

      <p className="muted">Tip: loops repeat actions, and conditions let robots adapt to the map.</p>
    </aside>
  )
}
