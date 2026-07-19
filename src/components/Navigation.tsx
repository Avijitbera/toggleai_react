export type TabId = 'flags' | 'analytics' | 'delivery' | 'experiments' | 'learn';

const TABS: { id: TabId; icon: string; label: string }[] = [
  { id: 'flags',       icon: '🚩', label: 'Feature Flags' },
  { id: 'analytics',  icon: '📊', label: 'Analytics' },
  { id: 'delivery',   icon: '🚀', label: 'Progressive Delivery' },
  { id: 'experiments',icon: '🧪', label: 'Experiments' },
  { id: 'learn',      icon: '📖', label: 'Learn' },
];

interface Props {
  active: TabId;
  onSelect: (tab: TabId) => void;
}

export default function Navigation({ active, onSelect }: Props) {
  return (
    <nav className="tab-nav" role="tablist" aria-label="Demo sections">
      {TABS.map(tab => (
        <button
          key={tab.id}
          id={`tab-${tab.id}`}
          role="tab"
          aria-selected={active === tab.id}
          className={`tab-btn${active === tab.id ? ' active' : ''}`}
          onClick={() => onSelect(tab.id)}
        >
          <span className="tab-icon">{tab.icon}</span>
          {tab.label}
        </button>
      ))}
    </nav>
  );
}
