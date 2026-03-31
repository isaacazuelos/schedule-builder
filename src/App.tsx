import { AppProvider, useApp } from './store/AppContext';
import StaffTab from './components/tabs/StaffTab';
import AvailabilityTab from './components/tabs/AvailabilityTab';
import ConstraintsTab from './components/tabs/ConstraintsTab';
import OutputTab from './components/tabs/OutputTab';
import type { TabName } from './types';

const TABS: { id: TabName; label: string }[] = [
  { id: 'output', label: 'Schedule' },
  { id: 'staff', label: 'Staff' },
  { id: 'availability', label: 'Availability' },
  { id: 'constraints', label: 'Constraints' },
];

function AppInner() {
  const { state, setTab } = useApp();

  return (
    <div className="app">
      <header className="app-header">
        <h1>Schedule Builder</h1>
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
