import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import Cases from './pages/Cases';
import NetworkGraph from './pages/NetworkGraph';
import Analysis from './pages/Analysis';
import Search from './pages/Search';
import Investigation from './pages/Investigation';
import AddCase from './pages/AddCase';
import './index.css';

function App() {
  return (
    <Router>
      <div className="app-layout">
        <Sidebar />
        <main className="app-main p-6">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/cases" element={<Cases />} />
            <Route path="/network" element={<NetworkGraph />} />
            <Route path="/analysis" element={<Analysis />} />
            <Route path="/search" element={<Search />} />
            <Route path="/investigation" element={<Investigation />} />
            <Route path="/investigation/:entityId" element={<Investigation />} />
            <Route path="/add-case" element={<AddCase />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
