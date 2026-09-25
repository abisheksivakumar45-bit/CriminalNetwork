import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import * as d3 from 'd3';
import { getEntities, getInvestigation, searchEntities, getEntityTimeline } from '../api';
import { resolveApiError } from '../utils/errors';

const ENTITY_COLORS = {
  Person: '#3b82f6', Phone: '#ec4899', Vehicle: '#f59e0b',
  Location: '#10b981', Organization: '#8b5cf6', Case: '#06b6d4',
};

const getRiskColor = (score) => {
  if (score >= 60) return '#ef4444';
  if (score >= 30) return '#f59e0b';
  return '#10b981';
};

const TIMELINE_CATEGORY_COLORS = {
  cases: '#06b6d4',
  locations: '#10b981',
  organizations: '#8b5cf6',
  phones: '#ec4899',
  vehicles: '#f59e0b',
  network: '#3b82f6',
};

const TIMELINE_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'cases', label: 'Cases' },
  { key: 'locations', label: 'Locations' },
  { key: 'organizations', label: 'Organizations' },
  { key: 'phones', label: 'Phones' },
  { key: 'vehicles', label: 'Vehicles' },
];

export default function Investigation() {
  const { entityId } = useParams();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [investigation, setInvestigation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [allEntities, setAllEntities] = useState([]);
  const miniGraphRef = useRef(null);

  const [timeline, setTimeline] = useState(null);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [timelineError, setTimelineError] = useState('');
  const [timelineFilter, setTimelineFilter] = useState('all');
  const [investigationError, setInvestigationError] = useState('');

  useEffect(() => { loadAllEntities(); }, []);

  useEffect(() => {
    if (entityId) loadInvestigation(entityId);
  }, [entityId]);

  const loadTimeline = async (id) => {
    setTimelineLoading(true);
    setTimelineError('');
    setTimeline(null);
    setTimelineFilter('all');
    try {
      const res = await getEntityTimeline(id);
      setTimeline(res.data);
    } catch (err) {
      console.error(err);
      setTimelineError('Could not load the investigation timeline for this entity.');
    } finally {
      setTimelineLoading(false);
    }
  };

  useEffect(() => {
    if (entityId) loadTimeline(entityId);
  }, [entityId]);

  useEffect(() => {
    if (searchQuery.length > 1) {
      const timer = setTimeout(() => searchEntities(searchQuery).then(r => setSearchResults(r.data)), 300);
      return () => clearTimeout(timer);
    } else {
      setSearchResults([]);
    }
  }, [searchQuery]);

  const loadAllEntities = async () => {
    try {
      const res = await getEntities();
      setAllEntities(res.data);
    } catch (err) { console.error(err); }
  };

  const loadInvestigation = async (id) => {
    setLoading(true);
    setInvestigationError('');
    try {
      const res = await getInvestigation(id);
      if (res.data?.error) {
        setInvestigationError('Entity not found.');
      } else {
        setInvestigation(res.data);
      }
    } catch (err) { setInvestigationError(resolveApiError(err, 'Could not load the investigation for this entity.')); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    if (!investigation || !miniGraphRef.current) return;
    renderMiniGraph();
  }, [investigation]);

  const renderMiniGraph = () => {
    const container = miniGraphRef.current;
    if (!container || !investigation) return;

    const width = container.clientWidth || 600;
    const height = 420;

    let svg = d3.select(container).select('svg');
    if (svg.empty()) {
      svg = d3.select(container).append('svg');
    }
    svg.selectAll('*').remove();
    svg.attr('width', width).attr('height', height).attr('viewBox', `0 0 ${width} ${height}`);

    const defs = svg.append('defs');
    const glow = defs.append('filter').attr('id', 'glow2');
    glow.append('feGaussianBlur').attr('stdDeviation', '3').attr('result', 'coloredBlur');
    const feMerge = glow.append('feMerge');
    feMerge.append('feMergeNode').attr('in', 'coloredBlur');
    feMerge.append('feMergeNode').attr('in', 'SourceGraphic');

    const centerNode = investigation.entity;
    const nodes = [{ ...centerNode, fx: width / 2, fy: height / 2 }];
    const links = [];

    const allConnected = [
      ...(investigation.connected_people || []),
      ...(investigation.phones || []),
      ...(investigation.vehicles || []),
      ...(investigation.locations || []),
      ...(investigation.organizations || []),
    ];

    allConnected.forEach(e => {
      nodes.push({ ...e, fx: null, fy: null });
      links.push({ source: centerNode.id, target: e.id, type: e.rel_type });
    });

    const nodeMap = new Map(nodes.map(n => [n.id, n]));
    const validLinks = links.filter(l => nodeMap.has(typeof l.source === 'string' ? l.source : l.source.id) && nodeMap.has(typeof l.target === 'string' ? l.target : l.target.id));

    const g = svg.append('g');

    const link = g.append('g')
      .selectAll('line')
      .data(validLinks)
      .join('line')
      .attr('stroke', '#1e3a5f')
      .attr('stroke-width', 1.5)
      .attr('stroke-opacity', 0.6);

    // Link labels
    g.append('g')
      .selectAll('text')
      .data(validLinks)
      .join('text')
      .attr('font-size', '9px')
      .attr('fill', '#475569')
      .attr('text-anchor', 'middle')
      .text(d => d.type?.replace(/_/g, ' ') || '')
      .attr('x', d => ((d.source.x || 0) + (d.target.x || 0)) / 2)
      .attr('y', d => ((d.source.y || 0) + (d.target.y || 0)) / 2 - 5);

    const nodeG = g.append('g')
      .selectAll('g')
      .data(nodes)
      .join('g')
      .attr('cursor', 'pointer')
      .call(d3.drag()
        .on('start', (event, d) => { if (!event.active) sim.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; })
        .on('drag', (event, d) => { d.fx = event.x; d.fy = event.y; })
        .on('end', (event, d) => { if (!event.active) sim.alphaTarget(0); d.fx = null; d.fy = null; })
      );

    nodeG.append('circle')
      .attr('r', d => d.id === centerNode.id ? 22 : 12)
      .attr('fill', d => ENTITY_COLORS[d.entity_type] || '#94a3b8')
      .attr('stroke', d => d.id === centerNode.id ? '#ffffff' : 'transparent')
      .attr('stroke-width', 2)
      .attr('filter', 'url(#glow2)');

    nodeG.append('text')
      .text(d => d.name.length > 16 ? d.name.substring(0, 16) + '...' : d.name)
      .attr('x', d => (d.id === centerNode.id ? 22 : 12) + 6)
      .attr('y', 5)
      .attr('font-size', '11px')
      .attr('fill', '#94a3b8');

    nodeG.on('click', (event, d) => {
      if (d.id !== centerNode.id) navigate(`/investigation/${d.id}`);
    });

    const sim = d3.forceSimulation(nodes)
      .force('link', d3.forceLink(validLinks).id(d => d.id).distance(95))
      .force('charge', d3.forceManyBody().strength(-140))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('x', d3.forceX(width / 2).strength(0.1))
      .force('y', d3.forceY(height / 2).strength(0.1))
      .on('tick', () => {
        nodeG.attr('transform', d => `translate(${d.x || d.fx || 0},${d.y || d.fy || 0})`);
        link
          .attr('x1', d => d.source.x || 0)
          .attr('y1', d => d.source.y || 0)
          .attr('x2', d => d.target.x || 0)
          .attr('y2', d => d.target.y || 0);
      });
  };

  const riskScore = investigation?.risk_score;
  const analysis = investigation?.analysis;
  const totalConnections = analysis?.network?.degree ?? ((investigation?.connected_people?.length || 0) +
    (investigation?.phones?.length || 0) +
    (investigation?.vehicles?.length || 0) +
    (investigation?.locations?.length || 0) +
    (investigation?.organizations?.length || 0));

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-white">Investigation View</h1>
        <p className="text-sm" style={{ color: '#94a3b8' }}>Select an entity to investigate</p>
      </div>

      {investigationError && (
        <div className="glass-card rounded-xl p-6" style={{ border: '1px solid #ef444440', background: '#ef444415' }}>
          <p className="text-sm" style={{ color: '#ef4444' }}>{investigationError}</p>
        </div>
      )}

      <div className="flex flex-col xl:flex-row gap-6">
        {/* Left sidebar - entity list */}
        <div className="w-full xl:w-80 space-y-4 flex-shrink-0">
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search entities..."
              className="w-full px-4 py-3 pl-10 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              style={{ background: '#111827', border: '1px solid #1e3a5f' }}
            />
            <div className="absolute left-3 top-0 h-full flex items-center pointer-events-none">
              <svg className="w-4 h-4" style={{ color: '#64748b' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>

          {searchResults.length > 0 && (
            <div className="glass-card rounded-lg max-h-48 overflow-y-auto">
              {searchResults.map(e => (
                <div
                  key={e.id}
                  onClick={() => { navigate(`/investigation/${e.id}`); setSearchQuery(''); setSearchResults([]); }}
                  className="flex items-center gap-2 p-2.5 cursor-pointer hover:bg-white/5 border-b last:border-0"
                  style={{ borderColor: '#1e3a5f' }}
                >
                  <div className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                    style={{ background: `${ENTITY_COLORS[e.entity_type]}20`, color: ENTITY_COLORS[e.entity_type] }}>
                    {e.name.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-white truncate">{e.name}</p>
                    <p className="text-xs" style={{ color: '#64748b' }}>{e.entity_type}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="glass-card p-4 rounded-xl">
            <h3 className="text-xs font-semibold text-gray-300 mb-3">All Entities ({allEntities.length})</h3>
            <div className="max-h-[calc(100vh-320px)] overflow-y-auto space-y-1">
              {allEntities.map(e => (
                <div
                  key={e.id}
                  onClick={() => navigate(`/investigation/${e.id}`)}
                  className={`flex items-center gap-2.5 p-2 rounded-md cursor-pointer text-xs transition-all ${entityId === e.id ? 'bg-blue-500/10' : 'hover:bg-white/5'}`}
                >
                  <div className="w-5 h-5 rounded-full flex items-center justify-center text-xs flex-shrink-0"
                    style={{ background: `${ENTITY_COLORS[e.entity_type]}20`, color: ENTITY_COLORS[e.entity_type] }}>
                    {e.name.charAt(0)}
                  </div>
                  <span className="text-gray-300 truncate">{e.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1 space-y-6 min-w-0">
          {loading && (
            <div className="flex justify-center py-20">
              <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {investigation && !loading && (
            <>
              {/* Entity header with risk score */}
              <div className="glass-card p-6 rounded-xl">
                <div className="flex items-start gap-5">
                  <div className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold flex-shrink-0"
                    style={{ background: `${ENTITY_COLORS[investigation.entity.entity_type]}20`, color: ENTITY_COLORS[investigation.entity.entity_type] }}>
                    {investigation.entity.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 flex-wrap">
                      <h2 className="text-2xl font-bold text-white">{investigation.entity.name}</h2>
                      <span className="text-xs px-2 py-0.5 rounded" style={{ background: `${ENTITY_COLORS[investigation.entity.entity_type]}20`, color: ENTITY_COLORS[investigation.entity.entity_type] }}>
                        {investigation.entity.entity_type}
                      </span>
                    </div>

                    {/* Key metrics row */}
                    <div className="flex items-center gap-8 mt-4 flex-wrap">
                      <div className="flex items-center gap-2">
                        <span className="text-xs" style={{ color: '#64748b' }}>Centrality</span>
                        <span className="text-sm font-mono font-bold" style={{ color: '#3b82f6' }}>
                          {(investigation.entity.centrality_score * 100).toFixed(1)}%
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs" style={{ color: '#64748b' }}>Connections</span>
                        <span className="text-sm font-mono font-bold" style={{ color: '#06b6d4' }}>
                          {totalConnections}
                        </span>
                      </div>
                      {riskScore && (
                        <div className="flex items-center gap-2">
                          <span className="text-xs" style={{ color: '#64748b' }}>Review Score</span>
                          <span className="text-lg font-bold font-mono" style={{ color: getRiskColor(riskScore.score) }}>
                            {riskScore.score}%
                          </span>
                          <span className="text-xs px-2 py-1 rounded-full" style={{
                            background: riskScore.severity === 'high' ? '#ef444420' : riskScore.severity === 'medium' ? '#f59e0b20' : '#10b98120',
                            color: riskScore.severity === 'high' ? '#ef4444' : riskScore.severity === 'medium' ? '#f59e0b' : '#10b981'
                          }}>
                            {riskScore.severity?.toUpperCase()}
                          </span>
                        </div>
                      )}
                    </div>

                    {riskScore?.explanation && (
                      <p className="text-xs mt-3" style={{ color: '#64748b' }}>{riskScore.explanation}</p>
                    )}
                  </div>

                  <button
                    onClick={() => navigate('/network', { state: { highlightEntity: entityId } })}
                    className="px-5 py-2.5 rounded-lg text-xs font-medium flex-shrink-0 flex items-center gap-2"
                    style={{ border: '1px solid #1e3a5f', color: '#94a3b8' }}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                    </svg>
                    View Full Network
                  </button>
                </div>
              </div>

              {/* Properties */}
              {investigation.entity.properties && Object.keys(investigation.entity.properties).length > 0 && (
                <div className="glass-card p-6 rounded-xl">
                  <h3 className="text-xs font-semibold text-gray-300 mb-4">Details</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {Object.entries(investigation.entity.properties).map(([key, val]) => (
                      <div key={key} className="p-3 rounded-lg" style={{ background: '#111827' }}>
                        <p className="text-xs" style={{ color: '#64748b' }}>{key}</p>
                        <p className="text-xs text-white font-medium">{String(val)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Entity Analysis */}
              {(analysis || riskScore) && (
                <div className="glass-card p-6 rounded-xl space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <svg className="w-4 h-4" style={{ color: '#8b5cf6' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                      <h3 className="text-sm font-semibold text-gray-300">Entity Analysis</h3>
                    </div>
                    <span className="text-xs" style={{ color: '#64748b' }}>Computed from live network data</span>
                  </div>

                  {/* Overview */}
                  <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
                    {[
                      { label: 'Connections', value: analysis?.overview?.connection_count, color: '#06b6d4' },
                      { label: 'Related Cases', value: analysis?.overview?.related_case_count ?? investigation?.related_cases?.length, color: '#ec4899' },
                      { label: 'Organizations', value: analysis?.overview?.organization_count, color: '#8b5cf6' },
                      { label: 'Locations', value: analysis?.overview?.location_count, color: '#10b981' },
                      { label: 'Phones', value: analysis?.overview?.phone_count, color: '#f59e0b' },
                      { label: 'Vehicles', value: analysis?.overview?.vehicle_count, color: '#3b82f6' },
                    ].map(m => (
                      <div key={m.label} className="p-3 rounded-lg" style={{ background: '#111827', border: '1px solid #1e3a5f' }}>
                        <p className="text-xs" style={{ color: '#64748b' }}>{m.label}</p>
                        <p className="text-lg font-bold font-mono mt-1" style={{ color: m.color }}>{m.value ?? '-'}</p>
                      </div>
                    ))}
                  </div>

                  {/* Network analysis */}
                  <div>
                    <h4 className="text-xs font-semibold text-gray-300 mb-3">Network Analysis</h4>
                    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
                      <div className="p-3 rounded-lg" style={{ background: '#111827', border: '1px solid #1e3a5f' }}>
                        <p className="text-xs" style={{ color: '#64748b' }}>Degree</p>
                        <p className="text-sm font-mono font-bold mt-1 text-white">{analysis?.network?.degree ?? '-'}</p>
                      </div>
                      <div className="p-3 rounded-lg" style={{ background: '#111827', border: '1px solid #1e3a5f' }}>
                        <p className="text-xs" style={{ color: '#64748b' }}>Centrality</p>
                        <p className="text-sm font-mono font-bold mt-1" style={{ color: '#3b82f6' }}>
                          {analysis ? `${(analysis.network.centrality_score * 100).toFixed(1)}%` : '-'}
                        </p>
                      </div>
                      <div className="p-3 rounded-lg" style={{ background: '#111827', border: '1px solid #1e3a5f' }}>
                        <p className="text-xs" style={{ color: '#64748b' }}>Centrality Rank</p>
                        <p className="text-sm font-mono font-bold mt-1 text-white">
                          {analysis?.network?.centrality_rank ? `#${analysis.network.centrality_rank} / ${analysis.network.total_entities}` : '-'}
                        </p>
                      </div>
                      <div className="p-3 rounded-lg" style={{ background: '#111827', border: '1px solid #1e3a5f' }}>
                        <p className="text-xs" style={{ color: '#64748b' }}>Clusters</p>
                        <p className="text-sm font-mono font-bold mt-1 text-white">{analysis?.network?.cluster_count ?? '-'}</p>
                      </div>
                      <div className="p-3 rounded-lg" style={{ background: '#111827', border: '1px solid #1e3a5f' }}>
                        <p className="text-xs" style={{ color: '#64748b' }}>Betweenness</p>
                        <p className="text-sm font-mono font-bold mt-1 text-white">{analysis?.network?.betweenness ?? '-'}</p>
                      </div>
                      <div className="p-3 rounded-lg" style={{ background: '#111827', border: '1px solid #1e3a5f' }}>
                        <p className="text-xs" style={{ color: '#64748b' }}>Role</p>
                        <p className="text-sm font-bold mt-1">
                          {!analysis ? '-' : analysis.network.is_hub
                            ? <span className="text-violet-400">Hub</span>
                            : analysis.network.is_bridge
                              ? <span className="text-amber-400">Bridge</span>
                              : <span className="text-gray-400">Standard</span>}
                        </p>
                      </div>
                    </div>
                    {(analysis?.network?.is_hub || analysis?.network?.is_bridge) && (
                      <div className="flex gap-2 mt-3 flex-wrap">
                        {analysis.network.is_hub && (
                          <span className="text-xs px-2 py-1 rounded-full" style={{ background: '#8b5cf620', color: '#8b5cf6' }}>Hub node — high connectivity</span>
                        )}
                        {analysis.network.is_bridge && (
                          <span className="text-xs px-2 py-1 rounded-full" style={{ background: '#f59e0b20', color: '#f59e0b' }}>Bridge node — links network groups</span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Flagged reasons */}
                  <div>
                    <h4 className="text-xs font-semibold text-gray-300 mb-3">Why this entity was flagged for review</h4>
                    {analysis?.flagged_reasons?.length > 0 ? (
                      <div className="space-y-2">
                        {analysis.flagged_reasons.map((r, i) => (
                          <div key={i} className="flex items-start gap-3 p-3 rounded-lg" style={{ background: '#111827', border: '1px solid #22314e' }}>
                            <svg className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: '#f59e0b' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                            <div className="min-w-0">
                              <p className="text-xs font-medium text-white">{r.text}</p>
                              <p className="text-xs mt-0.5" style={{ color: '#64748b' }}>{r.detail}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs" style={{ color: '#64748b' }}>
                        No significant indicators detected beyond normal network activity.
                      </p>
                    )}
                  </div>

                  {/* Review score factors */}
                  {riskScore && (
                    <div className="p-4 rounded-lg" style={{ background: '#111827', border: '1px solid #22314e' }}>
                      <div className="flex items-center gap-4 flex-wrap">
                        <div className="flex flex-col items-center">
                          <span className="text-[10px] uppercase tracking-wider" style={{ color: '#64748b' }}>Review Score</span>
                          <span className="text-3xl font-bold font-mono" style={{ color: getRiskColor(riskScore.score) }}>{riskScore.score}%</span>
                          <span className="text-xs px-2 py-0.5 rounded-full mt-1" style={{
                            background: riskScore.severity === 'high' ? '#ef444420' : riskScore.severity === 'medium' ? '#f59e0b20' : '#10b98120',
                            color: riskScore.severity === 'high' ? '#ef4444' : riskScore.severity === 'medium' ? '#f59e0b' : '#10b981'
                          }}>
                            {riskScore.severity?.toUpperCase()}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-white">{riskScore.label}</p>
                          {riskScore.factors?.length > 0 && (
                            <div className="mt-3 space-y-2">
                              {riskScore.factors.map((f, i) => (
                                <div key={i} className="flex items-center justify-between gap-3">
                                  <div className="min-w-0">
                                    <p className="text-xs text-gray-300">{f.label}</p>
                                    <p className="text-xs truncate" style={{ color: '#64748b' }}>{f.detail}</p>
                                  </div>
                                  <span className="text-xs font-mono font-bold flex-shrink-0" style={{ color: getRiskColor(riskScore.score) }}>+{f.points}</span>
                                </div>
                              ))}
                              <div className="flex items-center justify-between pt-2 border-t" style={{ borderColor: '#22314e' }}>
                                <span className="text-xs font-semibold text-white">Total</span>
                                <span className="text-sm font-mono font-bold" style={{ color: getRiskColor(riskScore.score) }}>{riskScore.score}%</span>
                              </div>
                            </div>
                          )}
                          {riskScore.disclaimer && (
                            <p className="text-[10px] mt-3 italic" style={{ color: '#475569' }}>{riskScore.disclaimer}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Investigation Timeline */}
              <div className="glass-card p-6 rounded-xl space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4" style={{ color: '#10b981' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <h3 className="text-sm font-semibold text-gray-300">Investigation Timeline</h3>
                  </div>
                  {!timelineLoading && !timelineError && timeline && (
                    <span className="text-xs" style={{ color: '#64748b' }}>Chronological record of recorded case and relationship activity</span>
                  )}
                </div>

                {timelineLoading && (
                  <div className="flex items-center justify-center py-10">
                    <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                  </div>
                )}

                {timelineError && (
                  <div className="p-4 rounded-lg" style={{ background: '#ef444410', border: '1px solid #ef444440' }}>
                    <p className="text-xs" style={{ color: '#fca5a5' }}>{timelineError}</p>
                    <button
                      onClick={() => loadTimeline(entityId)}
                      className="mt-2 text-xs px-3 py-1.5 rounded-md font-medium"
                      style={{ background: '#ef444420', color: '#fca5a5' }}
                    >
                      Retry
                    </button>
                  </div>
                )}

                {!timelineLoading && !timelineError && timeline && (
                  <>
                    {/* Timeline summary */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {[
                        { label: 'Total Events', value: timeline.summary.total_events, color: '#10b981' },
                        { label: 'First Recorded Activity', value: timeline.summary.first_recorded || '—', color: '#3b82f6' },
                        { label: 'Latest Recorded Activity', value: timeline.summary.latest_recorded || '—', color: '#8b5cf6' },
                        { label: 'Related Cases', value: timeline.summary.related_cases, color: '#06b6d4' },
                      ].map(s => (
                        <div key={s.label} className="p-3 rounded-lg" style={{ background: '#111827', border: '1px solid #1e3a5f' }}>
                          <p className="text-[11px]" style={{ color: '#64748b' }}>{s.label}</p>
                          <p className="text-sm font-bold font-mono mt-0.5" style={{ color: s.color }}>{s.value}</p>
                        </div>
                      ))}
                    </div>

                    {/* Timeline filters */}
                    <div className="flex items-center gap-2 flex-wrap">
                      {TIMELINE_FILTERS.map(f => {
                        const count = f.key === 'all'
                          ? timeline.events.length
                          : (timeline.category_counts?.[f.key] || 0);
                        const active = timelineFilter === f.key;
                        const color = TIMELINE_CATEGORY_COLORS[f.key] || '#94a3b8';
                        const enabled = f.key === 'all' || count > 0;
                        return (
                          <button
                            key={f.key}
                            onClick={() => { if (enabled) setTimelineFilter(f.key); }}
                            disabled={!enabled}
                            className="text-xs px-3 py-1.5 rounded-full font-medium transition-colors"
                            style={{
                              background: active ? `${color}25` : '#111827',
                              border: `1px solid ${active ? color : '#22314e'}`,
                              color: active ? color : '#94a3b8',
                              opacity: enabled ? 1 : 0.4,
                              cursor: enabled ? 'pointer' : 'not-allowed',
                            }}
                          >
                            {f.label} · {count}
                          </button>
                        );
                      })}
                    </div>

                    {/* Timeline events */}
                    {timeline.events.length === 0 ? (
                      <div className="p-10 text-center rounded-lg" style={{ background: '#111827', border: '1px dashed #22314e' }}>
                        <svg className="w-10 h-10 mx-auto mb-3" style={{ color: '#334155' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <p className="text-sm text-gray-400">No timeline activity available for this entity.</p>
                        <p className="text-xs mt-1" style={{ color: '#64748b' }}>Activity appears here once recorded cases or relationships exist.</p>
                      </div>
                    ) : (
                      <div className="relative min-w-0">
                        <div className="absolute left-[7px] top-2 bottom-2 w-px" style={{ background: '#22314e' }} />
                        <div className="space-y-4 min-w-0">
                          {timeline.events
                            .filter(e => timelineFilter === 'all' || e.category === timelineFilter)
                            .map(event => {
                              const color = TIMELINE_CATEGORY_COLORS[event.category] || '#94a3b8';
                              return (
                                <div key={event.id} className="relative flex gap-4 min-w-0">
                                  <div className="w-4 flex-shrink-0 relative z-10">
                                    <div className="w-3.5 h-3.5 rounded-full mt-4" style={{ background: color, boxShadow: `0 0 0 4px ${color}20` }} />
                                  </div>
                                  <div className="flex-1 min-w-0 p-4 rounded-lg transition-colors" style={{ background: '#111827', border: '1px solid #1e3a5f' }}>
                                    <div className="flex items-center gap-2 flex-wrap">
                                      {event.date ? (
                                        <span className="text-xs font-mono font-bold" style={{ color }}>{event.date}</span>
                                      ) : (
                                        <span className="text-xs px-2 py-0.5 rounded" style={{ background: '#22314e', color: '#64748b' }}>Date not recorded</span>
                                      )}
                                      <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ background: `${color}20`, color }}>{event.event_type}</span>
                                      <span className="text-[10px] px-2 py-0.5 rounded" style={{ background: '#0f172a', color: '#64748b' }}>{event.rel_label}</span>
                                    </div>
                                    <p className="text-sm text-white mt-2 break-words">{event.description}</p>
                                    {(event.related_case || event.related_entity || event.location) && (
                                      <div className="flex items-center gap-3 flex-wrap mt-2.5">
                                        {event.related_case?.id && (
                                          <button
                                            onClick={() => navigate('/cases', { state: { selectedCaseId: event.related_case.id } })}
                                            className="text-xs px-2.5 py-1 rounded-md font-medium flex items-center gap-1.5"
                                            style={{ background: '#06b6d420', color: '#22d3ee' }}
                                          >
                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                            </svg>
                                            {event.related_case.fir_number || 'View Case'}
                                          </button>
                                        )}
                                        {event.related_entity?.id && (
                                          <button
                                            onClick={() => navigate(`/investigation/${event.related_entity.id}`)}
                                            className="text-xs px-2.5 py-1 rounded-md font-medium flex items-center gap-1.5"
                                            style={{ background: '#3b82f620', color: '#60a5fa' }}
                                          >
                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                            {event.related_entity.name} · {event.related_entity.entity_type}
                                          </button>
                                        )}
                                        {event.location && (
                                          <span className="text-xs flex items-center gap-1.5" style={{ color: '#64748b' }}>
                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                            </svg>
                                            {event.location}
                                          </span>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Related cases */}
              {investigation.related_cases?.length > 0 && (
                <div className="glass-card p-6 rounded-xl">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <svg className="w-4 h-4" style={{ color: '#06b6d4' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <h3 className="text-xs font-semibold text-gray-300">Related Cases</h3>
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: '#06b6d420', color: '#06b6d4' }}>
                      {investigation.related_cases.length}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {investigation.related_cases.map((c, i) => (
                      <div
                        key={c.id || i}
                        onClick={() => navigate('/cases', { state: { selectedCaseId: c.id } })}
                        className="p-4 rounded-lg cursor-pointer hover:bg-white/5 transition-colors"
                        style={{ background: '#111827', border: '1px solid #1e3a5f' }}
                      >
                        <div className="flex items-center justify-between gap-3 mb-2">
                          <span className="text-xs font-mono font-semibold" style={{ color: '#06b6d4' }}>{c.fir_number}</span>
                          <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: '#06b6d420', color: '#06b6d4' }}>
                            {String(c.rel_type || '').replace(/_/g, ' ').toLowerCase()}
                          </span>
                        </div>
                        <p className="text-sm font-medium text-white truncate">{c.title}</p>
                        <div className="flex items-center gap-4 mt-2 text-xs" style={{ color: '#64748b' }}>
                          <span className="flex items-center gap-1">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            {c.date || '—'}
                          </span>
                          <span className="flex items-center gap-1 truncate">
                            <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            </svg>
                            {c.location || '—'}
                          </span>
                        </div>
                        {c.ipc_sections && (
                          <p className="text-[10px] mt-2" style={{ color: '#475569' }}>IPC: {c.ipc_sections}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Connected items grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {[
                  { title: 'Connected People', items: investigation.connected_people, color: '#3b82f6', icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z' },
                  { title: 'Phones', items: investigation.phones, color: '#ec4899', icon: 'M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z' },
                  { title: 'Vehicles', items: investigation.vehicles, color: '#f59e0b', icon: 'M8 17h8M8 17v-4h8v4M8 17H5a1 1 0 01-1-1v-3a1 1 0 011-1h1m0 0h10m-10 0v-1a1 1 0 011-1h8a1 1 0 011 1v1' },
                  { title: 'Locations', items: investigation.locations, color: '#10b981', icon: 'M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z M15 11a3 3 0 11-6 0 3 3 0 016 0z' },
                  { title: 'Organizations', items: investigation.organizations, color: '#8b5cf6', icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4' },
                ].map(({ title, items, color, icon }) => (
                  <div key={title} className="glass-card p-5 rounded-xl">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <svg className="w-4 h-4" style={{ color }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={icon} />
                        </svg>
                        <h3 className="text-xs font-semibold" style={{ color }}>{title}</h3>
                      </div>
                      <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: `${color}20`, color }}>
                        {items?.length || 0}
                      </span>
                    </div>
                    <div className="space-y-2">
                      {items?.length > 0 ? items.map((item, i) => (
                        <div
                          key={i}
                          onClick={() => item.id && navigate(`/investigation/${item.id}`)}
                          className="flex items-center gap-2.5 p-2 rounded cursor-pointer hover:bg-white/5"
                        >
                          <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                            style={{ background: `${ENTITY_COLORS[item.entity_type] || color}20`, color: ENTITY_COLORS[item.entity_type] || color }}>
                            {item.name?.charAt(0) || item.fir_number?.charAt(0) || '?'}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-white truncate">{item.name || 'Unknown'}</p>
                            {item.rel_type && (
                              <p className="text-[10px] truncate mt-0.5" style={{ color }}>{String(item.rel_type).replace(/_/g, ' ')}</p>
                            )}
                          </div>
                        </div>
                      )) : (
                        <p className="text-xs" style={{ color: '#64748b' }}>No items found</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Mini graph */}
              <div className="glass-card p-6 rounded-xl">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xs font-semibold text-gray-300">Connection Graph</h3>
                  <span className="text-xs" style={{ color: '#64748b' }}>{totalConnections} connected entities</span>
                </div>
                <div className="mini-graph-container" ref={miniGraphRef} style={{ height: '420px' }} />
              </div>
            </>
          )}

          {!investigation && !loading && (
            <div className="glass-card p-12 text-center rounded-xl">
              <svg className="w-16 h-16 mx-auto mb-4" style={{ color: '#1e3a5f' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
              </svg>
              <p className="text-gray-400 text-sm">Select an entity from the list or search to begin investigation</p>
              <p className="text-xs mt-2" style={{ color: '#475569' }}>Click on any entity to view its connections, relationships, and risk assessment</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
