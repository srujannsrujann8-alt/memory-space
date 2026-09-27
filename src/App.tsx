import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { KnowledgeGraph } from './pages/KnowledgeGraph';
import { Memory } from './pages/Memory';
import { SemanticSearch } from './pages/SemanticSearch';
import { AIAssistant } from './pages/AIAssistant';
import { Documents } from './pages/Documents';
import { AddDocument } from './pages/AddDocument';
import { Login } from './pages/Login';
import { Signup } from './pages/Signup';

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public authentication routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />

          {/* Protected application routes */}
          <Route element={<ProtectedRoute />}>
            <Route path="/search" element={<SemanticSearch />} />
            <Route path="/assistant" element={<AIAssistant />} />
            <Route path="/knowledge" element={<KnowledgeGraph />} />
            <Route path="/memory" element={<Memory />} />
            <Route path="/documents" element={<Documents />} />
            <Route path="/documents/add" element={<AddDocument />} />
            {/* Backward compatibility for /dashboard */}
            <Route path="/dashboard" element={<Navigate to="/knowledge" replace />} />
          </Route>

          {/* Default entrypoint: redirect root to /knowledge (ProtectedRoute protects it) */}
          <Route path="/" element={<Navigate to="/knowledge" replace />} />

          {/* Catch-all route */}
          <Route path="*" element={<Navigate to="/knowledge" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
