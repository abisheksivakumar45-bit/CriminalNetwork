import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import Cases from './pages/Cases';
import NetworkGraph from './pages/NetworkGraph';
import Analysis from './pages/Analysis';
import Search from './pages/Search';
import NaturalSearch from './pages/NaturalSearch';
import Investigation from './pages/Investigation';
import AddCase from './pages/AddCase';
import Login from './pages/Login';
import Register from './pages/Register';
import Users from './pages/Users';
import { AuthProvider, useAuth } from './auth/AuthContext';
import ProtectedRoute, { FullScreenLoader } from './auth/ProtectedRoute';
import './index.css';

function AppLayout() {
  const { user, loading } = useAuth();

  if (loading) return <FullScreenLoader />;

  return (
    <div className="app-layout">
      {user && <Sidebar />}
      <main className="app-main p-6">
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/" element={<ProtectedRoute permission="dashboard"><Dashboard /></ProtectedRoute>} />
          <Route path="/cases" element={<ProtectedRoute permission="cases"><Cases /></ProtectedRoute>} />
          <Route path="/network" element={<ProtectedRoute permission="knowledge_graph"><NetworkGraph /></ProtectedRoute>} />
          <Route path="/analysis" element={<ProtectedRoute permission="network_analysis"><Analysis /></ProtectedRoute>} />
          <Route path="/search" element={<ProtectedRoute permission="entity_search"><Search /></ProtectedRoute>} />
          <Route path="/natural-search" element={<ProtectedRoute permission="natural_search"><NaturalSearch /></ProtectedRoute>} />
          <Route path="/investigation" element={<ProtectedRoute permission="investigation"><Investigation /></ProtectedRoute>} />
          <Route path="/investigation/:entityId" element={<ProtectedRoute permission="investigation"><Investigation /></ProtectedRoute>} />
          <Route path="/add-case" element={<ProtectedRoute permission="add_case"><AddCase /></ProtectedRoute>} />
          <Route path="/users" element={<ProtectedRoute permission="users"><Users /></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <AppLayout />
      </Router>
    </AuthProvider>
  );
}

export default App;