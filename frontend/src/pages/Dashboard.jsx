import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getDashboard, initSampleData } from '../api';

const ENTITY_COLORS = {
  Person: '#3b82f6', Phone: '#ec4899', Vehicle: '#f59e0b',
  Location: '#10b981', Organization: '#8b5cf6', Case: '#06b6d4',
};

const StatCard = ({ title, value, icon, color, subtitle }) => (
  <div className="glass-card stat-card p-5 rounded-xl">
    <div className="flex items-start justify-between">
      <div>
        <p className="text-xs font-medium" style={{ color: '#94a3b8' }}>{title}</p>
        <p className="text-2xl font-bold mt-1" style={{ color }}>{value}</p>
        {subtitle && <p className="text-xs mt-1" style={{ color: '#64748b' }}>{subtitle}</p>}
      </div>
      <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${color}20` }}>
        <svg className="w-5 h-5" style={{ color }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={icon} />
        </svg>
      </div>
    </div>
  </div>
);

const BarChart = ({ data, maxVal }) => {
  if (!data || data.length === 0) return null;
  const max = maxVal || Math.max(...data.map(d => d.count), 1);
  return (
    <div className="space-y-5">
      {data.map((item, i) => (
        <div key={i} className="flex items-center gap-3">
          <span className="text-xs w-28 truncate" style={{ color: '#94a3b8' }}>{item.type || item.name}</span>
          <div className="flex-1 rounded-md overflow-hidden" style={{ background: '#0d1420', border: '1px solid #22314e' }}>
            <div className="h-4 rounded-sm transition-all duration-500" style={{
              width: `${(item.count / max) * 100}%`,
              background: item.color || '#3b82f6',
              minWidth: item.count > 0 ? '6px' : '0'
            }} />
          </div>
          <span className="text-xs font-mono w-8 text-right" style={{ color: '#94a3b8' }}>{item.count}</span>
        </div>
      ))}
    </div>
  );
};

const PatternCard = ({ pattern, index }) => {
  const severityColors = { high: '#ef4444', medium: '#f59e0b', low: '#10b981' };
  const color = severityColors[pattern.severity] || '#94a3b8';
  return (
    <div className="p-3 rounded-lg" style={{ border: '1px solid #1e3a5f', animationDelay: `${index * 0.05}s` }}>
      <div className="flex items-start gap-3">
        <div className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0" style={{ background: color }} />
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: `${color}20`, color }}>
              {pattern.severity.toUpperCase()}
            </span>
            <span className="text-xs" style={{ color: '#64748b' }}>{pattern.type.replace(/_/g, ' ')}</span>
          </div>
          <p className="text-xs mt-1" style={{ color: '#cbd5e1' }}>{pattern.description}</p>
        </div>
      </div>
    </div>
  );
};

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [initStatus, setInitStatus] = useState('');
  const navigate = useNavigate();

  useEffect(() => { loadDashboard(); }, []);

  const loadDashboard = async () => {
    setLoading(true);
    try {
      const res = await getDashboard();
      setStats(res.data);
    } catch (err) { console.error('Dashboard error:', err); }
    finally { setLoading(false); }
  };

  const handleInitData = async () => {
    setInitStatus('loading');
    try {
      await initSampleData();
      setInitStatus('success');
      loadDashboard();
    } catch (err) { setInitStatus('error'); }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="mt-4 text-gray-400 text-sm">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (!stats || (stats.total_cases === 0 && stats.total_persons === 0)) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center glass-card p-12 rounded-2xl max-w-md">
          <div className="w-20 h-20 rounded-full mx-auto mb-6 flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #3b82f6, #06b6d4)' }}>
            <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-white mb-3">Welcome to CrimeNet</h2>
          <p className="text-gray-400 mb-6 text-sm">Initialize the database with sample crime data to start exploring the criminal network analysis system.</p>
          <button
            onClick={handleInitData}
            disabled={initStatus === 'loading'}
            className="px-6 py-3 rounded-lg text-white font-medium transition-all text-sm"
            style={{ background: 'linear-gradient(135deg, #3b82f6, #06b6d4)' }}
          >
            {initStatus === 'loading' ? 'Loading...' : initStatus === 'success' ? 'Loaded!' : 'Load Sample Data'}
          </button>
          {initStatus === 'error' && (
            <p className="text-red-400 text-sm mt-3">Error loading data. Check if Neo4j is running.</p>
          )}
          <p className="text-xs text-gray-500 mt-4">Requires Neo4j running on localhost:7687</p>
        </div>
      </div>
    );
  }

  const eb = stats.entity_breakdown || {};
  const rt = stats.relationship_types || [];

  const entityTypeData = [
    { type: 'Person', count: eb.persons || stats.total_persons || 0, color: '#3b82f6' },
    { type: 'Organization', count: eb.organizations || stats.total_organizations || 0, color: '#8b5cf6' },
    { type: 'Phone', count: eb.phones || stats.total_phones || 0, color: '#ec4899' },
    { type: 'Vehicle', count: eb.vehicles || stats.total_vehicles || 0, color: '#f59e0b' },
    { type: 'Location', count: eb.locations || stats.total_locations || 0, color: '#10b981' },
  ];

  const relTypeData = rt.map(r => ({
    type: r.type,
    count: r.count,
    color: r.type === 'ASSOCIATED_WITH' ? '#3b82f6' :
           r.type === 'USES' ? '#ec4899' :
           r.type === 'OWNS' ? '#f59e0b' :
           r.type === 'LOCATED_AT' ? '#10b981' :
           r.type === 'MEMBER_OF' ? '#8b5cf6' :
           r.type === 'SUSPECTED_IN' ? '#06b6d4' :
           r.type === 'VICTIM_IN' ? '#ef4444' : '#94a3b8'
  }));

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Demo environment banner */}
      <div className="glass-card p-3 rounded-xl flex items-center gap-3" style={{ border: '1px solid #10b98133' }}>
        <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: '#10b981' }} />
        <span className="text-xs font-medium" style={{ color: '#10b981' }}>Demo Environment</span>
        <span className="text-xs" style={{ color: '#64748b' }}>—</span>
        <span className="text-xs" style={{ color: '#94a3b8' }}>Synthetic Data — SIH26189 Research Prototype</span>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Investigation Dashboard</h1>
          <p className="text-sm mt-1" style={{ color: '#94a3b8' }}>Criminal Network Analysis Overview</p>
        </div>
        <button onClick={loadDashboard} className="px-4 py-2 rounded-lg text-xs font-medium border transition-all hover:bg-white/5" style={{ borderColor: '#1e3a5f', color: '#94a3b8' }}>
          Refresh
        </button>
      </div>

      {/* Stat Cards Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        <StatCard title="Cases" value={stats.total_cases} icon="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" color="#3b82f6" />
        <StatCard title="Persons" value={stats.total_persons} icon="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" color="#06b6d4" />
        <StatCard title="Organizations" value={stats.total_organizations} icon="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" color="#8b5cf6" />
        <StatCard title="Entity Links" value={stats.total_entity_relationships || 0} icon="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" color="#10b981" />
        <StatCard title="Vehicles" value={stats.total_vehicles} icon="M8 17h8M8 17v-4h8v4M8 17H5a1 1 0 01-1-1v-3a1 1 0 011-1h1m0 0h10m-10 0v-1a1 1 0 011-1h8a1 1 0 011 1v1" color="#f59e0b" />
        <StatCard title="Phones" value={stats.total_phones} icon="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" color="#ec4899" />
        <StatCard title="Locations" value={stats.total_locations} icon="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z M15 11a3 3 0 11-6 0 3 3 0 016 0z" color="#10b981" />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Entity Type Breakdown */}
        <div className="glass-card p-6 rounded-xl">
          <h2 className="text-sm font-semibold text-white mb-5">Entity Breakdown</h2>
          <BarChart data={entityTypeData} />
        </div>

        {/* Relationship Types */}
        <div className="glass-card p-6 rounded-xl">
          <h2 className="text-sm font-semibold text-white mb-5">Relationship Types</h2>
          {relTypeData.length > 0 ? (
            <BarChart data={relTypeData} />
          ) : (
            <p className="text-xs text-gray-500">No relationships found</p>
          )}
        </div>

        {/* Recent Cases */}
        <div className="glass-card p-6 rounded-xl">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-sm font-semibold text-white">Recent Cases</h2>
            <button onClick={() => navigate('/cases')} className="text-xs" style={{ color: '#3b82f6' }}>View All →</button>
          </div>
          <div className="space-y-3">
            {stats.recent_cases && stats.recent_cases.length > 0 ? stats.recent_cases.map((c, i) => (
              <div key={i} className="p-3 rounded-lg hover:bg-white/5 cursor-pointer transition-all group" style={{ border: '1px solid #1e3a5f' }} onClick={() => navigate('/cases')}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono px-1.5 py-0.5 rounded" style={{ background: '#3b82f620', color: '#3b82f6' }}>{c.fir_number}</span>
                    <span className="text-xs" style={{ color: '#64748b' }}>{c.date}</span>
                  </div>
                  <span className="text-xs group-hover:text-blue-400 transition-colors" style={{ color: '#64748b' }}>→</span>
                </div>
                <p className="text-xs font-medium text-white mt-1 truncate">{c.title}</p>
                <p className="text-xs" style={{ color: '#64748b' }}>{c.location}</p>
                {c.extracted_entities && c.extracted_entities.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {c.extracted_entities.slice(0, 4).map((e, j) => (
                      <span key={j} className="text-xs px-1.5 py-0.5 rounded"
                        style={{ background: `${ENTITY_COLORS[e.entity_type] || '#94a3b8'}20`, color: ENTITY_COLORS[e.entity_type] || '#94a3b8' }}>
                        {e.name.length > 10 ? e.name.substring(0, 10) + '...' : e.name}
                      </span>
                    ))}
                    {c.extracted_entities.length > 4 && (
                      <span className="text-xs" style={{ color: '#64748b' }}>+{c.extracted_entities.length - 4}</span>
                    )}
                  </div>
                )}
              </div>
            )) : (
              <p className="text-xs text-gray-500">No cases found</p>
            )}
          </div>
        </div>
      </div>

      {/* Top Connected & Important Entities */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {stats.top_connected && stats.top_connected.length > 0 && (
          <div className="glass-card p-6 rounded-xl">
            <h2 className="text-sm font-semibold text-white mb-4">Most Connected Entities</h2>
            <div className="space-y-2">
              {stats.top_connected.map((entity, i) => (
                <div
                  key={entity.id}
                  onClick={() => navigate(`/investigation/${entity.id}`)}
                  className="flex items-center gap-3 p-2.5 rounded-lg cursor-pointer hover:bg-white/5 transition-all"
                >
                  <span className="text-xs font-mono w-5" style={{ color: '#64748b' }}>#{i + 1}</span>
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                    style={{ background: `${ENTITY_COLORS[entity.entity_type] || '#94a3b8'}20`, color: ENTITY_COLORS[entity.entity_type] || '#94a3b8' }}>
                    {entity.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-white truncate">{entity.name}</p>
                    <p className="text-xs" style={{ color: '#64748b' }}>{entity.entity_type}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <span className="text-xs font-mono" style={{ color: '#3b82f6' }}>{entity.connection_count} links</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {stats.important_entities && stats.important_entities.length > 0 && (
          <div className="glass-card p-6 rounded-xl">
            <h2 className="text-sm font-semibold text-white mb-4">High-Priority Entities</h2>
            <div className="space-y-2">
              {stats.important_entities.map((entity) => (
                <div
                  key={entity.id}
                  onClick={() => navigate(`/investigation/${entity.id}`)}
                  className="flex items-center gap-3 p-2.5 rounded-lg cursor-pointer hover:bg-white/5 transition-all"
                >
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                    style={{ background: `${ENTITY_COLORS[entity.entity_type] || '#94a3b8'}20`, color: ENTITY_COLORS[entity.entity_type] || '#94a3b8' }}>
                    {entity.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-white truncate">{entity.name}</p>
                    <p className="text-xs" style={{ color: '#64748b' }}>{entity.entity_type} · Score: {(entity.centrality_score * 100).toFixed(1)}%</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Suspicious Patterns */}
      {stats.suspicious_patterns && stats.suspicious_patterns.length > 0 && (
        <div className="glass-card p-6 rounded-xl">
          <h2 className="text-sm font-semibold text-white mb-4">Suspicious Pattern Summary</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {stats.suspicious_patterns.map((pattern, i) => (
              <PatternCard key={i} pattern={pattern} index={i} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
