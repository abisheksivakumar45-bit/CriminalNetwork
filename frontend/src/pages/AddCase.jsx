import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createCrimeRecord } from '../api';

export default function AddCase() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    fir_number: '',
    title: '',
    description: '',
    date: '',
    location: '',
    ipc_sections: '',
    status: 'Under Investigation',
  });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title || !form.description) {
      setError('Title and description are required');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await createCrimeRecord(form);
      setResult(res.data);
    } catch (err) {
      setError(err.response?.data?.detail || 'Error creating case');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field) => (e) => {
    setForm(prev => ({ ...prev, [field]: e.target.value }));
    setError('');
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-white">Add Crime Record</h1>
        <p className="text-sm" style={{ color: '#94a3b8' }}>Add a new FIR or intelligence report for NLP analysis</p>
      </div>

      <form onSubmit={handleSubmit} className="glass-card p-8 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="text-xs font-medium text-gray-400 block mb-1">FIR Number</label>
            <input
              type="text"
              value={form.fir_number}
              onChange={handleChange('fir_number')}
              placeholder="e.g., FIR-2024-009"
              className="w-full px-4 py-3 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              style={{ background: '#111827', border: '1px solid #1e3a5f' }}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-400 block mb-1">Date</label>
            <input
              type="date"
              value={form.date}
              onChange={handleChange('date')}
              className="w-full px-4 py-3 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              style={{ background: '#111827', border: '1px solid #1e3a5f' }}
            />
          </div>
        </div>

        <div>
          <label className="text-xs font-medium text-gray-400 block mb-1">Title</label>
          <input
            type="text"
            value={form.title}
            onChange={handleChange('title')}
            placeholder="Brief case title"
            className="w-full px-4 py-3 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            style={{ background: '#111827', border: '1px solid #1e3a5f' }}
            required
          />
        </div>

        <div>
          <label className="text-xs font-medium text-gray-400 block mb-1">Description / FIR Text</label>
          <textarea
            value={form.description}
            onChange={handleChange('description')}
            placeholder="Enter the FIR description or intelligence report text. Include names, phone numbers, vehicle numbers, and locations for NLP extraction..."
            rows={12}
            className="w-full px-4 py-3 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
            style={{ background: '#111827', border: '1px solid #1e3a5f' }}
            required
          />
          <p className="text-xs mt-1.5" style={{ color: '#64748b' }}>
            Include details like: accused names, phone numbers (+91...), vehicle numbers (MH-12-AB-1234), locations, organizations
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <label className="text-xs font-medium text-gray-400 block mb-1">Location</label>
            <input
              type="text"
              value={form.location}
              onChange={handleChange('location')}
              placeholder="e.g., Mumbai, Maharashtra"
              className="w-full px-4 py-3 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              style={{ background: '#111827', border: '1px solid #1e3a5f' }}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-400 block mb-1">IPC Sections</label>
            <input
              type="text"
              value={form.ipc_sections}
              onChange={handleChange('ipc_sections')}
              placeholder="e.g., 395, 397, 120B"
              className="w-full px-4 py-3 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              style={{ background: '#111827', border: '1px solid #1e3a5f' }}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-400 block mb-1">Status</label>
            <select
              value={form.status}
              onChange={handleChange('status')}
              className="w-full px-4 py-3 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              style={{ background: '#111827', border: '1px solid #1e3a5f' }}
            >
              <option value="Under Investigation">Under Investigation</option>
              <option value="Suspect Identified">Suspect Identified</option>
              <option value="Arrest Made">Arrest Made</option>
              <option value="Charges Filed">Charges Filed</option>
              <option value="Closed">Closed</option>
            </select>
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-lg text-sm" style={{ background: '#ef444420', color: '#ef4444' }}>
            {error}
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={loading}
            className="px-8 py-3 rounded-lg text-white text-sm font-medium"
            style={{ background: 'linear-gradient(135deg, #3b82f6, #06b6d4)' }}
          >
            {loading ? 'Processing...' : 'Add Case & Extract Entities'}
          </button>
          <button
            type="button"
            onClick={() => navigate('/cases')}
            className="px-8 py-3 rounded-lg text-sm font-medium border"
            style={{ borderColor: '#1e3a5f', color: '#94a3b8' }}
          >
            Cancel
          </button>
        </div>
      </form>

      {result && (
        <div className="glass-card p-8 space-y-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: '#10b98120' }}>
              <svg className="w-5 h-5" style={{ color: '#10b981' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">Case Created Successfully</h3>
              <p className="text-sm" style={{ color: '#94a3b8' }}>{result.fir_number} - {result.title}</p>
            </div>
          </div>

          {result.extracted_entities?.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-gray-300 mb-3">NLP Extracted Entities ({result.extracted_entities.length})</h4>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {result.extracted_entities.map((e, i) => (
                  <div key={i} className="p-3 rounded text-xs" style={{ border: '1px solid #1e3a5f' }}>
                    <span className="px-1.5 py-0.5 rounded" style={{
                      background: e.entity_type === 'Person' ? '#3b82f620' : '#8b5cf620',
                      color: e.entity_type === 'Person' ? '#3b82f6' : '#8b5cf6'
                    }}>
                      {e.entity_type}
                    </span>
                    <span className="text-white ml-2">{e.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={() => navigate(`/investigation/${result.id}`)}
              className="px-4 py-2 rounded-lg text-sm font-medium text-white"
              style={{ background: '#3b82f6' }}
            >
              Investigate
            </button>
            <button
              onClick={() => { setResult(null); setForm({ fir_number: '', title: '', description: '', date: '', location: '', ipc_sections: '', status: 'Under Investigation' }); }}
              className="px-4 py-2 rounded-lg text-sm font-medium border"
              style={{ borderColor: '#1e3a5f', color: '#94a3b8' }}
            >
              Add Another
            </button>
          </div>
        </div>
      )}
    </div>
  );
}