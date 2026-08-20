import { useCallback, useEffect, useState } from 'react'
import {
  DEFAULT_STATS,
  DEFAULT_TRAJECTORY,
  DEFAULT_TREE,
  type StatsConfig,
  type TrajectoryConfig,
  type TreeConfig,
  type ViewId,
  viewFromHash,
} from './config.ts'
import { ThemeToggle } from './ui/ThemeToggle.tsx'
import { ViewSwitcher } from './ui/ViewSwitcher.tsx'
import { TrajectoryView } from './views/TrajectoryView.tsx'
import { TreeView } from './views/TreeView.tsx'
import { StatsView } from './views/StatsView.tsx'

function App() {
  const [activeView, setActiveView] = useState<ViewId>(
    () => viewFromHash(window.location.hash) ?? 'trajectories',
  )
  /* Per-view configs live here so switching views never loses a tweak. */
  const [trajectoryConfig, setTrajectoryConfig] = useState<TrajectoryConfig>(DEFAULT_TRAJECTORY)
  const [treeConfig, setTreeConfig] = useState<TreeConfig>(DEFAULT_TREE)
  const [statsConfig, setStatsConfig] = useState<StatsConfig>(DEFAULT_STATS)

  /* replaceState rather than assignment: deep links without history spam. */
  useEffect(() => {
    window.history.replaceState(null, '', `#${activeView}`)
  }, [activeView])

  /* Manual hash edits and back or forward navigation still switch views;
     our own replaceState writes never fire this event. */
  useEffect(() => {
    const onHashChange = () => {
      const view = viewFromHash(window.location.hash)
      if (view) setActiveView(view)
    }
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  const handleTrajectoryChange = useCallback((patch: Partial<TrajectoryConfig>) => {
    setTrajectoryConfig((current) => ({ ...current, ...patch }))
  }, [])

  const handleTreeChange = useCallback((patch: Partial<TreeConfig>) => {
    setTreeConfig((current) => ({ ...current, ...patch }))
  }, [])

  const handleStatsChange = useCallback((patch: Partial<StatsConfig>) => {
    setStatsConfig((current) => ({ ...current, ...patch }))
  }, [])

  return (
    <div className="page">
      <header className="masthead">
        <div>
          <h1>Collatz Conjecture Visualized</h1>
          <p className="tagline">
            Halve it if it is even, triple it and add one if it is odd. Nobody can prove
            that this always comes home to 1.
          </p>
        </div>
        <ThemeToggle />
      </header>
      <ViewSwitcher active={activeView} onChange={setActiveView} />
      <main>
        {activeView === 'trajectories' && (
          <TrajectoryView
            config={trajectoryConfig}
            onConfigChange={handleTrajectoryChange}
            onPreset={setTrajectoryConfig}
          />
        )}
        {activeView === 'tree' && (
          <TreeView
            config={treeConfig}
            onConfigChange={handleTreeChange}
            onPreset={setTreeConfig}
          />
        )}
        {activeView === 'stats' && (
          <StatsView config={statsConfig} onConfigChange={handleStatsChange} />
        )}
      </main>
      <footer className="colophon">
        <p>
          Built by <a href="https://github.com/CameronScarpati">Cameron Scarpati</a> as a
          portfolio project.{' '}
          <a href="https://github.com/CameronScarpati/collatz-conjecture-visualized">
            Source on GitHub
          </a>
          .
        </p>
        <p>
          Read more about the{' '}
          <a href="https://en.wikipedia.org/wiki/Collatz_conjecture">Collatz conjecture</a>,
          posed by Lothar Collatz in 1937 and open ever since. The coral layout of the tree
          view follows an idea by{' '}
          <a href="https://en.wikipedia.org/wiki/Edmund_Harriss">Edmund Harriss</a>.
        </p>
      </footer>
    </div>
  )
}

export default App
