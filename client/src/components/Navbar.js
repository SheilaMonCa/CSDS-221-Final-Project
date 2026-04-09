import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <nav style={{
      background: 'var(--surface)',
      borderBottom: '1px solid var(--border)',
      padding: '0 24px',
      height: '60px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      position: 'sticky',
      top: 0,
      zIndex: 100,
    }}>
      <Link to="/dashboard" style={{
        fontFamily: 'Outfit, sans-serif',
        fontWeight: 800,
        fontSize: '20px',
        color: 'var(--primary)',
        letterSpacing: '-0.03em',
      }}>
        🎲 GameNight
      </Link>

      {user && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <span style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
            {user.username}
          </span>
          <button className="btn btn-ghost" onClick={handleLogout}
            style={{ padding: '6px 16px', fontSize: '13px' }}>
            Sign out
          </button>
        </div>
      )}
    </nav>
  );
}