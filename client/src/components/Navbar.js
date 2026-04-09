import { NavLink, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Navbar.css';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <nav className="navbar">
      <Link to="/dashboard" className="nav-logo">
        🎲 GameNight
      </Link>

      {user && (
        <div className="nav-links">
          <NavLink 
            to="/dashboard" 
            className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}
          >
            Dashboard
          </NavLink>
          
          <NavLink 
            to="/groups" 
            className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}
          >
            Groups
          </NavLink>
        </div>
      )}

      {user && (
        <div className="nav-user">
          <span className="username-display">
            {user.username}
          </span>
          <button className="btn btn-ghost" onClick={handleLogout}>
            Sign out
          </button>
        </div>
      )}
    </nav>
  );
}