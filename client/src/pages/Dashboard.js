import React, { useState, useEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import EyeIcon from '../components/EyeIcon';
import GameNightCreator from '../components/GameNightCreator';
import './Dashboard.css';

export default function Dashboard() {
  const { user, logout } = useAuth();

  const [stats,      setStats]      = useState({ winRate: '—', total: 0, wins: 0, second_place: 0, third_place: 0, no_podium: 0 });
  const [byGame,     setByGame]     = useState([]);
  const [history,    setHistory]    = useState([]);

  // Modals
  const [showNightModal,  setShowNightModal]  = useState(false);
  const [showEditModal,   setShowEditModal]   = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [needsReauth,     setNeedsReauth]     = useState(false);

  // Password visibility
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew,     setShowNew]     = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [editData, setEditData] = useState({
    username:    user?.username || '',
    email:       user?.email    || '',
    newPass:     '',
    confirmPass: '',
    currentPass: '',
  });

  // ── Fetch data ──────────────────────────────────────────────────────────
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const { data } = await axios.get(`/api/users/${user.id}/stats`);
        setStats({
          winRate:      data.win_rate      ?? '—',
          total:        data.total_games   ?? 0,
          wins:         data.wins          ?? 0,
          second_place: data.second_place  ?? 0,
          third_place:  data.third_place   ?? 0,
          no_podium:    data.no_podium     ?? 0,
        });
      } catch { /* Stats not critical */ }
    };

    const fetchByGame = async () => {
      try {
        const { data } = await axios.get(`/api/users/${user.id}/stats/by-game`);
        setByGame(data || []);
      } catch { /* Not critical */ }
    };

    const fetchHistory = async () => {
      try {
        const { data } = await axios.get(`/api/users/${user.id}/history`);
        setHistory(data || []);
      } catch { /* History not critical */ }
    };

    fetchStats();
    fetchByGame();
    fetchHistory();
  }, [user.id]);

  // ── Profile update ──────────────────────────────────────────────────────
  const handleUpdate = async (e) => {
    e.preventDefault();

    const isChangingEmail = editData.email !== user.email;
    const isChangingPass  = editData.newPass !== '';

    if ((isChangingEmail || isChangingPass) && !needsReauth) {
      setNeedsReauth(true);
      toast('Confirm your current password to save sensitive changes.', { icon: '🔐' });
      return;
    }

    if (isChangingPass && editData.newPass !== editData.confirmPass) {
      return toast.error('New passwords do not match.');
    }

    try {
      await axios.put(`/api/auth/update/${user.id}`, {
        username:    editData.username,
        email:       editData.email,
        newPass:     editData.newPass,
        currentPass: editData.currentPass,
      });
      toast.success('Profile updated!');
      closeEditModal();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Update failed.');
    }
  };

  const confirmDelete = async () => {
    const id = toast.loading('Deleting account…');
    try {
      await axios.delete(`/api/auth/delete/${user.id}`);
      toast.success('Account deleted. See you around!', { id });
      logout();
    } catch {
      toast.error('Failed to delete account', { id });
    }
  };

  const closeEditModal = () => {
    setShowEditModal(false);
    setNeedsReauth(false);
    setShowCurrent(false);
    setShowNew(false);
    setShowConfirm(false);
    setEditData({
      username: user.username, email: user.email,
      newPass: '', confirmPass: '', currentPass: '',
    });
  };

  // ── Pie chart: podium breakdown ─────────────────────────────────────────
  const pieData = [
    { label: '1st', value: stats.wins,         color: '#00d4aa' },
    { label: '2nd', value: stats.second_place,  color: '#00b4d8' },
    { label: '3rd', value: stats.third_place,   color: '#7b61ff' },
    { label: 'No podium', value: stats.no_podium, color: '#3a3a4a' },
  ].filter(d => d.value > 0);

  const total = pieData.reduce((s, d) => s + d.value, 0);

  // Build SVG pie arcs
  const buildPie = () => {
    if (total === 0) return null;
    let cumulative = 0;
    const cx = 60, cy = 60, r = 50;
    return pieData.map((slice, i) => {
      const pct  = slice.value / total;
      const startAngle = cumulative * 2 * Math.PI - Math.PI / 2;
      cumulative += pct;
      const endAngle = cumulative * 2 * Math.PI - Math.PI / 2;
      const x1 = cx + r * Math.cos(startAngle);
      const y1 = cy + r * Math.sin(startAngle);
      const x2 = cx + r * Math.cos(endAngle);
      const y2 = cy + r * Math.sin(endAngle);
      const large = pct > 0.5 ? 1 : 0;
      return (
        <path
          key={i}
          d={`M${cx},${cy} L${x1},${y1} A${r},${r} 0 ${large},1 ${x2},${y2} Z`}
          fill={slice.color}
          stroke="var(--bg)"
          strokeWidth="2"
        />
      );
    });
  };

  // Bar chart max
  const maxWinRate = byGame.length > 0 ? Math.max(...byGame.map(g => Number(g.win_rate))) : 100;

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="page dashboard-container">

      {/* Header */}
      <header className="dashboard-header">
        <div className="header-left">
          <h1 className="page-title">Hey, {user?.username} 👋</h1>
          <p className="sub-text">Welcome back to your dashboard.</p>
        </div>
        <div className="header-actions">
          <button className="btn btn-primary" onClick={() => setShowNightModal(true)}>
            🎲 New Game Night
          </button>
          <button className="btn-subtle" onClick={() => setShowEditModal(true)}>
            Account settings
          </button>
          <button className="btn-link-danger" onClick={() => setShowDeleteModal(true)}>
            Delete account
          </button>
        </div>
      </header>

      {/* Dashboard grid */}
      <div className="dashboard-grid">

        {/* Left column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

          {/* Podium pie chart */}
          <section className="card">
            <h3>Placement Breakdown</h3>
            {total === 0 ? (
              <p className="sub-text" style={{ marginTop: '12px' }}>No completed games yet.</p>
            ) : (
              <div style={{ display: 'flex', gap: '24px', alignItems: 'center', marginTop: '16px' }}>
                <svg width="120" height="120" viewBox="0 0 120 120">
                  {buildPie()}
                </svg>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {pieData.map(d => (
                    <div key={d.label} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
                      <span style={{ width: 12, height: 12, borderRadius: 3, background: d.color, flexShrink: 0 }} />
                      <span style={{ color: 'var(--text-muted)' }}>{d.label}</span>
                      <span style={{ fontWeight: 700, marginLeft: 'auto', paddingLeft: '12px' }}>
                        {d.value} ({Math.round(d.value / total * 100)}%)
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>

          {/* Win rate by game */}
          {byGame.length > 0 && (
            <section className="card">
              <h3>Win Rate by Game</h3>
              <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {byGame.map(g => (
                  <div key={g.game_name}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '4px' }}>
                      <span style={{ fontWeight: 600 }}>{g.game_name}</span>
                      <span style={{ color: 'var(--primary)', fontWeight: 700 }}>{g.win_rate}%</span>
                    </div>
                    <div style={{ background: 'var(--surface)', borderRadius: '4px', height: '8px', overflow: 'hidden' }}>
                      <div style={{
                        width: `${(Number(g.win_rate) / maxWinRate) * 100}%`,
                        height: '100%',
                        background: 'var(--primary)',
                        borderRadius: '4px',
                        transition: 'width 0.4s ease',
                      }} />
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                      {g.wins}W / {g.total_games} games
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Recent game history */}
          <section className="card">
            <h3>Recent Game History</h3>
            <div className="history-list">
              {history.length > 0
                ? history.map((game, i) => (
                  <div key={i} className="history-item">
                    <div className="game-info">
                      <div className="game-name">{game.game_name}</div>
                      <div className="game-meta">
                        {new Date(game.played_at).toLocaleDateString('en-US', {
                          month: 'short', day: 'numeric', year: 'numeric',
                        })}
                        {game.night_name && ` · ${game.night_name}`}
                      </div>
                    </div>
                    <div className={`game-rank ${game.is_win ? 'win' : ''}`}>
                      {game.is_win ? '🏆 WIN' : game.position ? `#${game.position}` : 'Played'}
                    </div>
                  </div>
                ))
                : (
                  <div style={{ padding: '32px 0', textAlign: 'center' }}>
                    <p className="sub-text">No games recorded yet.</p>
                    <button
                      className="btn btn-primary"
                      style={{ marginTop: '16px' }}
                      onClick={() => setShowNightModal(true)}
                    >
                      Start your first game night
                    </button>
                  </div>
                )
              }
            </div>
          </section>
        </div>

        {/* Stats sidebar */}
        <section className="stats-sidebar">
          <div className="card">
            <h3>Your Stats</h3>
            <div style={{ marginTop: '12px' }}>
              <div className="stat-row">
                <span>Win Rate</span>
                <strong>{stats.winRate}{stats.winRate !== '—' ? '%' : ''}</strong>
              </div>
              <div className="stat-row">
                <span>Total Wins</span>
                <strong>{stats.wins}</strong>
              </div>
              <div className="stat-row">
                <span>Total Games</span>
                <strong>{stats.total}</strong>
              </div>
              <div className="stat-row">
                <span>🥇 1st place</span>
                <strong>{stats.wins}</strong>
              </div>
              <div className="stat-row">
                <span>🥈 2nd place</span>
                <strong>{stats.second_place}</strong>
              </div>
              <div className="stat-row">
                <span>🥉 3rd place</span>
                <strong>{stats.third_place}</strong>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* ── Game Night Creator modal ── */}
      <GameNightCreator
        isOpen={showNightModal}
        onClose={() => setShowNightModal(false)}
        prefillGroupId={null}
      />

      {/* ── Edit profile modal ── */}
      {showEditModal && (
        <div className="modal-overlay">
          <div className="modal-card card">
            <h3>Update Profile</h3>
            <form onSubmit={handleUpdate}>
              <div className="form-group">
                <label>Username</label>
                <input
                  className="input"
                  value={editData.username}
                  onChange={e => setEditData({ ...editData, username: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Email Address</label>
                <input
                  className="input"
                  type="email"
                  value={editData.email}
                  onChange={e => setEditData({ ...editData, email: e.target.value })}
                />
              </div>

              <hr className="divider-line" />

              <div className="form-group">
                <label>New Password <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(optional)</span></label>
                <div className="input-wrapper">
                  <input
                    className="input"
                    type={showNew ? 'text' : 'password'}
                    value={editData.newPass}
                    onChange={e => setEditData({ ...editData, newPass: e.target.value })}
                  />
                  <button type="button" className="eye-btn" onClick={() => setShowNew(!showNew)}>
                    <EyeIcon visible={showNew} />
                  </button>
                </div>
              </div>

              {editData.newPass && (
                <div className="form-group">
                  <label>Confirm New Password</label>
                  <div className="input-wrapper">
                    <input
                      className="input"
                      type={showConfirm ? 'text' : 'password'}
                      value={editData.confirmPass}
                      onChange={e => setEditData({ ...editData, confirmPass: e.target.value })}
                    />
                    <button type="button" className="eye-btn" onClick={() => setShowConfirm(!showConfirm)}>
                      <EyeIcon visible={showConfirm} />
                    </button>
                  </div>
                </div>
              )}

              {needsReauth && (
                <div className="reauth-box">
                  <p style={{ fontSize: '13px', marginBottom: '10px' }}>
                    Confirm your current password to apply changes:
                  </p>
                  <div className="input-wrapper">
                    <input
                      className="input"
                      type={showCurrent ? 'text' : 'password'}
                      placeholder="Current password"
                      required
                      value={editData.currentPass}
                      onChange={e => setEditData({ ...editData, currentPass: e.target.value })}
                    />
                    <button type="button" className="eye-btn" onClick={() => setShowCurrent(!showCurrent)}>
                      <EyeIcon visible={showCurrent} />
                    </button>
                  </div>
                </div>
              )}

              <div className="modal-actions">
                <button type="button" className="btn btn-ghost" onClick={closeEditModal}>Cancel</button>
                <button type="submit" className="btn btn-primary">
                  {needsReauth ? 'Confirm Changes' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Delete account modal ── */}
      {showDeleteModal && (
        <div className="modal-overlay">
          <div className="modal-card card">
            <h2 style={{ color: 'var(--danger)' }}>⚠️ Irreversible Action</h2>
            <p style={{ margin: '16px 0', color: 'var(--text-muted)' }}>
              Are you sure? Your account will be permanently deleted. Game history will be anonymised.
            </p>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setShowDeleteModal(false)}>Cancel</button>
              <button className="btn btn-danger" onClick={confirmDelete}>Yes, Delete Account</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
