import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import GameNightCreator from '../components/GameNightCreator';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import './GroupDetail.css';

const PLAYER_COLORS = [
  '#00d4aa', '#00b4d8', '#f97316', '#a855f7',
  '#ec4899', '#eab308', '#22d3ee', '#f43f5e',
];

function ChartTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const nightName = payload[0]?.payload?.nightName;
  const date      = payload[0]?.payload?.date;
  const sorted    = [...payload]
    .filter(p => p.value != null)
    .sort((a, b) => b.value - a.value);
  return (
    <div className="gd-chart-tooltip">
      {nightName && <p className="gd-chart-tooltip-title">{nightName}</p>}
      <p className="gd-chart-tooltip-date">{date}</p>
      {sorted.map(p => (
        <div key={p.dataKey} className="gd-chart-tooltip-row">
          <span className="gd-chart-tooltip-dot" style={{ background: p.color }} />
          <span className="gd-chart-tooltip-name">{p.dataKey}</span>
          <span className="gd-chart-tooltip-pts">{p.value} pts</span>
        </div>
      ))}
    </div>
  );
}

export default function GroupDetail() {
  const { id }   = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [group,      setGroup]      = useState(null);
  const [members,    setMembers]    = useState([]);
  const [gameNights, setGameNights] = useState([]);
  const [loading,    setLoading]    = useState(true);

  const [analytics,        setAnalytics]        = useState({ series: [], players: [], games: [] });
  const [leaderboard,      setLeaderboard]      = useState([]);
  const [selectedGame,     setSelectedGame]     = useState('');
  const [analyticsLoading, setAnalyticsLoading] = useState(true);

  const [showNightModal, setShowNightModal] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [showAddModal,   setShowAddModal]   = useState(false);
  const [addUsername,    setAddUsername]    = useState('');
  const [addingMember,   setAddingMember]   = useState(false);
  const [leavingGroup,   setLeavingGroup]   = useState(false);

  useEffect(() => {
    const fetchCore = async () => {
      try {
        const [groupRes, membersRes, nightsRes] = await Promise.all([
          axios.get(`/api/groups/${id}`),
          axios.get(`/api/groups/${id}/members`),
          axios.get(`/api/groups/${id}/game-nights`),
        ]);
        setGroup(groupRes.data);
        setMembers(membersRes.data || []);
        setGameNights(nightsRes.data || []);
      } catch {
        toast.error('Failed to load group');
      } finally {
        setLoading(false);
      }
    };
    fetchCore();
  }, [id]);

  useEffect(() => {
    const fetchAnalytics = async () => {
      setAnalyticsLoading(true);
      try {
        const qs = selectedGame ? `?game_id=${selectedGame}` : '';
        const [analyticsRes, lbRes] = await Promise.all([
          axios.get(`/api/groups/${id}/analytics${qs}`),
          axios.get(`/api/groups/${id}/leaderboard${qs}`),
        ]);
        setAnalytics(analyticsRes.data);
        setLeaderboard(lbRes.data || []);
      } catch {
        // non-fatal
      } finally {
        setAnalyticsLoading(false);
      }
    };
    fetchAnalytics();
  }, [id, selectedGame]);

  const activeNights = gameNights.filter(n => n.is_active !== false);
  const pastNights   = gameNights.filter(n => n.is_active === false);

  const playerColorMap = Object.fromEntries(
    analytics.players.map((name, i) => [name, PLAYER_COLORS[i % PLAYER_COLORS.length]])
  );
  const selectedGameName = analytics.games.find(g => String(g.id) === selectedGame)?.name ?? '';

  const handleAddMember = async (e) => {
    e.preventDefault();
    if (!addUsername.trim()) return;
    setAddingMember(true);
    try {
      const { data } = await axios.post(`/api/groups/${id}/members`, { username: addUsername.trim() });
      if (data.found === false) {
        toast.error(`"${addUsername}" doesn't have an account. Only registered users can join groups.`);
        return;
      }
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
    if (!group?.invite_code) return;
    navigator.clipboard.writeText(group.invite_code);
    toast.success('Invite code copied!');
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
          <button className="btn btn-ghost gd-invite-btn" onClick={copyInviteCode} title="Click to copy invite code">
            🔗 <span className="gd-invite-code-inline">{group?.invite_code}</span>
          </button>
          <button className="btn btn-primary" onClick={() => setShowNightModal(true)}>
            🎲 New Game Night
          </button>
        </div>
      </header>

      <div className="gd-grid">
        <div className="gd-main">

          {/* Points-over-time chart */}
          <div className="card">
            <div className="gd-chart-header">
              <h3 className="gd-card-title" style={{ margin: 0 }}>
                {selectedGameName ? `${selectedGameName} — Points Over Time` : 'Points Over Time'}
              </h3>
              {analytics.games.length > 0 && (
                <div className="gd-filter-pills">
                  <button
                    className={`gd-filter-pill ${selectedGame === '' ? 'gd-filter-pill--active' : ''}`}
                    onClick={() => setSelectedGame('')}
                  >
                    All Games
                  </button>
                  {analytics.games.map(g => (
                    <button
                      key={g.id}
                      className={`gd-filter-pill ${selectedGame === String(g.id) ? 'gd-filter-pill--active' : ''}`}
                      onClick={() => setSelectedGame(String(g.id))}
                    >
                      {g.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {analyticsLoading ? (
              <div className="gd-chart-loading">
                <div className="gd-chart-spinner" />
                <span>Loading analytics…</span>
              </div>
            ) : analytics.series.length === 0 ? (
              <div className="gd-chart-empty">
                <span>📊</span>
                <p>Complete a game night to see trends here.</p>
              </div>
            ) : analytics.series.length < 2 ? (
              <div className="gd-chart-empty">
                <span>📈</span>
                <p>Play at least 2 game nights to see how rankings evolve.</p>
              </div>
            ) : (
              <div className="gd-chart-wrap">
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={analytics.series} margin={{ top: 8, right: 16, bottom: 0, left: -8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                    <XAxis dataKey="date" stroke="var(--text-muted)" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
                    <YAxis stroke="var(--text-muted)" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} allowDecimals={false} />
                    <Tooltip content={<ChartTooltip />} />
                    <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '14px' }} />
                    {analytics.players.map((player, i) => (
                      <Line
                        key={player}
                        type="monotone"
                        dataKey={player}
                        stroke={PLAYER_COLORS[i % PLAYER_COLORS.length]}
                        strokeWidth={2.5}
                        dot={{ r: 4, strokeWidth: 0, fill: PLAYER_COLORS[i % PLAYER_COLORS.length] }}
                        activeDot={{ r: 6, strokeWidth: 0 }}
                        connectNulls
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Active game nights */}
          {activeNights.length > 0 && (
            <div className="card">
              <div className="gd-card-header">
                <h3 className="gd-card-title" style={{ margin: 0 }}>🟢 Active Nights · {activeNights.length}</h3>
                <button className="btn btn-primary" style={{ fontSize: '13px' }} onClick={() => setShowNightModal(true)}>
                  + New Night
                </button>
              </div>
              {activeNights.map(night => (
                <div key={night.id} className="gd-night-row" onClick={() => navigate(`/game-nights/${night.id}`)}>
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
                Past Game Nights{pastNights.length > 0 && ` · ${pastNights.length}`}
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
                <button className="btn btn-primary" onClick={() => setShowNightModal(true)}>Start First Night</button>
              </div>
            ) : pastNights.length === 0 ? (
              <div className="gd-empty-state"><p>No completed nights yet — end a night to archive it here.</p></div>
            ) : (
              pastNights.map(night => (
                <div key={night.id} className="gd-night-row" onClick={() => navigate(`/game-nights/${night.id}`)}>
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

        {/* Sidebar */}
        <aside className="gd-sidebar">

          <div className="card">
            <h3 className="gd-card-title">
              {selectedGameName ? `${selectedGameName} Board` : 'All-Time Leaderboard'}
            </h3>
            {analyticsLoading ? (
              <div className="gd-chart-loading" style={{ padding: '24px 0' }}>
                <div className="gd-chart-spinner" />
              </div>
            ) : leaderboard.length === 0 ? (
              <div className="gd-empty-state" style={{ padding: '16px 0' }}>
                <p>No results yet — start a game night!</p>
                <button className="btn btn-primary" onClick={() => setShowNightModal(true)}>Start First Night</button>
              </div>
            ) : leaderboard.map((player, i) => (
              <div key={player.id} className="gd-lb-row">
                <span className="gd-lb-rank">{rankIcon(i)}</span>
                <div className="gd-lb-info">
                  <span className="gd-lb-name" style={{ color: playerColorMap[player.username] || 'var(--text)' }}>
                    {player.username}
                  </span>
                  <span className="gd-lb-sub">{player.games ?? 0}G · {player.wins ?? 0}W</span>
                </div>
                <div className="gd-lb-score">
                  <span className="gd-lb-pts">{player.points ?? 0}</span>
                  <span className="gd-lb-pts-label">pts</span>
                </div>
              </div>
            ))}
          </div>

          <div className="card">
            <div className="gd-card-header">
              <h3 className="gd-card-title" style={{ margin: 0 }}>Members · {members.length}</h3>
              <button className="btn btn-ghost" style={{ fontSize: '12px', padding: '4px 10px' }} onClick={() => setShowAddModal(true)}>
                + Add
              </button>
            </div>
            {members.map(m => (
              <div key={m.id} className="gd-member-row">
                <span className="gd-member-avatar">{m.username?.[0]?.toUpperCase() ?? '?'}</span>
                <span className="gd-member-name">{m.username}</span>
                {m.id === user?.id && <span className="gd-you-badge">You</span>}
                {m.id === group?.created_by && m.id !== user?.id && <span className="gd-owner-badge">Owner</span>}
              </div>
            ))}
            <div className="gd-member-actions">
              <button className="btn-text-danger" onClick={() => setShowLeaveModal(true)}>Leave group</button>
            </div>
          </div>

        </aside>
      </div>

      {showAddModal && (
        <div className="gd-modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="gd-modal card" onClick={e => e.stopPropagation()}>
            <h3>Add Member</h3>
            <p className="gd-modal-sub">Enter their exact username to add them to the group.</p>
            <form onSubmit={handleAddMember}>
              <div className="form-group">
                <label>Username</label>
                <input className="input" placeholder="e.g. gamemaster99" value={addUsername} onChange={e => setAddUsername(e.target.value)} autoFocus required />
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