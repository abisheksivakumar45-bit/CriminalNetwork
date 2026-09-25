import axios from 'axios';

const API_BASE = '/api';

const api = axios.create({
  baseURL: API_BASE,
  timeout: 30000,
  withCredentials: true,
});

// ─── Authentication helpers ───
export const login = (username, password) => api.post('/auth/login', { username, password });
export const register = (username, password, role) => api.post('/auth/register', { username, password, role });
export const logout = () => api.post('/auth/logout');
export const getCurrentUser = () => api.get('/auth/me');
export const getAuthUsers = () => api.get('/auth/users');
export const createAuthUser = (data) => api.post('/auth/users', data);
export const changeUserRole = (username, role) => api.patch('/auth/users/role', { username, role });

// ─── Existing data endpoints ───
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
export const naturalSearch = (query, entityId) => api.post('/investigation/natural-search', { query, entity_id: entityId || null });
export const getConnectedEntities = (id) => api.get(`/relationships/connected/${id}`);
export const findPath = (sourceId, targetId) => api.get('/path', { params: { source_id: sourceId, target_id: targetId } });
export const initSampleData = () => api.post('/init/load-sample-data');
export const clearDatabase = () => api.post('/init/clear');
export const getRelationships = (entityId) => api.get('/relationships/', { params: { entity_id: entityId } });

// ─── Session refresh handling ───
// When a protected request returns 401 (access token expired), a single
// in-flight refresh call exchanges the httpOnly refresh token for a new
// access token, then the original request is retried transparently.
let isRefreshing = false;
let pendingQueue = [];

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    const status = error.response?.status;

    if (
      !original ||
      status !== 401 ||
      (original.url || '').startsWith('/auth') ||
      original._authRetried
    ) {
      return Promise.reject(error);
    }

    original._authRetried = true;

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        pendingQueue.push({ resolve, reject });
      }).then(() => api(original));
    }

    isRefreshing = true;
    try {
      await api.post('/auth/refresh');
      isRefreshing = false;
      pendingQueue.forEach((p) => p.resolve());
      pendingQueue = [];
      return api(original);
    } catch (refreshError) {
      isRefreshing = false;
      pendingQueue.forEach((p) => p.reject(refreshError));
      pendingQueue = [];
      window.dispatchEvent(new Event('auth:session-expired'));
      return Promise.reject(error);
    }
  }
);

export default api;