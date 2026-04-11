import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { Toaster } from 'react-hot-toast';
import ProtectedRoute from './components/ProtectedRoute';
import Navbar from './components/Navbar';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Groups from './pages/Groups';
import GroupDetail from './pages/GroupDetail';
import GameNightDetail from './pages/GameNightDetail';
import './index.css';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster
          position="bottom-right"
          toastOptions={{
            duration: 3000,
            style: {
              background: 'var(--card)',
              color: 'var(--text)',
              border: '1px solid var(--border)',
              fontSize: '14px',
              padding: '12px 20px',
              borderRadius: '10px',
            },
            success: {
              iconTheme: { primary: 'var(--primary)', secondary: 'white' },
            },
          }}
        />
        <Navbar />
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/groups" element={<ProtectedRoute><Groups /></ProtectedRoute>} />
          <Route path="/groups/:id" element={<ProtectedRoute><GroupDetail /></ProtectedRoute>} />

          {/* ✅ Unified game night detail route — all roads lead here */}
          <Route path="/game-nights/:nightId" element={<ProtectedRoute><GameNightDetail /></ProtectedRoute>} />

          <Route path="*" element={<Navigate to="/dashboard" />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
