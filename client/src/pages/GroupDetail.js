import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import GameNightCreator from '../components/GameNightCreator';
import './GroupDetail.css';

export default function GroupDetail() {
  const { id }   = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [group,       setGroup]       = useState(null);
  const [members,     setMembers]     = useState([]);
  const [gameNights,  setGameNights]  = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading,     setLoading]     = useState(true);

  const [showNightModal,  setShowNightModal]  = useState(false);
  const [showLeaveModal,  setShowLeaveModal]  = useState(false);
  const [showAddModal,    setShowAddModal]    = useState(false);
  const [addUsername,     setAddUsername]     = useState('');
  const [addingMember,    setAddingMember]    = useState(false);
  const [leavingGroup,    setLeavingGroup]    = useState(false);
  const [showInviteCode,  setShowInviteCode]  = useState(false);

  const isCreator = group?.created_by === user?.id;

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [groupRes, membersRes, nightsRes] = await Promise.all([
          axios.get(`/api/groups/${id}`),
          axios.get(`/api/groups/${id}/members`),
          axios.get(`/api/groups/${id}/game-nights`),
        ]);

        setGroup(groupRes.data);
        setMembers(membersRes.data || []);
        setGameNights(nightsRes.data || []);

        try {
          const lbRes = await axios.get(`/api/groups/${id}/leaderboard`);
          setLeaderboard(lbRes.data || []);
        } catch {
          setLeaderboard((membersRes.data || []).map(m => ({ ...m, points: 0, wins: 0, games: 0 })));
        }
      } catch {
        toast.error('Failed to load group');
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, [id]);

  // Split nights into active and past
  const activeNights = gameNights.filter(n => n.is_active !== false);
  const pastNights   = gameNights.filter(n => n.is_active === false);

  const handleAddMember = async (e) => {
    e.preventDefault();
    if (!addUsername.trim()) return;
    setAddingMember(true);
    try {
      await axios.post(`/api/groups/${id}/members`, { username: addUsername.trim() });
      toast.success(`${addUsername} added to group!`);
      setAddUsername('');
      setShowAddModal(false);
      const res = await axios.get(`/api/groups/${id}/members`);
      setMembers(res.data || []);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to add member');
    } finally {
      setAddingMember(false);
    }
  };

  const handleLeaveGroup = async () => {
    setLeavingGroup(true);
    try {
      await axios.delete(`/api/groups/${id}/members/${user.id}`);
      toast.success('You left the group.');
      navigate('/groups');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to leave group');
      setLeavingGroup(false);
    }
  };

  const copyInviteCode = () => {
    if (group?.invite_code) {
      navigator.clipboard.writeText(group.invite_code);
      toast.success('Invite code copied!');
    }
  };

  const rankIcon = (i) => ['🥇', '🥈', '🥉'][i] ?? `${i + 1}.`;

  const formatNightDate = (night) =>
    new Date(night.played_at || night.created_at).toLocaleDateString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric',
    });

  if (loading) {
    return (
      <div className="page gd-loading">
        <div className="gd-spinner" />
        <p>Loading group…</p>
      </div>
    );
  }

  return (
    <div className="page">

      {/* ── Header ── */}
      <header className="gd-header">
        <div>
          <Link to="/groups" className="gd-back-link">← All Groups</Link>
          <h1 className="gd-title">{group?.name ?? 'Group'}</h1>
          <p className="gd-meta">
            {members.length} member{members.length !== 1 ? 's' : ''}
            {group?.created_at && ` · Created ${new Date(group.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`}
          </p>
        </div>
        <div className="gd-header-actions">
          <button className="btn btn-ghost" onClick={() => setShowInviteCode(s => !s)}>
            🔗 Invite Code
          </button>
          <button className="btn btn-primary" onClick={() => setShowNightModal(true)}>
            🎲 New Game Night
          </button>
        </div>
      </header>

      {/* ── Invite code banner ── */}
      {showInviteCode && group?.invite_code && (
        <div className="gd-invite-banner">
          <div>
            <p className="gd-invite-label">Share this code for others to join</p>
            <p className="gd-invite-code">{group.invite_code}</p>
          </div>
          <button className="btn btn-ghost" onClick={copyInviteCode}>Copy</button>
        </div>
      )}

      {/* ── Main grid ── */}
      <div className="gd-grid">

        <div className="gd-main">

          {/* All-time leaderboard */}
          <div className="card">
            <h3 className="gd-card-title">All-Time Leaderboard</h3>

            {leaderboard.length === 0 ? (
              <div className="gd-empty-state">
                <p>No games played yet — start a game night!</p>
                <button className="btn btn-primary" onClick={() => setShowNightModal(true)}>
                  Start First Night
                </button>
              </div>
            ) : (
              leaderboard.map((player, i) => (
                <div key={player.id} className="gd-lb-row">
                  <span className="gd-lb-rank">{rankIcon(i)}</span>
                  <div className="gd-lb-info">
                    <span className="gd-lb-name">{player.username}</span>
                    <span className="gd-lb-sub">{player.games ?? 0} game{player.games !== 1 ? 's' : ''}</span>
                  </div>
                  <div className="gd-lb-score">
                    <span className="gd-lb-pts">{player.points ?? 0}</span>
                    <span className="gd-lb-pts-label">pts</span>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Active game nights */}
          {activeNights.length > 0 && (
            <div className="card">
              <div className="gd-card-header">
                <h3 className="gd-card-title" style={{ margin: 0 }}>
                  🟢 Active Nights · {activeNights.length}
                </h3>
                <button className="btn btn-primary" style={{ fontSize: '13px' }} onClick={() => setShowNightModal(true)}>
                  + New Night
                </button>
              </div>
              {activeNights.map(night => (
                <div
                  key={night.id}
                  className="gd-night-row"
                  onClick={() => navigate(`/game-nights/${night.id}`)}
                >
                  <div>
                    <div className="gd-night-name">
                      {night.name || 'Game Night'}
                      <span className="gd-active-badge">LIVE</span>
                    </div>
                    <div className="gd-night-meta">
                      {formatNightDate(night)}
                      {night.game_count > 0 && ` · ${night.game_count} game${night.game_count !== 1 ? 's' : ''}`}
                    </div>
                  </div>
                  <span className="gd-night-arrow">→</span>
                </div>
              ))}
            </div>
          )}

          {/* Past game nights */}
          <div className="card">
            <div className="gd-card-header">
              <h3 className="gd-card-title" style={{ margin: 0 }}>
                Past Game Nights
                {pastNights.length > 0 && ` · ${pastNights.length}`}
              </h3>
              {activeNights.length === 0 && (
                <button className="btn btn-ghost" style={{ fontSize: '13px' }} onClick={() => setShowNightModal(true)}>
                  + New Night
                </button>
              )}
            </div>

            {pastNights.length === 0 && activeNights.length === 0 ? (
              <div className="gd-empty-state">
                <p>No game nights yet.</p>
                <button className="btn btn-primary" onClick={() => setShowNightModal(true)}>
                  Start First Night
                </button>
              </div>
            ) : pastNights.length === 0 ? (
              <div className="gd-empty-state">
                <p>No completed nights yet — end a night to archive it here.</p>
              </div>
            ) : (
              pastNights.map(night => (
                <div
                  key={night.id}
                  className="gd-night-row"
                  onClick={() => navigate(`/game-nights/${night.id}`)}
                >
                  <div>
                    <div className="gd-night-name">{night.name || 'Game Night'}</div>
                    <div className="gd-night-meta">
                      {formatNightDate(night)}
                      {night.game_count > 0 && ` · ${night.game_count} game${night.game_count !== 1 ? 's' : ''}`}
                    </div>
                  </div>
                  <span className="gd-night-arrow">→</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right: members sidebar */}
        <aside className="gd-sidebar">
          <div className="card">
            <div className="gd-card-header">
              <h3 className="gd-card-title" style={{ margin: 0 }}>Members · {members.length}</h3>
              <button
                className="btn btn-ghost"
                style={{ fontSize: '12px', padding: '4px 10px' }}
                onClick={() => setShowAddModal(true)}
              >
                + Add
              </button>
            </div>

            {members.map(m => (
              <div key={m.id} className="gd-member-row">
                <span className="gd-member-avatar">
                  {m.username?.[0]?.toUpperCase() ?? '?'}
                </span>
                <span className="gd-member-name">{m.username}</span>
                {m.id === user?.id && <span className="gd-you-badge">You</span>}
                {m.id === group?.created_by && m.id !== user?.id && (
                  <span className="gd-owner-badge">Owner</span>
                )}
              </div>
            ))}

            <div className="gd-member-actions">
              <button
                className="btn-text-danger"
                onClick={() => setShowLeaveModal(true)}
              >
                Leave group
              </button>
            </div>
          </div>
        </aside>
      </div>

      {/* ── Modals ── */}

      {showAddModal && (
        <div className="gd-modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="gd-modal card" onClick={e => e.stopPropagation()}>
            <h3>Add Member</h3>
            <p className="gd-modal-sub">Enter their exact username to add them to the group.</p>
            <form onSubmit={handleAddMember}>
              <div className="form-group">
                <label>Username</label>
                <input
                  className="input"
                  placeholder="e.g. gamemaster99"
                  value={addUsername}
                  onChange={e => setAddUsername(e.target.value)}
                  autoFocus
                  required
                />
              </div>
              <div className="gd-modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setShowAddModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={addingMember}>
                  {addingMember ? 'Adding…' : 'Add Member'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showLeaveModal && (
        <div className="gd-modal-overlay" onClick={() => setShowLeaveModal(false)}>
          <div className="gd-modal card" onClick={e => e.stopPropagation()}>
            <h3>Leave "{group?.name}"?</h3>
            <p className="gd-modal-sub">
              You'll lose access to this group's stats and game nights. You can rejoin with the invite code.
            </p>
            <div className="gd-modal-footer">
              <button className="btn btn-ghost" onClick={() => setShowLeaveModal(false)}>Cancel</button>
              <button className="btn btn-danger" onClick={handleLeaveGroup} disabled={leavingGroup}>
                {leavingGroup ? 'Leaving…' : 'Yes, Leave Group'}
              </button>
            </div>
          </div>
        </div>
      )}

      <GameNightCreator
        isOpen={showNightModal}
        onClose={() => setShowNightModal(false)}
        prefillGroupId={id}
      />
    </div>
  );
}
