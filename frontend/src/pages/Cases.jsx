import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { getCrimeRecords } from '../api';

const ENTITY_COLORS = {
  Person: '#3b82f6', Phone: '#ec4899', Vehicle: '#f59e0b',
  Location: '#10b981', Organization: '#8b5cf6', Case: '#06b6d4',
};

const STATUS_COLORS = {
  'Under Investigation': { bg: '#f59e0b20', color: '#f59e0b' },
  'Suspect Identified': { bg: '#ec489920', color: '#ec4899' },
  'Arrest Made': { bg: '#3b82f620', color: '#3b82f6' },
  'Charges Filed': { bg: '#8b5cf620', color: '#8b5cf6' },
  'Closed': { bg: '#10b98120', color: '#10b981' },
};

export default function Cases() {
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCase, setSelectedCase] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();
  const desiredCaseId = location.state?.selectedCaseId;

  useEffect(() => { loadCases(); }, []);

  useEffect(() => {
    if (desiredCaseId && cases.length > 0) {
      const match = cases.find(c => c.id === desiredCaseId);
      if (match) setSelectedCase(match);
    }
  }, [desiredCaseId, cases]);

  const loadCases = async () => {
    try {
      const res = await getCrimeRecords();
      setCases(res.data);
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

  const statusStyle = STATUS_COLORS[selectedCase?.status] || STATUS_COLORS['Under Investigation'];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Crime Records</h1>
          <p className="text-sm mt-1" style={{ color: '#94a3b8' }}>{cases.length} FIR records in database</p>
        </div>
        <button onClick={() => navigate('/add-case')} className="px-4 py-2 rounded-lg text-white text-sm font-medium" style={{ background: 'linear-gradient(135deg, #3b82f6, #06b6d4)' }}>
          + Add Case
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-3">
          {cases.map((c) => {
            const st = STATUS_COLORS[c.status] || STATUS_COLORS['Under Investigation'];
            return (
              <div
                key={c.id}
                onClick={() => setSelectedCase(c)}
                className={`glass-card p-4 cursor-pointer transition-all rounded-xl ${selectedCase?.id === c.id ? 'ring-2 ring-blue-500/50' : 'hover:bg-white/5'}`}
                style={selectedCase?.id === c.id ? { borderColor: '#3b82f6' } : {}}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono px-2 py-0.5 rounded" style={{ background: '#3b82f620', color: '#3b82f6' }}>{c.fir_number}</span>
                      <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ background: st.bg, color: st.color }}>
                        {c.status}
                      </span>
                    </div>
                    <h3 className="text-sm font-medium text-white mt-2 truncate">{c.title}</h3>
                    <p className="text-xs mt-1" style={{ color: '#64748b' }}>{c.date} · {c.location}</p>
                    {c.extracted_entities?.length > 0 && (
                      <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                        {c.extracted_entities.slice(0, 3).map((e, i) => (
                          <span key={i} className="text-xs px-1.5 py-0.5 rounded" style={{
                            background: `${ENTITY_COLORS[e.entity_type] || '#94a3b8'}20`,
                            color: ENTITY_COLORS[e.entity_type] || '#94a3b8'
                          }}>
                            {e.entity_type}
                          </span>
                        ))}
                        {c.extracted_entities.length > 3 && (
                          <span className="text-xs" style={{ color: '#64748b' }}>+{c.extracted_entities.length - 3}</span>
                        )}
                      </div>
                    )}
                  </div>
                  <span className="text-xs px-2 py-1 rounded-full flex-shrink-0 ml-2" style={{ background: '#3b82f620', color: '#3b82f6' }}>
                    {c.extracted_entities?.length || 0} entities
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        <div className="lg:col-span-2">
          {selectedCase ? (
            <div className="glass-card p-6 space-y-6 rounded-xl">
              <div>
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-xs font-mono px-2 py-0.5 rounded" style={{ background: '#3b82f620', color: '#3b82f6' }}>{selectedCase.fir_number}</span>
                  <span className="text-xs px-2 py-1 rounded-full font-medium" style={{ background: statusStyle.bg, color: statusStyle.color }}>
                    {selectedCase.status}
                  </span>
                </div>
                <h2 className="text-xl font-bold text-white mt-3">{selectedCase.title}</h2>
                <div className="flex items-center gap-4 mt-2 text-xs flex-wrap" style={{ color: '#94a3b8' }}>
                  <span className="flex items-center gap-1">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                    {selectedCase.date}
                  </span>
                  <span className="flex items-center gap-1">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /></svg>
                    {selectedCase.location}
                  </span>
                  <span className="flex items-center gap-1">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                    IPC: {selectedCase.ipc_sections}
                  </span>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-gray-300 mb-2">Description</h3>
                <p className="text-sm leading-relaxed" style={{ color: '#cbd5e1' }}>{selectedCase.description}</p>
              </div>

              {selectedCase.extracted_entities?.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-300 mb-3">Extracted Entities ({selectedCase.extracted_entities.length})</h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {selectedCase.extracted_entities.map((e, i) => (
                      <div
                        key={i}
                        onClick={() => navigate(`/investigation/${e.id}`)}
                        className="p-3 rounded-lg cursor-pointer transition-all hover:bg-white/5 group"
                        style={{ border: '1px solid #1e3a5f' }}
                      >
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                            style={{ background: `${ENTITY_COLORS[e.entity_type]}20`, color: ENTITY_COLORS[e.entity_type] }}>
                            {e.name?.charAt(0) || '?'}
                          </div>
                          <span className="text-xs px-1.5 py-0.5 rounded" style={{
                            background: `${ENTITY_COLORS[e.entity_type]}20`,
                            color: ENTITY_COLORS[e.entity_type]
                          }}>
                            {e.entity_type}
                          </span>
                        </div>
                        <p className="text-xs font-medium text-white mt-1.5 truncate">{e.name}</p>
                        <div className="flex items-center gap-2 mt-1">
                          {e.centrality_score > 0 && (
                            <span className="text-xs" style={{ color: '#64748b' }}>
                              Score: {(e.centrality_score * 100).toFixed(1)}%
                            </span>
                          )}
                          <span className="text-xs group-hover:text-blue-400 transition-colors" style={{ color: '#64748b' }}>
                            View →
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Quick actions */}
              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={() => navigate('/network')}
                  className="px-4 py-2 rounded-lg text-xs font-medium flex items-center gap-2"
                  style={{ border: '1px solid #1e3a5f', color: '#94a3b8' }}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                  </svg>
                  View Network
                </button>
                <button
                  onClick={() => navigate('/analysis')}
                  className="px-4 py-2 rounded-lg text-xs font-medium flex items-center gap-2"
                  style={{ border: '1px solid #1e3a5f', color: '#94a3b8' }}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  Network Analysis
                </button>
              </div>
            </div>
          ) : (
            <div className="glass-card p-12 text-center rounded-xl">
              <svg className="w-16 h-16 mx-auto mb-4" style={{ color: '#1e3a5f' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="text-gray-400 text-sm">Select a case from the list to view details</p>
              <p className="text-xs mt-2" style={{ color: '#475569' }}>View FIR details, extracted entities, and navigate to investigation</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
