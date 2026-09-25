import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { search, getEntities } from '../api';
import { resolveApiError } from '../utils/errors';

const ENTITY_COLORS = {
  Person: '#3b82f6', Phone: '#ec4899', Vehicle: '#f59e0b',
  Location: '#10b981', Organization: '#8b5cf6', Case: '#06b6d4',
};

export default function Search() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [popularEntities, setPopularEntities] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    loadPopularEntities();
  }, []);

  const loadPopularEntities = async () => {
    try {
      const res = await getEntities();
      const entities = res.data || [];
      const sorted = entities
        .sort((a, b) => (b.connection_count || 0) - (a.connection_count || 0))
        .slice(0, 8);
      setPopularEntities(sorted);
    } catch (err) { console.error(err); }
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;
    await handleSearchDirect(query);
  };

  const handleSearchDirect = async (searchQuery) => {
    if (!searchQuery.trim()) return;
    setQuery(searchQuery);
    setLoading(true);
    setError('');
    setResults(null);
    try {
      const res = await search(searchQuery);
      setResults(res.data);
    } catch (err) { setError(resolveApiError(err, 'Search failed. Please try again.')); }
    finally { setLoading(false); }
  };

  const entityMap = {};
  if (results?.entities) {
    results.entities.forEach(e => { entityMap[e.id] = e; });
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Search section */}
      <div className="glass-card rounded-xl p-6 md:p-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Entity Search</h1>
          <p className="text-sm mt-1" style={{ color: '#94a3b8' }}>Search for persons, phones, vehicles, locations, and organizations</p>
        </div>

        <form onSubmit={handleSearch} className="mt-6 flex flex-col md:flex-row gap-3">
          <div className="flex-1 relative">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search entities... (e.g., Rajesh, Mumbai, D-Company)"
              className="w-full px-4 py-4 pl-12 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              style={{ background: '#111827', border: '1px solid #1e3a5f' }}
            />
            <svg className="absolute left-4 top-0 bottom-0 my-auto w-5 h-5" style={{ color: '#64748b' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="px-8 py-4 rounded-lg text-white font-medium text-sm"
            style={{ background: 'linear-gradient(135deg, #3b82f6, #06b6d4)' }}
          >
            {loading ? 'Searching...' : 'Search'}
          </button>
        </form>
      </div>

      {!results && !loading && (
        <div className="space-y-6">
          {popularEntities.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-gray-400 mb-4">Popular Entities</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                {popularEntities.map(entity => (
                  <div
                    key={entity.id}
                    onClick={() => navigate(`/investigation/${entity.id}`)}
                    className="glass-card p-4 cursor-pointer transition-all hover:bg-white/5"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
                        style={{ background: `${ENTITY_COLORS[entity.entity_type]}20`, color: ENTITY_COLORS[entity.entity_type] }}>
                        {entity.name.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-white truncate">{entity.name}</p>
                        <p className="text-xs" style={{ color: '#64748b' }}>{entity.entity_type}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div>
            <h2 className="text-sm font-semibold text-gray-400 mb-3">Try Searching</h2>
            <div className="flex flex-wrap gap-2">
              {['Rajesh Kumar', 'Mumbai', 'D-Company', 'Phone', 'Vehicle'].map(example => (
                <button
                  key={example}
                  onClick={() => { setQuery(example); handleSearchDirect(example); }}
                  className="px-4 py-2 rounded-lg text-sm transition-all hover:bg-white/10"
                  style={{ border: '1px solid #1e3a5f', color: '#94a3b8' }}
                >
                  {example}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="glass-card rounded-xl p-6" style={{ border: '1px solid #ef444440', background: '#ef444415' }}>
          <p className="text-sm" style={{ color: '#ef4444' }}>{error}</p>
        </div>
      )}

      {loading && (
        <div className="flex justify-center py-24">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {results && !loading && (
        <div className="space-y-6">
          <div className="flex items-center gap-4 text-sm" style={{ color: '#94a3b8' }}>
            <span>{results.entities?.length || 0} entities found</span>
            <span>{results.relationships?.length || 0} relationships</span>
          </div>

          {results.entities?.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-white mb-4">Entities</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {results.entities.map(entity => (
                  <div
                    key={entity.id}
                    onClick={() => navigate(`/investigation/${entity.id}`)}
                    className="glass-card p-5 cursor-pointer transition-all hover:bg-white/5"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
                        style={{ background: `${ENTITY_COLORS[entity.entity_type]}20`, color: ENTITY_COLORS[entity.entity_type] }}>
                        {entity.name.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">{entity.name}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs px-2 py-0.5 rounded" style={{ background: `${ENTITY_COLORS[entity.entity_type]}20`, color: ENTITY_COLORS[entity.entity_type] }}>
                            {entity.entity_type}
                          </span>
                          {entity.centrality_score > 0 && (
                            <span className="text-xs" style={{ color: '#64748b' }}>
                              Score: {(entity.centrality_score * 100).toFixed(1)}%
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {results.relationships?.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-white mb-4">Relationships</h2>
              <div className="space-y-3">
                {results.relationships.slice(0, 20).map((rel, i) => {
                  const source = entityMap[rel.source] || { name: rel.source, entity_type: 'Unknown' };
                  const target = entityMap[rel.target] || { name: rel.target, entity_type: 'Unknown' };
                  return (
                    <div key={i} className="glass-card p-4 flex items-center gap-3">
                      <div onClick={() => navigate(`/investigation/${rel.source}`)} className="flex items-center gap-2 cursor-pointer hover:opacity-80">
                        <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                          style={{ background: `${ENTITY_COLORS[source.entity_type] || '#94a3b8'}20`, color: ENTITY_COLORS[source.entity_type] || '#94a3b8' }}>
                          {source.name?.charAt(0) || '?'}
                        </div>
                        <span className="text-sm text-white">{source.name || 'Unknown'}</span>
                      </div>
                      <span className="text-xs px-2 py-0.5 rounded" style={{ background: '#1e293b', color: '#94a3b8' }}>
                        {rel.relationship_type}
                      </span>
                      <div onClick={() => navigate(`/investigation/${rel.target}`)} className="flex items-center gap-2 cursor-pointer hover:opacity-80">
                        <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                          style={{ background: `${ENTITY_COLORS[target.entity_type] || '#94a3b8'}20`, color: ENTITY_COLORS[target.entity_type] || '#94a3b8' }}>
                          {target.name?.charAt(0) || '?'}
                        </div>
                        <span className="text-sm text-white">{target.name || 'Unknown'}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {results.entities?.length === 0 && (
            <div className="glass-card p-16 text-center">
              <p className="text-gray-400">No results found for "{query}"</p>
              <p className="text-xs mt-2" style={{ color: '#64748b' }}>Try searching for person names, locations, or organizations</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}