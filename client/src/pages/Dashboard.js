import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchGroups();
  }, []);

  const fetchGroups = async () => {
    try {
      const { data } = await axios.get(`/api/groups/user/${user.id}`);
      setGroups(data);
    } catch (err) {
      setError('Failed to load groups');
    } finally {
      setLoading(false);
    }
  };

  const createGroup = async (e) => {
    e.preventDefault();
    if (!newGroupName.trim()) return;
    setCreating(true);
    try {
      const { data } = await axios.post('/api/groups', {
        name: newGroupName,
        user_id: user.id,
      });
      setGroups([...groups, data]);
      setNewGroupName('');
      setShowModal(false);
    } catch (err) {
      setError('Failed to create group');
    } finally {
      setCreating(false);
    }
  };

  const emojis = ['🎲', '🃏', '♟️', '🎯', '🎮', '🏆', '🎳', '🎰'];
  const getEmoji = (name) => emojis[name.charCodeAt(0) % emojis.length];

  return (
    <div className="page">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '40px' }}>
        <div>
          <h1 style={{ fontSize: '32px', marginBottom: '6px' }}>
            Hey, {user.username} 👋
          </h1>
          <p style={{ color: 'var(--text-muted)' }}>
            Select a group to view stats, or create a new one.
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          + New Group
        </button>
      </div>

      {error && <div className="error">{error}</div>}

      {/* Groups grid */}
      {loading ? (
        <p style={{ color: 'var(--text-muted)' }}>Loading...</p>
      ) : groups.length === 0 ? (
        <EmptyState onCreateClick={() => setShowModal(true)} />
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: '16px',
        }}>
          {groups.map(group => (
            <GroupCard
              key={group.id}
              group={group}
              emoji={getEmoji(group.name)}
              onClick={() => navigate(`/group/${group.id}`)}
            />
          ))}
        </div>
      )}

      {/* Create group modal */}
      {showModal && (
        <Modal onClose={() => setShowModal(false)}>
          <h2 style={{ marginBottom: '6px' }}>Create a group</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '24px' }}>
            Give your friend group a name — you can invite members after.
          </p>
          <form onSubmit={createGroup}>
            <div className="form-group">
              <label>Group name</label>
              <input
                className="input"
                placeholder="e.g. College Friends, Family..."
                value={newGroupName}
                onChange={e => setNewGroupName(e.target.value)}
                autoFocus
                required
              />
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '8px' }}>
              <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={creating}>
                {creating ? 'Creating...' : 'Create group'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

function GroupCard({ group, emoji, onClick }) {
  return (
    <div
      className="card"
      onClick={onClick}
      style={{
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        position: 'relative',
        overflow: 'hidden',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = 'var(--primary)';
        e.currentTarget.style.transform = 'translateY(-2px)';
        e.currentTarget.style.boxShadow = '0 8px 30px rgba(0, 212, 170, 0.12)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = 'var(--border)';
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = 'none';
      }}
    >
      {/* Decorative background emoji */}
      <div style={{
        position: 'absolute', top: '-10px', right: '-4px',
        fontSize: '80px', opacity: 0.06, userSelect: 'none',
      }}>
        {emoji}
      </div>

      <div style={{ fontSize: '32px', marginBottom: '14px' }}>{emoji}</div>
      <h3 style={{ fontSize: '18px', marginBottom: '6px' }}>{group.name}</h3>
      <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
        Created {new Date(group.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
      </p>

      <div style={{
        marginTop: '20px',
        paddingTop: '16px',
        borderTop: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>View stats & sessions</span>
        <span style={{ color: 'var(--primary)', fontSize: '18px' }}>→</span>
      </div>
    </div>
  );
}

function EmptyState({ onCreateClick }) {
  return (
    <div style={{ textAlign: 'center', padding: '80px 24px' }}>
      <div style={{ fontSize: '64px', marginBottom: '20px' }}>🎲</div>
      <h2 style={{ marginBottom: '10px' }}>No groups yet</h2>
      <p style={{ color: 'var(--text-muted)', marginBottom: '28px', maxWidth: '360px', margin: '0 auto 28px' }}>
        Create a group for your friend circle or family and start tracking who's the real champion.
      </p>
      <button className="btn btn-primary" onClick={onCreateClick}>
        + Create your first group
      </button>
    </div>
  );
}

function Modal({ children, onClose }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 200, padding: '24px',
      }}
    >
      <div
        className="card"
        onClick={e => e.stopPropagation()}
        style={{ width: '100%', maxWidth: '440px' }}
      >
        {children}
      </div>
    </div>
  );
}