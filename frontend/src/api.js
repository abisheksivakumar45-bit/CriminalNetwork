import axios from 'axios';

const API_BASE = '/api';

const api = axios.create({
  baseURL: API_BASE,
  timeout: 30000,
});

export const getDashboard = () => api.get('/dashboard');
export const getEntities = (type) => api.get('/entities/', { params: { entity_type: type } });
export const getEntity = (id) => api.get(`/entities/${id}`);
export const getEntityTimeline = (id) => api.get(`/entities/${id}/timeline`);
export const searchEntities = (query) => api.get(`/entities/search/${query}`);
export const getCrimeRecords = () => api.get('/crimes/');
export const getCrimeRecord = (id) => api.get(`/crimes/${id}`);
export const createCrimeRecord = (data) => api.post('/crimes/', data);
export const getNetwork = () => api.get('/network');
export const search = (q) => api.get('/search', { params: { q } });
export const getInvestigation = (id) => api.get(`/investigation/${id}`);
export const getConnectedEntities = (id) => api.get(`/relationships/connected/${id}`);
export const findPath = (sourceId, targetId) => api.get('/path', { params: { source_id: sourceId, target_id: targetId } });
export const initSampleData = () => api.post('/init/load-sample-data');
export const clearDatabase = () => api.post('/init/clear');
export const getRelationships = (entityId) => api.get('/relationships/', { params: { entity_id: entityId } });

export default api;
