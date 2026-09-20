import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getNetwork } from '../api';

const ENTITY_COLORS = {
  Person: '#3b82f6', Phone: '#ec4899', Vehicle: '#f59e0b',
  Location: '#10b981', Organization: '#8b5cf6', Case: '#06b6d4',
};

const getRiskColor = (score) => {
  if (score >= 60) return '#ef4444';
  if (score >= 30) return '#f59e0b';
  return '#10b981';
};

const getRiskLabel = (score) => {
  if (score >= 60) return 'HIGH';
  if (score >= 30) return 'MEDIUM';
  return 'LOW';
};

export default function Analysis() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [riskScores, setRiskScores] = useState({});
  const navigate = useNavigate();

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const res = await getNetwork();
      setData(res.data);

      const scores = {};
      res.data.entities.forEach(e => {
        scores[e.id] = {
          score: Math.round((e.centrality_score || 0) * 100),
          connections: e.connection_count || 0,
        };
      });
      setRiskScores(scores);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!data) return <div className="text-center text-gray-400 p-12">Failed to load network data</div>;

  const sortedEntities = [...data.entities].sort((a, b) => (b.centrality_score || 0) - (a.centrality_score || 0));
  const highRisk = sortedEntities.filter(e => (riskScores[e.id]?.score || 0) >= 30).slice(0, 10);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-white">Network Analysis</h1>
        <p className="text-sm" style={{ color: '#94a3b8' }}>Centrality scores, risk assessment, and pattern detection</p>
      </div>

      {/* Summary stats bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total Entities', value: data.entities?.length || 0, color: '#3b82f6' },
          { label: 'Total Relationships', value: data.relationships?.length || 0, color: '#10b981' },
          { label: 'Network Clusters', value: data.clusters?.length || 0, color: '#8b5cf6' },
          { label: 'Patterns Detected', value: data.patterns?.length || 0, color: '#f59e0b' },
        ].map(({ label, value, color }) => (
          <div key={label} className="glass-card p-4 rounded-xl">
            <p className="text-xs" style={{ color: '#64748b' }}>{label}</p>
            <p className="text-xl font-bold mt-1" style={{ color }}>{value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Entities by Centrality */}
        <div className="glass-card p-6 rounded-xl">
          <h2 className="text-lg font-semibold text-white mb-4">Top Entities by Centrality</h2>
          <div className="space-y-2">
            {sortedEntities.slice(0, 15).map((entity, i) => {
              const score = riskScores[entity.id]?.score || 0;
              const isHighRisk = score >= 30;
              return (
                <div
                  key={entity.id}
                  onClick={() => navigate(`/investigation/${entity.id}`)}
                  className={`flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition-all ${isHighRisk ? 'hover:bg-white/10' : 'hover:bg-white/5'}`}
                  style={isHighRisk ? { border: '1px solid #f59e0b22' } : {}}
                >
                  <span className="text-xs font-mono w-6" style={{ color: '#64748b' }}>#{i + 1}</span>
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                    style={{ background: `${ENTITY_COLORS[entity.entity_type]}20`, color: ENTITY_COLORS[entity.entity_type] }}>
                    {entity.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-white truncate">{entity.name}</p>
                      {isHighRisk && (
                        <span className="text-xs px-1.5 py-0.5 rounded-full font-semibold" style={{
                          background: getRiskColor(score) + '20',
                          color: getRiskColor(score)
                        }}>
                          {getRiskLabel(score)}
                        </span>
                      )}
                    </div>
                    <p className="text-xs" style={{ color: '#64748b' }}>{entity.entity_type}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-sm font-mono font-bold" style={{ color: getRiskColor(score) }}>
                      {score}%
                    </div>
                    <div className="text-xs" style={{ color: '#64748b' }}>{riskScores[entity.id]?.connections || 0} links</div>
                  </div>
                  <div className="w-20 h-2 rounded-full overflow-hidden flex-shrink-0" style={{ background: '#1e293b' }}>
                    <div className="h-full rounded-full transition-all duration-500" style={{
                      width: `${riskScores[entity.id]?.score || 0}%`,
                      background: getRiskColor(score)
                    }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="space-y-6">
          {/* Risk Assessment */}
          <div className="glass-card p-6 rounded-xl">
            <h2 className="text-lg font-semibold text-white mb-4">Risk Assessment</h2>
            <div className="space-y-3">
              {highRisk.length === 0 && (
                <p className="text-sm text-gray-400">No high-risk entities detected</p>
              )}
              {highRisk.map(entity => {
                const score = riskScores[entity.id]?.score || 0;
                return (
                  <div
                    key={entity.id}
                    onClick={() => navigate(`/investigation/${entity.id}`)}
                    className="p-3 rounded-lg cursor-pointer hover:bg-white/5 transition-all"
                    style={{ border: `1px solid ${getRiskColor(score)}22` }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: getRiskColor(score) }} />
                        <span className="text-sm font-medium text-white">{entity.name}</span>
                        <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: `${ENTITY_COLORS[entity.entity_type]}20`, color: ENTITY_COLORS[entity.entity_type] }}>
                          {entity.entity_type}
                        </span>
                      </div>
                      <span className="text-lg font-bold font-mono" style={{ color: getRiskColor(score) }}>{score}%</span>
                    </div>
                    <div className="mt-2 w-full h-1.5 rounded-full" style={{ background: '#1e293b' }}>
                      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${score}%`, background: getRiskColor(score) }} />
                    </div>
                    <div className="mt-2 flex items-center gap-4 text-xs" style={{ color: '#64748b' }}>
                      <span>{riskScores[entity.id]?.connections || 0} connections</span>
                      <span>Centrality: {(entity.centrality_score * 100).toFixed(1)}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Detected Patterns */}
          <div className="glass-card p-6 rounded-xl">
            <h2 className="text-lg font-semibold text-white mb-4">Detected Patterns</h2>
            <div className="space-y-3">
              {data.patterns?.map((pattern, i) => (
                <div key={i} className="p-3 rounded-lg" style={{ border: '1px solid #1e3a5f' }}>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{
                      background: pattern.severity === 'high' ? '#ef444420' : pattern.severity === 'medium' ? '#f59e0b20' : '#10b98120',
                      color: pattern.severity === 'high' ? '#ef4444' : pattern.severity === 'medium' ? '#f59e0b' : '#10b981'
                    }}>
                      {pattern.severity.toUpperCase()}
                    </span>
                    <span className="text-xs font-medium" style={{ color: '#94a3b8' }}>{pattern.type.replace(/_/g, ' ')}</span>
                  </div>
                  <p className="text-sm" style={{ color: '#cbd5e1' }}>{pattern.description}</p>
                </div>
              ))}
              {(!data.patterns || data.patterns.length === 0) && (
                <p className="text-sm text-gray-400">No suspicious patterns detected</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Network Clusters */}
      {data.clusters && data.clusters.length > 0 && (
        <div className="glass-card p-6 rounded-xl">
          <h2 className="text-lg font-semibold text-white mb-4">Network Clusters</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.clusters.map((cluster, i) => {
              const clusterColors = ['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#ec4899', '#06b6d4'];
              const cColor = clusterColors[i % clusterColors.length];
              return (
                <div key={i} className="p-4 rounded-lg" style={{ border: `1px solid ${cColor}33` }}>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-semibold text-white">Cluster {i + 1}</h3>
                    <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: `${cColor}20`, color: cColor }}>
                      {cluster.length} nodes
                    </span>
                  </div>
                  <div className="space-y-1">
                    {cluster.slice(0, 8).map(nodeId => {
                      const entity = data.entities.find(e => e.id === nodeId);
                      if (!entity) return null;
                      return (
                        <div key={nodeId} onClick={() => navigate(`/investigation/${nodeId}`)} className="flex items-center gap-2 p-1 rounded cursor-pointer hover:bg-white/5">
                          <div className="w-2 h-2 rounded-full" style={{ background: ENTITY_COLORS[entity.entity_type] }} />
                          <span className="text-xs text-gray-300 truncate">{entity.name}</span>
                          <span className="text-xs ml-auto" style={{ color: '#64748b' }}>{entity.entity_type}</span>
                        </div>
                      );
                    })}
                    {cluster.length > 8 && <p className="text-xs" style={{ color: '#64748b' }}>+{cluster.length - 8} more</p>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="glass-card p-4 rounded-xl text-xs" style={{ color: '#64748b' }}>
        Risk scores are calculated based on network centrality metrics (degree, betweenness, closeness) and do not predict actual criminal activity. This is a research prototype for SIH26189.
      </div>
    </div>
  );
}
