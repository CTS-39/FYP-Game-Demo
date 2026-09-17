interface TutorialCardProps {
  step: number
}

const steps = [
  'Select your Worker Robot and look at its starter REPEAT program.',
  'Use the code panel to tweak a MOVE, COLLECT, or REPEAT block.',
  'End the turn to watch planning become execution.',
  'Build a Laboratory on a claimed tile with a Worker BUILD block.',
  'Queue Conditions research to unlock IF / ELSE blocks.',
  'Try an IF block so the robot can choose between collecting and moving.',
]

export function TutorialCard({ step }: TutorialCardProps) {
  return (
    <aside className="tutorial-card panel">
      <h3>📘 Tutorial</h3>
      <p>{steps[Math.min(step, steps.length - 1)]}</p>
      <p className="muted">Short tip: loops repeat actions, conditions let units react.</p>
    </aside>
  )
}
