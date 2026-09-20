import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import * as d3 from 'd3';
import { getNetwork, findPath } from '../api';

const ENTITY_COLORS = {
  Person: '#3b82f6',
  Phone: '#ec4899',
  Vehicle: '#f59e0b',
  Location: '#10b981',
  Organization: '#8b5cf6',
  Case: '#06b6d4',
};

const ENTITY_SIZES = {
  Person: 14,
  Phone: 9,
  Vehicle: 11,
  Location: 10,
  Organization: 16,
  Case: 12,
};

export default function NetworkGraph() {
  const svgRef = useRef();
  const containerRef = useRef();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedNode, setSelectedNode] = useState(null);
  const [filter, setFilter] = useState('all');
  const [traceMode, setTraceMode] = useState(false);
  const [traceSource, setTraceSource] = useState(null);
  const [traceTarget, setTraceTarget] = useState(null);
  const [traceResult, setTraceResult] = useState(null);
  const [traceLoading, setTraceLoading] = useState(false);
  const [traceError, setTraceError] = useState('');
  const navigate = useNavigate();
  const location = useLocation();
  const highlightEntityId = location.state?.highlightEntity;
  const simulationRef = useRef(null);
  const zoomRef = useRef(null);
  const gRef = useRef(null);

  useEffect(() => { loadData(); }, []);

  useEffect(() => {
    if (data && highlightEntityId) {
      const entity = data.entities.find(e => e.id === highlightEntityId);
      if (entity) setSelectedNode(entity);
    }
  }, [data, highlightEntityId]);

  useEffect(() => {
    if (data) renderGraph();
  }, [data, filter, traceResult]);

  const loadData = async () => {
    try {
      const res = await getNetwork();
      setData(res.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const handleTrace = async () => {
    if (!traceSource || !traceTarget) return;
    if (traceSource === traceTarget) { setTraceError('Select two different entities'); return; }
    setTraceLoading(true);
    setTraceError('');
    setTraceResult(null);
    try {
      const res = await findPath(traceSource, traceTarget);
      if (res.data.paths && res.data.paths.length > 0) {
        setTraceResult(res.data.paths[0]);
      } else {
        setTraceError(res.data.message || 'No path found');
      }
    } catch (err) { setTraceError('Failed to find path'); } finally { setTraceLoading(false); }
  };

  const resetTrace = () => {
    setTraceMode(false);
    setTraceSource(null);
    setTraceTarget(null);
    setTraceResult(null);
    setTraceError('');
  };

  const renderGraph = useCallback(() => {
    if (!data || !svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const container = containerRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    svg.attr('width', width).attr('height', height);

    let nodes = data.entities.map(e => ({ ...e }));
    let links = data.relationships.map(r => ({ source: r.source, target: r.target, type: r.relationship_type }));

    if (filter !== 'all') {
      const nodeIds = new Set(nodes.filter(n => n.entity_type === filter).map(n => n.id));
      nodes = nodes.filter(n => n.entity_type === filter);
      links = links.filter(l => nodeIds.has(l.source?.id || l.source) && nodeIds.has(l.target?.id || l.target));
    }

    const nodeMap = new Map(nodes.map(n => [n.id, n]));
    links = links.filter(l => {
      const sid = l.source?.id || l.source;
      const tid = l.target?.id || l.target;
      return nodeMap.has(sid) && nodeMap.has(tid);
    });

    const g = svg.append('g');
    gRef.current = g;

    const zoom = d3.zoom()
      .scaleExtent([0.1, 4])
      .on('zoom', (event) => g.attr('transform', event.transform));
    svg.call(zoom);
    zoomRef.current = zoom;

    const defs = svg.append('defs');
    const glow = defs.append('filter').attr('id', 'glow');
    glow.append('feGaussianBlur').attr('stdDeviation', '4').attr('result', 'coloredBlur');
    const feMerge = glow.append('feMerge');
    feMerge.append('feMergeNode').attr('in', 'coloredBlur');
    feMerge.append('feMergeNode').attr('in', 'SourceGraphic');

    // Trace path nodes set
    const traceNodeIds = new Set();
    const traceEdgeKeys = new Set();
    if (traceResult?.nodes) {
      traceResult.nodes.forEach(n => traceNodeIds.add(n.id));
    }
    if (traceResult?.nodes) {
      for (let i = 0; i < traceResult.nodes.length - 1; i++) {
        traceEdgeKeys.add(`${traceResult.nodes[i].id}-${traceResult.nodes[i + 1].id}`);
        traceEdgeKeys.add(`${traceResult.nodes[i + 1].id}-${traceResult.nodes[i].id}`);
      }
    }

    const link = g.append('g')
      .selectAll('line')
      .data(links)
      .join('line')
      .attr('stroke', d => {
        if (traceResult) {
          const sid = d.source?.id || d.source;
          const tid = d.target?.id || d.target;
          if (traceEdgeKeys.has(`${sid}-${tid}`)) return '#f59e0b';
          return '#1e3a5f22';
        }
        return '#1e3a5f';
      })
      .attr('stroke-width', d => {
        if (traceResult) {
          const sid = d.source?.id || d.source;
          const tid = d.target?.id || d.target;
          if (traceEdgeKeys.has(`${sid}-${tid}`)) return 3;
          return 0.5;
        }
        return 1;
      })
      .attr('stroke-opacity', d => {
        if (traceResult) {
          const sid = d.source?.id || d.source;
          const tid = d.target?.id || d.target;
          return traceEdgeKeys.has(`${sid}-${tid}`) ? 1 : 0.2;
        }
        return 0.6;
      });

    // Link labels
    const linkLabel = g.append('g')
      .selectAll('text')
      .data(links)
      .join('text')
      .attr('font-size', '8px')
      .attr('fill', '#64748b')
      .attr('text-anchor', 'middle')
      .attr('pointer-events', 'none')
      .attr('opacity', 0)
      .text(d => d.type?.replace(/_/g, ' ') || '');

    // Hover overlay for links
    const linkHitArea = g.append('g')
      .selectAll('line')
      .data(links)
      .join('line')
      .attr('stroke', 'transparent')
      .attr('stroke-width', 12)
      .attr('stroke-opacity', 0)
      .attr('cursor', 'pointer')
      .on('mouseenter', (event, d) => {
        linkLabel.filter(l => l === d).attr('opacity', 1);
      })
      .on('mouseleave', () => {
        linkLabel.attr('opacity', 0);
      });

    const node = g.append('g')
      .selectAll('g')
      .data(nodes)
      .join('g')
      .attr('cursor', 'pointer')
      .call(d3.drag()
        .on('start', (event, d) => { if (!event.active) simulation.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; })
        .on('drag', (event, d) => { d.fx = event.x; d.fy = event.y; })
        .on('end', (event, d) => { if (!event.active) simulation.alphaTarget(0); if (!traceMode) { d.fx = null; d.fy = null; } })
      );

    node.append('circle')
      .attr('r', d => ENTITY_SIZES[d.entity_type] || 10)
      .attr('fill', d => ENTITY_COLORS[d.entity_type] || '#94a3b8')
      .attr('stroke', d => {
        if (traceNodeIds.has(d.id)) return '#f59e0b';
        if (d.id === selectedNode?.id) return '#ffffff';
        if (d.id === traceSource) return '#10b981';
        if (d.id === traceTarget) return '#ef4444';
        return 'transparent';
      })
      .attr('stroke-width', d => {
        if (traceNodeIds.has(d.id)) return 3;
        if (d.id === selectedNode?.id) return 3;
        if (d.id === traceSource || d.id === traceTarget) return 3;
        return 2;
      })
      .attr('filter', 'url(#glow)')
      .attr('opacity', d => {
        if (traceResult && !traceNodeIds.has(d.id)) return 0.3;
        return 1;
      });

    node.append('text')
      .text(d => d.name.length > 16 ? d.name.substring(0, 16) + '...' : d.name)
      .attr('x', d => (ENTITY_SIZES[d.entity_type] || 10) + 5)
      .attr('y', -6)
      .attr('font-size', '9px')
      .attr('fill', d => {
        if (traceResult && !traceNodeIds.has(d.id)) return '#334155';
        return '#94a3b8';
      })
      .attr('font-weight', '500');

    node.on('click', (event, d) => {
      event.stopPropagation();
      if (traceMode) {
        if (!traceSource) {
          setTraceSource(d.id);
          setTraceError('');
        } else if (!traceTarget) {
          setTraceTarget(d.id);
        }
        return;
      }
      setSelectedNode(d);
      highlightConnections(d, node, link);
    });

    node.on('dblclick', (event, d) => {
      event.stopPropagation();
      navigate(`/investigation/${d.id}`);
    });

    svg.on('click', () => {
      if (traceMode) return;
      setSelectedNode(null);
      node.selectAll('circle').attr('stroke', 'transparent').attr('stroke-width', 2);
      link.attr('stroke', '#1e3a5f').attr('stroke-width', 1).attr('stroke-opacity', 0.6);
      node.selectAll('text').attr('fill', '#94a3b8');
      node.selectAll('circle').attr('opacity', 1);
    });

    const sim = d3.forceSimulation(nodes)
      .force('link', d3.forceLink(links).id(d => d.id).distance(140))
      .force('charge', d3.forceManyBody().strength(-350))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(40))
      .force('x', d3.forceX(width / 2).strength(0.05))
      .force('y', d3.forceY(height / 2).strength(0.05))
      .on('tick', () => {
        // Boundary constraint
        const pad = 50;
        nodes.forEach(d => {
          d.x = Math.max(pad, Math.min(width - pad, d.x));
          d.y = Math.max(pad, Math.min(height - pad, d.y));
        });
        link
          .attr('x1', d => d.source.x)
          .attr('y1', d => d.source.y)
          .attr('x2', d => d.target.x)
          .attr('y2', d => d.target.y);
        linkHitArea
          .attr('x1', d => d.source.x)
          .attr('y1', d => d.source.y)
          .attr('x2', d => d.target.x)
          .attr('y2', d => d.target.y);
        linkLabel
          .attr('x', d => (d.source.x + d.target.x) / 2)
          .attr('y', d => (d.source.y + d.target.y) / 2 - 4);
        node.attr('transform', d => `translate(${d.x},${d.y})`);
      });

    simulationRef.current = sim;

  }, [data, filter, selectedNode, traceResult, traceSource, traceTarget, traceMode, navigate]);

  const highlightConnections = (selected, nodeSelection, linkSelection) => {
    const connectedIds = new Set();
    connectedIds.add(selected.id);

    linkSelection.each(function(d) {
      const sid = d.source?.id || d.source;
      const tid = d.target?.id || d.target;
      if (sid === selected.id) connectedIds.add(tid);
      if (tid === selected.id) connectedIds.add(sid);
    });

    nodeSelection.selectAll('circle')
      .attr('stroke', d => d.id === selected.id ? '#ffffff' : connectedIds.has(d.id) ? '#3b82f6' : 'transparent')
      .attr('stroke-width', d => d.id === selected.id ? 3 : 2)
      .attr('opacity', d => d.id === selected.id || connectedIds.has(d.id) ? 1 : 0.3);

    nodeSelection.selectAll('text')
      .attr('fill', d => d.id === selected.id || connectedIds.has(d.id) ? '#e2e8f0' : '#334155');

    linkSelection
      .attr('stroke', d => {
        const sid = d.source?.id || d.source;
        const tid = d.target?.id || d.target;
        return (sid === selected.id || tid === selected.id) ? '#3b82f6' : '#1e3a5f22';
      })
      .attr('stroke-width', d => {
        const sid = d.source?.id || d.source;
        const tid = d.target?.id || d.target;
        return (sid === selected.id || tid === selected.id) ? 2 : 0.5;
      })
      .attr('stroke-opacity', d => {
        const sid = d.source?.id || d.source;
        const tid = d.target?.id || d.target;
        return (sid === selected.id || tid === selected.id) ? 1 : 0.2;
      });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const getNodeName = (id) => {
    if (!data) return id;
    const node = data.entities.find(e => e.id === id);
    return node ? node.name : id;
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Knowledge Graph</h1>
          <p className="text-sm" style={{ color: '#94a3b8' }}>Interactive criminal network visualization</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {['all', 'Person', 'Organization', 'Phone', 'Vehicle', 'Location'].map(type => (
            <button
              key={type}
              onClick={() => setFilter(type)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${filter === type ? 'text-white' : 'text-gray-400 hover:text-white'}`}
              style={filter === type ? { background: ENTITY_COLORS[type] || '#3b82f6', color: 'white' } : { border: '1px solid #1e3a5f' }}
            >
              {type === 'all' ? 'All' : type}
            </button>
          ))}
          <div className="w-px h-6" style={{ background: '#1e3a5f' }} />
          <button
            onClick={() => {
              if (svgRef.current && zoomRef.current && gRef.current) {
                const svg = d3.select(svgRef.current);
                svg.transition().duration(500).call(
                  zoomRef.current.transform,
                  d3.zoomIdentity
                );
                if (simulationRef.current) {
                  simulationRef.current.alpha(0.3).restart();
                }
              }
            }}
            className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:bg-white/10"
            style={{ border: '1px solid #1e3a5f', color: '#94a3b8' }}
          >
            Reset View
          </button>
          <button
            onClick={() => { if (traceMode) { resetTrace(); } else { setTraceMode(true); } }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${traceMode ? 'text-white' : 'text-gray-400 hover:text-white'}`}
            style={traceMode ? { background: '#f59e0b', color: 'white' } : { border: '1px solid #1e3a5f' }}
          >
            {traceMode ? 'Cancel Trace' : 'Trace Connection'}
          </button>
        </div>
      </div>

      {traceMode && (
        <div className="glass-card p-3 rounded-xl flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ background: traceSource ? '#10b981' : '#334155' }} />
            <span className="text-xs" style={{ color: traceSource ? '#e2e8f0' : '#64748b' }}>
              {traceSource ? getNodeName(traceSource) : 'Click source node'}
            </span>
          </div>
          <svg className="w-4 h-4" style={{ color: '#64748b' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
          </svg>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ background: traceTarget ? '#ef4444' : '#334155' }} />
            <span className="text-xs" style={{ color: traceTarget ? '#e2e8f0' : '#64748b' }}>
              {traceTarget ? getNodeName(traceTarget) : 'Click target node'}
            </span>
          </div>
          {traceSource && traceTarget && (
            <button
              onClick={handleTrace}
              disabled={traceLoading}
              className="px-4 py-1.5 rounded-lg text-xs font-medium text-white"
              style={{ background: '#f59e0b' }}
            >
              {traceLoading ? 'Tracing...' : 'Find Path'}
            </button>
          )}
          {traceResult && (
            <span className="text-xs font-mono px-2 py-1 rounded" style={{ background: '#f59e0b20', color: '#f59e0b' }}>
              {traceResult.length} hops
            </span>
          )}
          {traceError && (
            <span className="text-xs" style={{ color: '#ef4444' }}>{traceError}</span>
          )}
        </div>
      )}

      <div className="flex gap-4">
        <div ref={containerRef} className="flex-1 glass-card rounded-xl overflow-hidden" style={{ height: 'calc(100vh - 220px)' }}>
          <svg ref={svgRef} className="w-full h-full" />
        </div>

        {selectedNode && !traceMode && (
          <div className="w-80 glass-card p-4 rounded-xl space-y-4 flex-shrink-0">
            <div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ background: ENTITY_COLORS[selectedNode.entity_type] }} />
                <span className="text-xs px-2 py-0.5 rounded" style={{ background: `${ENTITY_COLORS[selectedNode.entity_type]}20`, color: ENTITY_COLORS[selectedNode.entity_type] }}>
                  {selectedNode.entity_type}
                </span>
              </div>
              <h3 className="text-lg font-bold text-white mt-2">{selectedNode.name}</h3>
              <p className="text-xs mt-1" style={{ color: '#64748b' }}>
                Centrality: {(selectedNode.centrality_score * 100).toFixed(1)}% · Connections: {selectedNode.connection_count}
              </p>
            </div>

            {selectedNode.properties && Object.keys(selectedNode.properties).length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-gray-400 mb-2">Properties</h4>
                <div className="space-y-1">
                  {Object.entries(selectedNode.properties).map(([key, val]) => (
                    <div key={key} className="flex justify-between text-xs">
                      <span style={{ color: '#64748b' }}>{key}</span>
                      <span className="text-gray-300">{String(val)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button
              onClick={() => navigate(`/investigation/${selectedNode.id}`)}
              className="w-full py-2 rounded-lg text-sm font-medium text-white"
              style={{ background: 'linear-gradient(135deg, #3b82f6, #06b6d4)' }}
            >
              View Investigation
            </button>
          </div>
        )}
      </div>

      <div className="flex items-center gap-4 text-xs flex-wrap" style={{ color: '#64748b' }}>
        {Object.entries(ENTITY_COLORS).map(([type, color]) => (
          <div key={type} className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full" style={{ background: color }} />
            <span>{type}</span>
          </div>
        ))}
      </div>

      <div className="text-xs" style={{ color: '#475569' }}>
        Click to select · Drag to move nodes · Scroll to zoom · Double-click to investigate · Hover edges for relationship labels
      </div>
    </div>
  );
}
