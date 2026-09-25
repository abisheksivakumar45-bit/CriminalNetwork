import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { naturalSearch } from '../api';
import { resolveApiError } from '../utils/errors';

const ENTITY_COLORS = {
  Person: '#3b82f6', Phone: '#ec4899', Vehicle: '#f59e0b',
  Location: '#10b981', Organization: '#8b5cf6', Case: '#06b6d4',
};

const EXAMPLE_SUGGESTIONS = [
  'Show all entities connected to Rajesh Kumar.',
  'Show people connected to Rajesh Kumar through organizations.',
  'Show organizations connected to Rajesh Kumar.',
  'Show people connected to phone 9876543210.',
  'Find entities appearing in more than two cases.',
  'Show cases involving Rajesh Kumar.',
  'Show entities connected to entities in case FIR-2024-001.',
];

const REL_LABELS = {
  OWNS: 'owns', USES: 'uses', LOCATED_AT: 'located at', MEMBER_OF: 'member of',
  SUSPECTED_IN: 'suspected in', VICTIM_IN: 'victim in', ASSOCIATED_WITH: 'associated with',
  CONTACTED: 'contacted', TRAVELED_WITH: 'traveled with', FUNDED_BY: 'funded by',
};

const relLabel = (r) => (REL_LABELS[r] || String(r || '').replace(/_/g, ' ').toLowerCase());

export default function NaturalSearch() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [submitted, setSubmitted] = useState('');
  const [response, setResponse] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const runSearch = async (text, entityId) => {
    if (!text || !text.trim()) return;
    setLoading(true);
    setError('');
    setSubmitted(text.trim());
    try {
      const res = await naturalSearch(text, entityId);
      setResponse(res.data);
    } catch (err) {
      setResponse(null);
      setError(resolveApiError(err, 'Could not run the investigation search.'));
    } finally {
      setLoading(false);
    }
  };

  const data = response;
  const status = data?.status;

  const renderInterpretation = () => {
    if (!data || status === 'unsupported' || !data.interpretation) return null;
    const interp = data.interpretation;
    const chips = [];
    if (interp.target_entity) chips.push(['Target', interp.target_entity]);
    if (interp.target_type) chips.push(['Target type', interp.target_type]);
    if (interp.via_type) chips.push(['Via', interp.via_type]);
    if (interp.threshold !== undefined) chips.push(['Threshold', `${interp.condition === 'gt' ? 'more than' : 'at least'} ${interp.threshold} cases`]);
    if (interp.case_ref) chips.push(['Case', interp.case_ref]);
    return (
      <div className="glass-card rounded-xl p-5 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4" style={{ color: '#06b6d4' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            <h3 className="text-sm font-semibold text-gray-300">System interpretation</h3>
          </div>
          <span className="text-xs font-mono px-2 py-0.5 rounded-full" style={{ background: '#06b6d420', color: '#06b6d4' }}>
            {interp.summary}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {chips.map(([label, value]) => (
            <span key={label} className="text-xs px-2.5 py-1 rounded-lg flex items-center gap-1.5" style={{ background: '#111827', border: '1px solid #22314e' }}>
              <span className="text-[10px] uppercase tracking-wider" style={{ color: '#64748b' }}>{label}</span>
              <span className="font-medium text-gray-200">{value}</span>
            </span>
          ))}
          {interp.path && (
            <span className="text-xs px-2.5 py-1 rounded-lg flex items-center gap-1.5" style={{ background: '#111827', border: '1px solid #22314e' }}>
              <span className="text-[10px] uppercase tracking-wider" style={{ color: '#64748b' }}>Path</span>
              <span className="font-medium" style={{ color: '#8b5cf6' }}>{interp.path.join(' → ')}</span>
            </span>
          )}
        </div>
      </div>
    );
  };

  const renderEntityResult = (item) => {
    const color = ENTITY_COLORS[item.entity_type] || '#94a3b8';
    return (
      <div key={item.id} className="glass-card rounded-xl p-4" style={{ borderColor: '1px solid #1e3a5f' }}>
        {item.via ? (
          <div className="space-y-1.5">
            {item.path.map((node, i) => (
              <div key={i} className="flex items-start gap-2">
                <div className="flex flex-col items-center">
                  <div className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                    style={{ background: `${ENTITY_COLORS[node.entity_type] || '#64748b'}20`, color: ENTITY_COLORS[node.entity_type] || '#94a3b8' }}>
                    {String(node.name || '?').charAt(0)}
                  </div>
                  {i < item.path.length - 1 && <div className="w-px h-5" style={{ background: '#22314e' }} />}
                </div>
                <div className="min-w-0">
                  <button
                    onClick={() => node.id && node.role !== 'via' && navigate(`/investigation/${node.id}`)}
                    className={`text-sm truncate ${node.role !== 'via' ? 'hover:underline text-white' : ''}`}
                    style={node.role === 'via' ? { color: '#8b5cf6', cursor: 'default' } : {}}
                  >
                    {node.name}
                  </button>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: '#0f172a', color: '#64748b' }}>{node.entity_type || (node.role === 'start' ? 'Entity' : 'Case')}</span>
                    {i < item.path.length - 1 && (
                      <span className="text-[10px] font-mono" style={{ color: '#475569' }}>{relLabel(item.path[i].role === 'start' ? item.via?.to_via : item.via?.from_via)}</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold flex-shrink-0"
              style={{ background: `${color}20`, color }}>
              {String(item.name || '?').charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <button onClick={() => item.id && navigate(`/investigation/${item.id}`)} className="text-sm font-semibold text-white hover:underline truncate block">
                {item.name}
              </button>
              <div className="flex items-center gap-2 flex-wrap mt-0.5">
                <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: `${color}20`, color }}>{item.entity_type}</span>
                {item.relationship_type && <span className="text-[10px] font-mono" style={{ color: '#64748b' }}>{relLabel(item.relationship_type)}</span>}
                {item.related_case_count > 0 && (
                  <span className="text-[10px]" style={{ color: '#06b6d4' }}>
                    {item.related_case_count} case{item.related_case_count === 1 ? '' : 's'}{item.case_ids?.length ? ': ' + item.case_ids.join(', ') : ''}
                  </span>
                )}
              </div>
            </div>
          </div>
        )}
        <div className="flex items-center gap-2 mt-3">
          {item.id && (
            <button
              onClick={() => navigate(`/investigation/${item.id}`)}
              className="text-xs px-3 py-1.5 rounded-lg font-medium flex items-center gap-1.5 transition-colors hover:bg-white/5"
              style={{ background: '#3b82f620', color: '#60a5fa' }}
            >
              View Investigation
            </button>
          )}
          {(item.case_ids || []).filter(Boolean).slice(0, 3).map((fir) => (
            <button
              key={fir}
              onClick={() => navigate('/cases')}
              className="text-xs px-2.5 py-1.5 rounded-lg font-mono flex items-center gap-1.5"
              style={{ background: '#06b6d420', color: '#22d3ee' }}
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              {fir}
            </button>
          ))}
        </div>
      </div>
    );
  };

  const renderCaseResult = (item) => {
    const status = item.status || 'Under Investigation';
    const statusColor = status === 'Closed' ? '#10b981' : status === 'Arrest Made' ? '#f59e0b' : '#06b6d4';
    return (
      <div key={item.id} className="glass-card rounded-xl p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-mono font-bold" style={{ color: '#06b6d4' }}>{item.fir_number}</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: `${statusColor}20`, color: statusColor }}>{status}</span>
              {item.relationship_type && <span className="text-[10px] font-mono" style={{ color: '#64748b' }}>{relLabel(item.relationship_type)}</span>}
            </div>
            <p className="text-sm font-semibold text-white mt-1.5">{item.title}</p>
            <div className="flex items-center gap-4 mt-1.5 text-xs" style={{ color: '#64748b' }}>
              <span>{item.date || '—'}</span>
              <span>{item.location || '—'}</span>
              {item.entities && <span>{item.entities.length} entities linked</span>}
            </div>
          </div>
          <button
            onClick={() => navigate('/cases', { state: { selectedCaseId: item.id } })}
            className="text-xs px-3 py-1.5 rounded-lg font-medium flex-shrink-0"
            style={{ background: '#06b6d420', color: '#22d3ee' }}
          >
            View Case
          </button>
        </div>
        {item.entities && item.entities.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap mt-3">
            {item.entities.map((e) => (
              <button
                key={e.id}
                onClick={() => e.id && navigate(`/investigation/${e.id}`)}
                className="text-[10px] px-2 py-1 rounded-full flex items-center gap-1 hover:bg-white/5"
                style={{ background: '#0f172a', border: '1px solid #22314e', color: '#94a3b8' }}
              >
                <span className="w-2 h-2 rounded-full" style={{ background: ENTITY_COLORS[e.entity_type] || '#94a3b8' }} />
                {e.name} · {e.entity_type}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderResults = () => {
    if (!data) return null;
    if (status === 'unsupported') {
      return (
        <div className="glass-card rounded-xl p-6 text-center">
          <p className="text-sm" style={{ color: '#94a3b8' }}>{data.message}</p>
          <p className="text-xs mt-4 mb-2" style={{ color: '#64748b' }}>Supported examples:</p>
          <div className="flex flex-wrap justify-center gap-2 max-w-2xl mx-auto">
            {(data.example_queries || EXAMPLE_SUGGESTIONS).map((q) => (
              <button
                key={q}
                onClick={() => { setQuery(q); runSearch(q); }}
                className="text-xs px-3 py-1.5 rounded-full transition-colors hover:bg-white/5"
                style={{ background: '#111827', border: '1px solid #22314e', color: '#94a3b8' }}
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      );
    }

    if (status === 'not_found') {
      return (
        <div className="glass-card rounded-xl p-6" style={{ border: '1px solid #f59e0b40', background: '#f59e0b10' }}>
          <p className="text-sm flex items-center gap-2" style={{ color: '#fbbf24' }}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            {data.message}
          </p>
          <p className="text-xs mt-2" style={{ color: '#64748b' }}>Check the entity name against the existing case data and try again.</p>
        </div>
      );
    }

    if (status === 'ambiguous') {
      return (
        <div className="glass-card rounded-xl p-6" style={{ border: '1px solid #f59e0b40' }}>
          <p className="text-sm" style={{ color: '#fbbf24' }}>{data.message}</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-4 max-w-2xl">
            {(data.candidates || []).map((c) => (
              <button
                key={c.id}
                onClick={() => runSearch(submitted, c.id)}
                className="flex items-center gap-2.5 p-3 rounded-lg text-left transition-colors hover:bg-white/5"
                style={{ background: '#111827', border: '1px solid #1e3a5f' }}
              >
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
                  style={{ background: `${ENTITY_COLORS[c.entity_type] || '#94a3b8'}20`, color: ENTITY_COLORS[c.entity_type] || '#94a3b8' }}>
                  {String(c.name || '?').charAt(0)}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-white truncate">{c.name}</p>
                  <p className="text-xs" style={{ color: '#64748b' }}>{c.entity_type}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      );
    }

    if (status === 'empty' || (status === 'ok' && (data.results || []).length === 0)) {
      return (
        <div className="glass-card rounded-xl p-10 text-center" style={{ borderStyle: 'dashed' }}>
          <svg className="w-12 h-12 mx-auto mb-4" style={{ color: '#334155' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <p className="text-sm text-gray-400">No matching investigation results were found.</p>
          <p className="text-xs mt-2" style={{ color: '#64748b' }}>Try a different entity, relationship type, or case reference.</p>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <p className="text-sm" style={{ color: '#94a3b8' }}>
            <span className="font-bold text-white">{data.result_count}</span> result{data.result_count === 1 ? '' : 's'} found
          </p>
          {(data.graph?.entities?.length || 0) > 1 && (
            <button
              onClick={() => navigate('/network', { state: { graphData: data.graph, graphTitle: 'Natural language search: ' + submitted } })}
              className="px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-2"
              style={{ background: '#10b98120', border: '1px solid #10b981', color: '#34d399' }}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
              View on Graph
            </button>
          )}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {data.results.map((item) => item.kind === 'case' ? renderCaseResult(item) : renderEntityResult(item))}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Natural Language Investigation Search</h1>
          <p className="text-sm" style={{ color: '#94a3b8' }}>
            Ask an investigation question in plain English — results are drawn from the existing case graph.
          </p>
        </div>
        <span className="text-[10px] px-2 py-1 rounded-full" style={{ background: '#8b5cf620', color: '#a78bfa' }}>
          Investigator assistance · synthetic data
        </span>
      </div>

      <div className="glass-card rounded-xl p-6">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="flex-1 relative">
            <div className="absolute left-4 top-0 h-full flex items-center pointer-events-none">
              <svg className="w-5 h-5" style={{ color: '#64748b' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
            </div>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') runSearch(query); }}
              placeholder="e.g. Show people connected to Rajesh Kumar through organizations."
              className="w-full px-4 py-4 pl-12 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              style={{ background: '#0d1525', border: '1px solid #1e3a5f' }}
            />
          </div>
          <button
            onClick={() => runSearch(query)}
            disabled={loading || !query.trim()}
            className="px-8 py-4 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2 disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, #3b82f6, #06b6d4)' }}
          >
            {loading ? (
              <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Searching…</>
            ) : (
              <><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>Search</>
            )}
          </button>
        </div>

        <div className="mt-4">
          <p className="text-[10px] uppercase tracking-wider mb-2" style={{ color: '#64748b' }}>Example queries</p>
          <div className="flex flex-wrap gap-2">
            {EXAMPLE_SUGGESTIONS.map((q) => (
              <button
                key={q}
                onClick={() => { setQuery(q); runSearch(q); }}
                className="text-xs px-3 py-1.5 rounded-full transition-colors hover:bg-white/5"
                style={{ background: '#111827', border: '1px solid #22314e', color: '#94a3b8' }}
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error && (
        <div className="glass-card rounded-xl p-5" style={{ border: '1px solid #ef444440', background: '#ef444415' }}>
          <p className="text-sm" style={{ color: '#fca5a5' }}>{error}</p>
        </div>
      )}

      {loading && (
        <div className="flex justify-center py-16">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {!loading && data && (
        <>
          {renderInterpretation()}
          {renderResults()}
        </>
      )}

      {!loading && !data && !error && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { title: 'Explainable', icon: 'M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z', color: '#06b6d4', text: 'Every query is converted to a structured representation you can review before trusting the results.' },
            { title: 'Safe', icon: 'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z', color: '#10b981', text: 'Free text is never executed as Cypher. Only parameterized queries are run against the existing graph.' },
            { title: 'Existing data only', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01', color: '#8b5cf6', text: 'Results come from the live Neo4j case graph — no synthetic entities or cases are ever fabricated.' },
          ].map((c) => (
            <div key={c.title} className="glass-card rounded-xl p-5">
              <div className="flex items-center gap-2 mb-2">
                <svg className="w-4 h-4" style={{ color: c.color }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={c.icon} />
                </svg>
                <h3 className="text-sm font-semibold text-gray-300">{c.title}</h3>
              </div>
              <p className="text-xs" style={{ color: '#64748b' }}>{c.text}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}