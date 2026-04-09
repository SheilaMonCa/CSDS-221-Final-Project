import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast'; // Import toaster
import { useAuth } from '../context/AuthContext';
import EyeIcon from '../components/EyeIcon'; // Import modular icon

export default function Login() {
  const [form, setForm] = useState({ email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await axios.post('/api/auth/login', form);
      login(data.token, data.user);
      toast.success(`Welcome back, ${data.user.username}!`); // Success toast
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Login failed'); // Error toast
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: 'calc(100vh - 60px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
    }}>
      <div className="card" style={{ width: '100%', maxWidth: '420px' }}>
        <h2 style={{ marginBottom: '6px' }}>Welcome back</h2>
        <p style={{ color: 'var(--text-muted)', marginBottom: '28px', fontSize: '14px' }}>
          Sign in to see your game night stats
        </p>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Email</label>
            <input className="input" type="email" placeholder="you@example.com"
              value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required />
          </div>
          
          <div className="form-group">
            <label>Password</label>
            <div className="input-wrapper"> {/* Centered eye logic */}
              <input 
                className="input" 
                type={showPassword ? "text" : "password"} 
                placeholder="••••••••"
                value={form.password} 
                onChange={e => setForm({ ...form, password: e.target.value })} 
                required 
              />
              <button 
                type="button" 
                className="eye-btn" 
                onClick={() => setShowPassword(!showPassword)}
              >
                <EyeIcon visible={showPassword} />
              </button>
            </div>
          </div>

          <button className="btn btn-primary" type="submit" disabled={loading}
            style={{ width: '100%', justifyContent: 'center', marginTop: '8px', padding: '13px' }}>
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: '20px', fontSize: '14px', color: 'var(--text-muted)' }}>
          No account? <Link to="/register">Create one</Link>
        </p>
      </div>
    </div>
  );
}