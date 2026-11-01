import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Register from './pages/Register';
import Verify from './pages/Verify';
import ForgotPassword from './pages/ForgotPassword';
import Rooms from './pages/Rooms';
import Room from './pages/Room';
import VoiceCall from './pages/VoiceCall';
import WhatsApp from './pages/WhatsApp';

function Boot() {
  return <main className="boot">Opening Nexora…</main>;
}

function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <Boot />;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function Guest({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <Boot />;
  if (user) return <Navigate to="/rooms" replace />;
  return children;
}

export default function App() {
  const { user, loading } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={<Guest><Login /></Guest>} />
      <Route path="/register" element={<Guest><Register /></Guest>} />
      <Route path="/verify" element={<Guest><Verify /></Guest>} />
      <Route path="/forgot-password" element={<Guest><ForgotPassword /></Guest>} />
      <Route path="/voice" element={<VoiceCall />} />
      <Route path="/chats" element={<RequireAuth><WhatsApp /></RequireAuth>} />
      <Route path="/rooms" element={<RequireAuth><Rooms /></RequireAuth>} />
      <Route path="/rooms/:id" element={<RequireAuth><Room /></RequireAuth>} />
      <Route path="*" element={loading ? <Boot /> : <Navigate to={user ? '/rooms' : '/login'} replace />} />
    </Routes>
  );
}
