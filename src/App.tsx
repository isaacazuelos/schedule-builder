import { AppProvider, useApp } from './store/AppContext';
import StaffTab from './components/tabs/StaffTab';
import AvailabilityTab from './components/tabs/AvailabilityTab';
import ConstraintsTab from './components/tabs/ConstraintsTab';
import GenerateTab from './components/tabs/GenerateTab';
import OutputTab from './components/tabs/OutputTab';
import type { TabName } from './types';

const TABS: { id: TabName; label: string }[] = [
  { id: 'staff', label: 'Staff' },
  { id: 'availability', label: 'Availability' },
  { id: 'constraints', label: 'Constraints' },
  { id: 'generate', label: 'Generate' },
  { id: 'output', label: 'Output' },
];

function AppInner() {
  const { state, setTab } = useApp();

  return (
    <div className="app">
      <header className="app-header">
        <h1>Phone Coverage Scheduler</h1>
      </header>

      <nav className="tab-bar" role="tablist">
        {TABS.map(t => (
          <button
            key={t.id}
            role="tab"
            aria-selected={state.activeTab === t.id}
            className={`tab-btn${state.activeTab === t.id ? ' tab-btn--active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <main className="tab-content">
        {state.activeTab === 'staff' && <StaffTab />}
        {state.activeTab === 'availability' && <AvailabilityTab />}
        {state.activeTab === 'constraints' && <ConstraintsTab />}
        {state.activeTab === 'generate' && <GenerateTab />}
        {state.activeTab === 'output' && <OutputTab />}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <AppInner />
    </AppProvider>
  );
}
