import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { temporalAnalysis } from '../api';
import { resolveApiError } from '../utils/errors';

const ENTITY_COLORS = {
  Person: '#3b82f6', Phone: '#ec4899', Vehicle: '#f59e0b',
  Location: '#10b981', Organization: '#8b5cf6', Case: '#06b6d4',
};

const INSUFFICIENT = 'Insufficient historical data for this analysis.';

const DETECTIONS = [
  {
    key: 'connection_increase',
    letter: 'A',
    title: 'Sudden connection increase',
    color: '#3b82f6',
    icon: 'M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1',
    emptyNote: 'No entity in the selected window gained a qualifying jump in case-linked connections.',
  },
  {
    key: 'new_relationships',
    letter: 'B',
    title: 'New relationships',
    color: '#06b6d4',
    icon: 'M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1',
    emptyNote: 'No relationship has a first recorded date inside a later period of the range.',
  },
  {
    key: 'new_entities',
    letter: 'C',
    title: 'New entities entering the network',
    color: '#8b5cf6',
    icon: 'M18 7v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 21a6 6 0 0112 0v1H3v-1z',
    emptyNote: 'No entity first appears in a later period of the selected range.',
  },
  {
    key: 'bridge_formation',
    letter: 'D',
    title: 'Bridge formation between groups',
    color: '#f59e0b',
    icon: 'M8.26 10.72l2.54 2.54a4.5 4.5 0 01-6.36 0l-2.54-2.54a4.5 4.5 0 016.36-6.36l1.06 1.06m6.68-2.12l-2.54 2.54a4.5 4.5 0 006.36 0l2.54-2.54a4.5 4.5 0 00-6.36-6.36l-1.06 1.06',
    emptyNote: 'No relationship connects two previously separate case groups inside the range.',
  },
  {
    key: 'activity_burst',
    letter: 'E',
    title: 'Activity burst',
    color: '#ef4444',
    icon: 'M13 10V3L4 14h7v7l9-11h-7z',
    emptyNote: 'No period exceeds the baseline activity of the other observed periods.',
  },
  {
    key: 'disappeared_relationships',
    letter: 'F',
    title: 'Disappeared relationships',
    color: '#64748b',
    icon: 'M18.36 18.36A9 9 0 005.64 5.64m9.192 9.192a9 9 0 01-9.192-9.192M1 1l22 22',
    emptyNote: 'No relationship end dates are recorded in the database.',
  },
];

const SEVERITY_COLORS = { High: '#ef4444', Medium: '#f59e0b', Low: '#10b981' };

const relLabel = (r) => String(r || '').replace(/_/g, ' ').toLowerCase();

const initialState = { startDate: '', endDate: '', period: 'month' };

export default function TemporalAnalysis() {
  const navigate = useNavigate();
  const [form, setForm] = useState(initialState);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const run = async (override) => {
    const f = override || form;
    setLoading(true);
    setError('');
    try {
      const params = { period: f.period || 'month' };
      if (f.startDate) params.start_date = f.startDate;
      if (f.endDate) params.end_date = f.endDate;
      const res = await temporalAnalysis(params);
      setData(res.data);
    } catch (err) {
      setData(null);
      setError(resolveApiError(err, 'Could not run the temporal analysis.'));
    } finally {
      setLoading(false);
    }
  };

  const summary = data?.summary;
  const periods = summary?.periods || [];
  const maxEvents = Math.max(1, ...periods.map((p) => p.event_count || 0));

  const buildBridgeGraph = () => {
    const entities = new Map();
    const relationships = [];
    (data?.detections?.bridge_formation?.items || []).forEach((b) => {
      [b.source, b.target].forEach((e) => entities.set(e.id, e));
      relationships.push({ source: b.source.id, target: b.target.id, relationship_type: b.relationship_type });
    });
    return { entities: [...entities.values()], relationships };
  };

  const viewBridgesOnGraph = () => {
    const g = buildBridgeGraph();
    if (!g.entities.length) return;
    navigate('/network', { state: { graphData: g, graphTitle: 'Temporal analysis · bridge relationships' } });
  };

  const renderTimeline = () => (
    <div className="glass-card rounded-xl p-5">
      <div className="flex items-center justify-between flex-wrap gap-2 mb-1">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4" style={{ color: '#06b6d4' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 2m6-2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h3 className="text-sm font-semibold text-gray-300">Timeline · monthly activity</h3>
        </div>
        <div className="flex items-center gap-3 text-[10px]" style={{ color: '#64748b' }}>
          {[
            ['Cases', '#3b82f6'], ['Entities', '#8b5cf6'], ['Relationship events', '#10b981'],
          ].map(([label, color]) => (
            <span key={label} className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm" style={{ background: color }} />{label}
            </span>
          ))}
        </div>
      </div>
      <p className="text-xs mb-4" style={{ color: '#64748b' }}>
        Bar height = total events in the period (cases + entities + co-involved pairs). Hover a period for its exact counts.
      </p>
      <div className="flex items-end gap-2 overflow-x-auto pb-2" style={{ minHeight: 180 }}>
        {periods.map((p) => (
          <div key={p.period} className="flex flex-col items-center gap-2 flex-shrink-0" style={{ width: 74 }}>
            <span className="text-[10px] font-mono" style={{ color: '#64748b' }}>{p.event_count}</span>
            <div className="w-full flex items-end gap-1" style={{ height: 130 }}>
              {[
                { v: p.case_count, color: '#3b82f6' },
                { v: p.entity_count, color: '#8b5cf6' },
                { v: p.relationship_count, color: '#10b981' },
              ].map((bar, i) => (
                <div
                  key={i}
                  className="flex-1 rounded-t-md transition-all"
                  style={{
                    height: `${Math.max(4, (bar.v / maxEvents) * 120)}px`,
                    background: `linear-gradient(180deg, ${bar.color}, ${bar.color}66)`,
                    outline: '1px solid #0d1525',
                  }}
                  title={`${p.label}: ${bar.v}`}
                />
              ))}
            </div>
            <span className="text-[10px] font-mono text-center leading-tight" style={{ color: '#94a3b8' }}>{p.label}</span>
            <div className="flex flex-wrap justify-center gap-1">
              {p.cases.map((c) => (
                <button
                  key={c.id}
                  onClick={() => navigate('/cases', { state: { selectedCaseId: c.id } })}
                  className="text-[9px] font-mono px-1.5 py-0.5 rounded hover:bg-white/5"
                  style={{ background: '#0f172a', border: '1px solid #22314e', color: '#22d3ee' }}
                  title={`${c.fir_number} · ${c.title} · ${c.date}`}
                >
                  {c.fir_number}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderConnectionItems = (items) => (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
      {items.map((it, idx) => (
        <div key={`${it.entity}-${idx}`} className="glass-card rounded-xl p-4">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-semibold text-white">{it.entity}</span>
            <span className="text-xs font-mono px-2 py-0.5 rounded-full" style={{ background: '#3b82f620', color: '#60a5fa' }}>
              {it.period_label}
            </span>
          </div>
          <p className="text-xs mt-2" style={{ color: '#94a3b8' }}>
            Prior recorded gains <span className="font-mono text-white">{it.previous_count}</span> → new connections{' '}
            <span className="font-mono text-white">{it.new_count}</span> (change <span className="font-mono" style={{ color: '#60a5fa' }}>+{it.increase}</span>)
          </p>
          <div className="flex items-center gap-2 mt-2 flex-wrap text-[10px] font-mono" style={{ color: '#64748b' }}>
            {it.dates?.map((d) => <span key={d}>{d}</span>)}
          </div>
        </div>
      ))}
    </div>
  );

  const renderRelationshipItems = (items) => (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
      {items.map((it, idx) => (
        <div key={`${it.entity_a.id}-${it.entity_b.id}-${idx}`} className="glass-card rounded-xl p-4">
          <div className="flex items-center gap-2 flex-wrap text-sm">
            <button onClick={() => navigate(`/investigation/${it.entity_a.id}`)} className="font-semibold text-white hover:underline">
              {it.entity_a.name}
            </button>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded" style={{ background: '#0f172a', color: '#22d3ee' }}>
              {relLabel(it.relationship_type)}
            </span>
            <button onClick={() => navigate(`/investigation/${it.entity_b.id}`)} className="font-semibold text-white hover:underline">
              {it.entity_b.name}
            </button>
          </div>
          <div className="flex items-center gap-2 mt-2 flex-wrap text-[10px]" style={{ color: '#64748b' }}>
            <span className="font-mono" style={{ color: '#22d3ee' }}>first recorded {it.first_recorded_date}</span>
            {it.related_case?.fir_number && (
              <button
                onClick={() => navigate('/cases', { state: { selectedCaseId: it.related_case.id } })}
                className="font-mono px-1.5 py-0.5 rounded hover:bg-white/5"
                style={{ background: '#0f172a', border: '1px solid #22314e' }}
              >
                {it.related_case.fir_number}
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );

  const renderEntityItems = (items) => (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
      {items.map((it) => {
        const color = ENTITY_COLORS[it.entity.entity_type] || '#94a3b8';
        return (
          <div key={it.entity.id} className="glass-card rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
                style={{ background: `${color}20`, color }}>
                {String(it.entity.name || '?').charAt(0)}
              </div>
              <div className="min-w-0 flex-1">
                <button onClick={() => navigate(`/investigation/${it.entity.id}`)} className="text-sm font-semibold text-white hover:underline truncate block">
                  {it.entity.name}
                </button>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: `${color}20`, color }}>{it.entity.entity_type}</span>
                  <span className="text-[10px] font-mono" style={{ color: '#22d3ee' }}>first activity {it.first_activity_date}</span>
                </div>
              </div>
            </div>
            {it.initial_connection_count > 0 && (
              <p className="text-[11px] mt-2" style={{ color: '#64748b' }}>
                {it.initial_connection_count} stored relationship{it.initial_connection_count === 1 ? '' : 's'} at first appearance:{' '}
                <span style={{ color: '#94a3b8' }}>
                  {it.initial_connections.map((c) => c.name).join(', ')}
                  {it.initial_connection_count > it.initial_connections.length ? '…' : ''}
                </span>
              </p>
            )}
            {it.related_case?.fir_number && (
              <button
                onClick={() => navigate('/cases', { state: { selectedCaseId: it.related_case.id } })}
                className="text-[10px] font-mono px-2 py-1 rounded-lg mt-2 hover:bg-white/5"
                style={{ background: '#06b6d420', color: '#22d3ee' }}
              >
                First case: {it.related_case.fir_number}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );

  const renderBridgeItems = (items) => (
    <div className="space-y-3">
      {items.map((it, idx) => (
        <div key={`${it.source.id}-${it.target.id}-${idx}`} className="glass-card rounded-xl p-4">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap text-sm">
              <button onClick={() => navigate(`/investigation/${it.source.id}`)} className="font-semibold text-white hover:underline">
                {it.source.name}
              </button>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded" style={{ background: '#0f172a', color: '#22d3ee' }}>
                {relLabel(it.relationship_type)}
              </span>
              <button onClick={() => navigate(`/investigation/${it.target.id}`)} className="font-semibold text-white hover:underline">
                {it.target.name}
              </button>
            </div>
            <span className="text-xs font-mono px-2 py-0.5 rounded-full" style={{ background: '#f59e0b20', color: '#fbbf24' }}>
              bridge complete {it.bridge_date}
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
            {[it.component_a, it.component_b].map((side, i) => (
              <div key={i} className="rounded-lg p-3" style={{ background: '#0d1525', border: '1px solid #1e3a5f' }}>
                <p className="text-[10px] uppercase tracking-wider mb-1.5" style={{ color: '#64748b' }}>
                  Group {i === 0 ? 'A' : 'B'} · {side.size} entities · {side.cases.length} case{side.cases.length === 1 ? '' : 's'}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {side.entities.map((e) => (
                    <span key={e.id} className="text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1" style={{ background: '#111827', border: '1px solid #22314e', color: '#94a3b8' }}>
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: ENTITY_COLORS[e.entity_type] || '#94a3b8' }} />
                      {e.name}
                    </span>
                  ))}
                  {side.size > side.entities.length && <span className="text-[10px] px-2 py-0.5" style={{ color: '#475569' }}>+{side.size - side.entities.length} more</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );

  const renderBurstItems = (items) => (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
      {items.map((it) => (
        <div key={it.period} className="glass-card rounded-xl p-4" style={{ borderColor: '#ef444455' }}>
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-white">{it.period_label}</span>
            <span className="text-xs font-mono px-2 py-0.5 rounded-full" style={{ background: '#ef444420', color: '#fca5a5' }}>
              {it.event_count} events
            </span>
          </div>
          <p className="text-xs mt-2" style={{ color: '#94a3b8' }}>
            Baseline of the other observed periods: <span className="font-mono text-white">{it.baseline_count}</span> · difference{' '}
            <span className="font-mono" style={{ color: '#fca5a5' }}>+{it.difference}</span>
          </p>
          <div className="mt-3">
            <div className="h-2 rounded-full overflow-hidden" style={{ background: '#0f172a' }}>
              <div className="h-full rounded-full" style={{ width: `${Math.min(100, (it.event_count / Math.max(1, it.baseline_count * 2)) * 100)}%`, background: 'linear-gradient(90deg, #ef4444, #f59e0b)' }} />
            </div>
            <p className="text-[10px] mt-1" style={{ color: '#64748b' }}>
              Flagged when events ≥ max({data?.rules?.activity_burst?.min_events}, 2 × baseline) and events ≥ baseline + {data?.rules?.activity_burst?.min_difference}
            </p>
          </div>
        </div>
      ))}
    </div>
  );

  const renderDetection = (def) => {
    const block = data?.detections?.[def.key];
    if (!block) return null;
    const items = block.items || [];
    const insufficient = block.message === INSUFFICIENT;
    return (
      <div key={def.key} className="glass-card rounded-xl p-5">
        <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold"
              style={{ background: `${def.color}20`, color: def.color }}>
              {def.letter}
            </span>
            <svg className="w-4 h-4" style={{ color: def.color }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={def.icon} />
            </svg>
            <h3 className="text-sm font-semibold text-gray-200">{def.title}</h3>
          </div>
          <div className="flex items-center gap-2">
            {block.total > block.shown && (
              <span className="text-[10px] font-mono px-2 py-0.5 rounded" style={{ background: '#0f172a', color: '#64748b' }}>
                showing {block.shown} of {block.total}
              </span>
            )}
            {!insufficient && (
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full" style={{ background: `${def.color}20`, color: def.color }}>
                {block.total} finding{block.total === 1 ? '' : 's'}
              </span>
            )}
          </div>
        </div>

        {insufficient ? (
          <p className="text-xs flex items-center gap-2" style={{ color: '#fbbf24' }}>
            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            {block.message}
          </p>
        ) : items.length === 0 ? (
          <p className="text-xs" style={{ color: '#64748b' }}>{block.message || def.emptyNote}</p>
        ) : (
          <>
            {def.key === 'connection_increase' && renderConnectionItems(items)}
            {def.key === 'new_relationships' && renderRelationshipItems(items)}
            {def.key === 'new_entities' && renderEntityItems(items)}
            {def.key === 'bridge_formation' && renderBridgeItems(items)}
            {def.key === 'activity_burst' && renderBurstItems(items)}
            {block.note && <p className="text-[10px] mt-3" style={{ color: '#64748b' }}>{block.note}</p>}
          </>
        )}

        {def.key === 'bridge_formation' && items.length > 0 && (
          <button
            onClick={viewBridgesOnGraph}
            className="mt-3 px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-2"
            style={{ background: '#f59e0b20', border: '1px solid #f59e0b', color: '#fbbf24' }}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
            View Bridges on Graph
          </button>
        )}
      </div>
    );
  };

  const renderReview = () => {
    const items = data?.review_items || [];
    if (data?.insufficient_overall) {
      return (
        <div className="glass-card rounded-xl p-5" style={{ border: '1px solid #f59e0b40' }}>
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-sm font-semibold text-gray-200">Review indicators</h3>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded" style={{ background: '#0f172a', color: '#64748b' }}>score 0</span>
          </div>
          <p className="text-xs flex items-center gap-2" style={{ color: '#fbbf24' }}>
            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            {INSUFFICIENT}
          </p>
        </div>
      );
    }
    if (!items.length) {
      return (
        <div className="glass-card rounded-xl p-6 text-center" style={{ borderStyle: 'dashed' }}>
          <p className="text-sm text-gray-400">No entity met a review indicator in this range.</p>
          <p className="text-xs mt-2" style={{ color: '#64748b' }}>Indicators combine connection increases, new relationships, bridge formation and activity bursts.</p>
        </div>
      );
    }
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <p className="text-xs" style={{ color: '#64748b' }}>
            Transparent indicator score — every point comes from a measured factor below. It is a review aid, never a verdict.
          </p>
          {data?.review_summary?.total > data?.review_summary?.shown && (
            <span className="text-[10px] font-mono px-2 py-0.5 rounded" style={{ background: '#0f172a', color: '#64748b' }}>
              showing {data.review_summary.shown} of {data.review_summary.total}
            </span>
          )}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {items.map((r) => {
            const sev = SEVERITY_COLORS[r.severity] || '#94a3b8';
            const color = ENTITY_COLORS[r.entity.entity_type] || '#94a3b8';
            return (
              <div key={r.entity.id} className="glass-card rounded-xl p-4" style={{ borderColor: `${sev}55` }}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <button onClick={() => navigate(`/investigation/${r.entity.id}`)} className="text-sm font-semibold text-white hover:underline truncate block">
                      {r.entity.name}
                    </button>
                    <span className="text-[10px] px-1.5 py-0.5 rounded mt-1 inline-block" style={{ background: `${color}20`, color }}>
                      {r.entity.entity_type}
                    </span>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-lg font-bold leading-none" style={{ color: sev }}>{r.score}</div>
                    <span className="text-[10px] px-2 py-0.5 rounded-full mt-1 inline-block" style={{ background: `${sev}20`, color: sev }}>
                      {r.severity}
                    </span>
                  </div>
                </div>
                <ul className="mt-3 space-y-0.5">
                  {r.reason_lines.map((line) => (
                    <li key={line} className="text-[11px] font-mono flex items-center gap-1.5" style={{ color: '#94a3b8' }}>
                      <span className="w-1 h-1 rounded-full" style={{ background: sev }} />{line}
                    </li>
                  ))}
                </ul>
                {r.periods?.length > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap mt-2.5">
                    {r.periods.map((p) => (
                      <span key={p} className="text-[10px] font-mono px-1.5 py-0.5 rounded" style={{ background: '#0f172a', border: '1px solid #22314e', color: '#64748b' }}>
                        {p}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderRules = () => {
    const rules = data?.rules;
    if (!rules) return null;
    const rows = [
      ['Connection increase', `${rules.connection_increase.min_new_connections}+ new connections, ≥1 earlier gain, ≥+${rules.connection_increase.absolute_jump} and >${rules.connection_increase.relative_factor}× prior`],
      ['New relationships', 'First recorded date (earliest dated case both endpoints appear in) later than the first observed period'],
      ['New entities', 'First recorded activity later than the first observed period'],
      ['Bridge formation', 'Relationship between two different co-involvement groups, dated at the later of the two first-activity dates'],
      ['Activity burst', `Events ≥ max(${rules.activity_burst.min_events}, ${rules.activity_burst.relative_factor}× baseline) and ≥ baseline + ${rules.activity_burst.min_difference}`],
      ['Review score', `min(ci,10)×${rules.review_score.connection_increase_weight} + min(nr,5)×${rules.review_score.new_relationship_weight} + min(rc,5)×${rules.review_score.related_case_weight} + ${rules.review_score.bridge_points} (bridge) + ${rules.review_score.activity_burst_points} (burst); High ≥ ${rules.review_score.high_severity_min}, Medium ≥ ${rules.review_score.medium_severity_min}`],
    ];
    return (
      <div className="glass-card rounded-xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <svg className="w-4 h-4" style={{ color: '#8b5cf6' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <h3 className="text-sm font-semibold text-gray-300">How these results are computed</h3>
        </div>
        <div className="space-y-2">
          {rows.map(([label, value]) => (
            <div key={label} className="flex flex-col sm:flex-row sm:gap-3 text-[11px]">
              <span className="font-semibold sm:w-40 flex-shrink-0" style={{ color: '#94a3b8' }}>{label}</span>
              <span className="font-mono" style={{ color: '#64748b' }}>{value}</span>
            </div>
          ))}
        </div>
        <p className="text-[10px] mt-3" style={{ color: '#475569' }}>
          Periods are calendar months derived from the stored case dates. Detection lists are capped to keep the response readable; the full count is shown next to each section.
        </p>
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Temporal Network Analysis</h1>
          <p className="text-sm" style={{ color: '#94a3b8' }}>
            How the existing case network changes over time — measurable changes only, using the dates already stored in the database.
          </p>
        </div>
        <span className="text-[10px] px-2 py-1 rounded-full" style={{ background: '#3b82f620', color: '#60a5fa' }}>
          Investigative aid · not a prediction of criminal activity
        </span>
      </div>

      <div className="glass-card rounded-xl p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <label className="text-[10px] uppercase tracking-wider block mb-1.5" style={{ color: '#64748b' }}>Start date</label>
            <input
              type="date"
              value={form.startDate}
              onChange={(e) => setForm({ ...form, startDate: e.target.value })}
              className="w-full px-3 py-2.5 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              style={{ background: '#0d1525', border: '1px solid #1e3a5f' }}
            />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wider block mb-1.5" style={{ color: '#64748b' }}>End date</label>
            <input
              type="date"
              value={form.endDate}
              onChange={(e) => setForm({ ...form, endDate: e.target.value })}
              className="w-full px-3 py-2.5 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              style={{ background: '#0d1525', border: '1px solid #1e3a5f' }}
            />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wider block mb-1.5" style={{ color: '#64748b' }}>Period</label>
            <select
              value={form.period}
              onChange={(e) => setForm({ ...form, period: e.target.value })}
              className="w-full px-3 py-2.5 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              style={{ background: '#0d1525', border: '1px solid #1e3a5f' }}
            >
              <option value="month" style={{ background: '#0d1525' }}>Monthly</option>
            </select>
          </div>
          <div className="flex items-end gap-2">
            <button
              onClick={() => run()}
              disabled={loading}
              className="flex-1 px-6 py-2.5 rounded-lg text-sm font-semibold text-white flex items-center justify-center gap-2 disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, #3b82f6, #06b6d4)' }}
            >
              {loading ? (
                <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Analysing…</>
              ) : (
                <><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>Run Analysis</>
              )}
            </button>
            <button
              onClick={() => { setForm(initialState); setData(null); setError(''); }}
              className="px-3 py-2.5 rounded-lg text-xs font-medium"
              style={{ background: '#111827', border: '1px solid #22314e', color: '#94a3b8' }}
            >
              Reset
            </button>
          </div>
        </div>
        <p className="text-[11px] mt-3" style={{ color: '#64748b' }}>
          Leave the dates empty to analyse every dated case in the database. The window is clamped to the dates that actually exist.
          Only calendar-month periods are supported because case records carry a single date.
        </p>
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
        <div className="space-y-5">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {[
              ['Cases', summary.total_cases, '#3b82f6'],
              ['Entities', summary.total_entities, '#8b5cf6'],
              ['Relationship events', summary.total_relationship_events, '#10b981'],
              ['Periods observed', summary.period_count, '#06b6d4'],
              ['Avg events / period', summary.avg_event_count, '#f59e0b'],
            ].map(([label, value, color]) => (
              <div key={label} className="glass-card rounded-xl p-4">
                <p className="text-[10px] uppercase tracking-wider" style={{ color: '#64748b' }}>{label}</p>
                <p className="text-2xl font-bold mt-1" style={{ color }}>{value}</p>
              </div>
            ))}
          </div>

          <div className="glass-card rounded-xl p-4 flex flex-wrap items-center gap-x-6 gap-y-1 text-[11px]" style={{ color: '#64748b' }}>
            <span>Data range: <span className="font-mono" style={{ color: '#94a3b8' }}>{data.time_range.data_min_date} → {data.time_range.data_max_date}</span></span>
            <span>Analysed: <span className="font-mono" style={{ color: '#94a3b8' }}>{data.time_range.effective_start_date} → {data.time_range.effective_end_date}</span></span>
            <span>Granularity: <span className="font-mono" style={{ color: '#94a3b8' }}>{data.granularity}</span></span>
            <span>Detected changes only — an entity not flagged here simply has no measurable anomaly in this window.</span>
          </div>

          {renderTimeline()}
          {DETECTIONS.map(renderDetection)}

          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-gray-300">Review indicators</h2>
            {renderReview()}
          </div>

          {renderRules()}

          <div className="glass-card rounded-xl p-4" style={{ border: '1px solid #f59e0b40', background: '#f59e0b10' }}>
            <p className="text-xs" style={{ color: '#fbbf24' }}>
              This analysis is an investigative aid built only from data already stored in the system. It identifies unusual changes in the existing
              network; it does not predict criminal activity, establish guilt, or create any new case, entity or relationship.
            </p>
          </div>
        </div>
      )}

      {!loading && !data && !error && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            {
              title: 'Real stored data only',
              color: '#10b981',
              icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01',
              text: 'Periods come from the case dates in Neo4j. No synthetic case, entity, relationship or date is ever created.',
            },
            {
              title: 'Fully explainable',
              color: '#06b6d4',
              icon: 'M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z',
              text: 'Every finding lists the exact counts, dates and thresholds that produced it, so an investigator can verify or reject it.',
            },
            {
              title: 'Honest about gaps',
              color: '#f59e0b',
              icon: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z',
              text: 'When a range holds too little history, the analysis says "Insufficient historical data" instead of guessing a trend.',
            },
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
