import React, { useState, useEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast'; // Import the toaster
import { useAuth } from '../context/AuthContext';
import EyeIcon from '../components/EyeIcon';
import './Dashboard.css';

export default function Dashboard() {
  const { user, logout } = useAuth();
  const [stats, setStats] = useState({ winRate: '0%', total: 0 });
  const [history, setHistory] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [needsReauth, setNeedsReauth] = useState(false);
  
  // Independent eye states
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [editData, setEditData] = useState({
    username: user?.username || '',
    email: user?.email || '',
    newPass: '',
    confirmPass: '',
    currentPass: ''
  });

  const handleUpdate = async (e) => {
    e.preventDefault();
    
    const isChangingEmail = editData.email !== user.email;
    const isChangingPass = editData.newPass !== "";

    if ((isChangingEmail || isChangingPass) && !needsReauth) {
      setNeedsReauth(true);
      toast('Please confirm your current password to save sensitive changes.', { icon: '🔐' });
      return;
    }

    if (isChangingPass && editData.newPass !== editData.confirmPass) {
      return toast.error("New passwords do not match.");
    }

    try {
      // Points to your updated auth route
      await axios.put(`/api/auth/update/${user.id}`, {
        username: editData.username,
        email: editData.email,
        newPass: editData.newPass,
        currentPass: editData.currentPass
      });
      
      toast.success("Profile updated successfully!");
      setShowModal(false);
      setNeedsReauth(false);
      setEditData(prev => ({ ...prev, newPass: '', confirmPass: '', currentPass: '' }));
    } catch (err) {
      toast.error(err.response?.data?.error || "Update failed.");
    }
  };

  const confirmDelete = async () => {
    const loadingToast = toast.loading("Deleting account...");
    try {
      // Points to your delete route
      await axios.delete(`/api/auth/delete/${user.id}`);
      toast.success("Account deleted. See you around!", { id: loadingToast });
      logout();
    } catch (err) {
      toast.error("Failed to delete account", { id: loadingToast });
    }
  };

  const closeUpdateModal = () => {
    setShowModal(false);
    setNeedsReauth(false);
    setShowCurrent(false);
    setShowNew(false);
    setShowConfirm(false);
    setEditData({
      username: user.username,
      email: user.email,
      newPass: '',
      confirmPass: '',
      currentPass: ''
    });
  };

  return (
    <div className="page dashboard-container">
      <header className="dashboard-header">
        <div className="header-left">
          <h1 className="page-title">Hey, {user?.username} 👋</h1>
          <p className="sub-text">Welcome back to your dashboard.</p>
        </div>
        <div className="header-actions">
          <button className="btn-subtle" onClick={() => setShowModal(true)}>
            Update account info
          </button>
          <button className="btn-link-danger" onClick={() => setShowDeleteModal(true)}>
            Delete Account
          </button>
        </div>
      </header>

      <div className="dashboard-grid">
        <section className="card">
          <h3>Recent Game History</h3>
          <div className="history-list">
            {history.length > 0 ? history.map((game, i) => (
              <div key={i} className="history-item">
                <div className="game-info">
                  <div className="game-name">{game.game_name}</div>
                  <div className="game-meta">{new Date(game.played_at).toLocaleDateString()}</div>
                </div>
                <div className={`game-rank ${game.is_win ? 'win' : ''}`}>
                  {game.is_win ? '🏆 WIN' : 'Played'}
                </div>
              </div>
            )) : <p className="sub-text">No games recorded yet.</p>}
          </div>
        </section>

        <section className="stats-sidebar">
          <div className="card">
            <h3>Quick Stats</h3>
            <div className="stat-row"><span>Win Rate</span> <strong>{stats.winRate}</strong></div>
            <div className="stat-row"><span>Total Games</span> <strong>{stats.total}</strong></div>
          </div>
        </section>
      </div>

      {showModal && (
        <div className="modal-overlay">
          <div className="modal-card card">
            <h3>Update Profile</h3>
            <form onSubmit={handleUpdate}>
              <div className="form-group">
                <label>Username</label>
                <input className="input" value={editData.username} onChange={e => setEditData({...editData, username: e.target.value})} />
              </div>
              <div className="form-group">
                <label>Email Address</label>
                <input className="input" value={editData.email} onChange={e => setEditData({...editData, email: e.target.value})} />
              </div>

              <hr className="divider-line" />
              
              <div className="form-group">
                <label>New Password (Optional)</label>
                <div className="input-wrapper">
                  <input className="input" type={showNew ? "text" : "password"} value={editData.newPass} onChange={e => setEditData({...editData, newPass: e.target.value})} />
                  <button type="button" className="eye-btn" onClick={() => setShowNew(!showNew)}>
                    <EyeIcon visible={showNew} />
                  </button>
                </div>
              </div>

              {editData.newPass && (
                <div className="form-group">
                  <label>Confirm New Password</label>
                  <div className="input-wrapper">
                    <input className="input" type={showConfirm ? "text" : "password"} value={editData.confirmPass} onChange={e => setEditData({...editData, confirmPass: e.target.value})} />
                    <button type="button" className="eye-btn" onClick={() => setShowConfirm(!showConfirm)}>
                      <EyeIcon visible={showConfirm} />
                    </button>
                  </div>
                </div>
              )}

              {needsReauth && (
                <div className="reauth-box">
                  <p style={{ fontSize: '13px', marginBottom: '10px' }}>Enter current password to verify changes:</p>
                  <div className="input-wrapper">
                    <input className="input" type={showCurrent ? "text" : "password"} placeholder="Current Password" required value={editData.currentPass} onChange={e => setEditData({...editData, currentPass: e.target.value})} />
                    <button type="button" className="eye-btn" onClick={() => setShowCurrent(!showCurrent)}>
                      <EyeIcon visible={showCurrent} />
                    </button>
                  </div>
                </div>
              )}

              <div className="modal-actions">
                <button type="button" className="btn btn-ghost" onClick={closeUpdateModal}>Cancel</button>
                <button type="submit" className="btn btn-primary">
                  {needsReauth ? "Confirm Changes" : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showDeleteModal && (
        <div className="modal-overlay">
          <div className="modal-card card">
            <h2 style={{ color: 'var(--danger)' }}>⚠️ Irreversible Action</h2>
            <p style={{ margin: '16px 0', color: 'var(--text-muted)' }}>Are you sure? Account history will be anonymized.</p>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setShowDeleteModal(false)}>Cancel</button>
              <button className="btn btn-danger" onClick={confirmDelete}>Confirm Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}