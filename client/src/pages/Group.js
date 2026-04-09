import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import {
  LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Legend, CartesianGrid
} from 'recharts';

export default function Group() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [group, setGroup] = useState(null);
  const [members, setMembers] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('leaderboard');
  const [showAddMember, setShowAddMember] = useState(false);
  const [newMemberUsername, setNewMemberUsername] = useState('');
  const [addMemberError, setAddMemberError] = useState('');
  const [selectedGame, setSelectedGame] = useState('all');

  useEffect(() => { fetchAll(); }, [id]);

  const fetchAll = async () => {
    try {
      const [groupsRes, membersRes, sessionsRes, leaderboardRes] = await Promise.all([
        axios.get(`/api/groups/user/${user.id}`),
        axios.get(`/api/groups/${id}/members`),
        axios.get(`/api/sessions/group/${id}`),
        axios.get(`/api/sessions/group/${id}/leaderboard`),
      ]);
      const thisGroup = groupsRes.data.find(g => g.id === parseInt(id));
      setGroup(thisGroup);
      setMembers(membersRes.data);
      setSessions(sessionsRes.data);
      setLeaderboard(leaderboardRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const addMember = async (e) => {
    e.preventDefault();
    setAddMemberError('');
    try {
      await axios.post(`/api/groups/${id}/members`, { username: newMemberUsername });
      setNewMemberUsername('');
      setShowAddMember(false);
      fetchAll();
    } catch (err) {
      setAddMemberError(err.response?.data?.error || 'Failed to add member');
    }
  };

  const deleteSession = async (sessionId) => {
    if (!window.confirm('Delete this session?')) return;
    try {
      await axios.delete(`/api/sessions/${sessionId}`);
      fetchAll();
    } catch (err) {
      console.error(err);
    }
  };

  // Build chart data from sessions
  const buildChartData = () => {
    const filtered = selectedGame === 'all'
      ? sessions
      : sessions.filter(s => s.game_name === selectedGame);

    const sorted = [...filtered].reverse();
    return sorted.map((session, i) => {
      const point = {
        name: `${session.game_name} ${new Date(session.played_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
      };
      session.players?.forEach(p => {
        point[p.username] = p.score;
      });
      return point;
    });
  };

  const uniqueGames = [...new Set(sessions.map(s => s.game_name))];
  const chartColors = ['#00d4aa', '#00b4d8', '#7bf5d8', '#ff6b6b', '#ffd166', '#a78bfa'];

  const medals = ['🥇', '🥈', '🥉'];

  if (loading) return (
    <div className="page" style={{ color: 'var(--text-muted)' }}>Loading...</div>
  );

  if (!group) return (
    <div className="page" style={{ color: 'var(--text-muted)' }}>Group not found.</div>
  );

  return (
    <div className="page">
      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <button
          className="btn btn-ghost"
          onClick={() => navigate('/dashboard')}
          style={{ marginBottom: '16px', padding: '6px 14px', fontSize: '13px' }}
        >
          ← Back
        </button>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h1 style={{ fontSize: '30px', marginBottom: '6px' }}>{group.name}</h1>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              {members.map(m => (
                <span key={m.id} className="stat-pill">
                  {m.username === user.username ? '⭐' : '👤'} {m.username}
                </span>
              ))}
              <button
                onClick={() => setShowAddMember(!showAddMember)}
                style={{
                  background: 'transparent', border: '1px dashed var(--border)',
                  borderRadius: '999px', padding: '4px 12px', fontSize: '13px',
                  color: 'var(--text-muted)', cursor: 'pointer', transition: 'all 0.2s',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.color = 'var(--primary)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)'; }}
              >
                + Add member
              </button>
            </div>

            {/* Add member form */}
            {showAddMember && (
              <form onSubmit={addMember} style={{ marginTop: '12px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input
                  className="input"
                  placeholder="Enter username"
                  value={newMemberUsername}
                  onChange={e => setNewMemberUsername(e.target.value)}
                  style={{ width: '200px' }}
                  autoFocus
                />
                <button className="btn btn-primary" type="submit" style={{ padding: '10px 16px' }}>Add</button>
                <button className="btn btn-ghost" type="button" onClick={() => setShowAddMember(false)} style={{ padding: '10px 16px' }}>Cancel</button>
              </form>
            )}
            {addMemberError && <p style={{ color: 'var(--danger)', fontSize: '13px', marginTop: '6px' }}>{addMemberError}</p>}
          </div>

          <button className="btn btn-primary" onClick={() => navigate(`/group/${id}/session/new`)}>
            + Log Session
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '24px', background: 'var(--surface)', borderRadius: '10px', padding: '4px', width: 'fit-content' }}>
        {['leaderboard', 'chart', 'sessions'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '8px 20px', borderRadius: '7px', border: 'none', cursor: 'pointer',
              fontFamily: 'DM Sans, sans-serif', fontSize: '14px', fontWeight: '500',
              background: activeTab === tab ? 'var(--primary)' : 'transparent',
              color: activeTab === tab ? 'var(--bg)' : 'var(--text-muted)',
              transition: 'all 0.2s',
            }}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Tab: Leaderboard */}
      {activeTab === 'leaderboard' && (
        <div>
          {leaderboard.length === 0 ? (
            <EmptySessionsState onLog={() => navigate(`/group/${id}/session/new`)} />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {leaderboard.map((player, i) => (
                <div key={player.username} className="card" style={{ padding: '20px 24px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <span style={{ fontSize: '24px', width: '36px' }}>{medals[i] || `#${i + 1}`}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 600, fontSize: '17px' }}>
                      {player.username}
                      {player.username === user.username && (
                        <span style={{ marginLeft: '8px', fontSize: '12px', color: 'var(--primary)', fontFamily: 'DM Sans, sans-serif', fontWeight: 400 }}>you</span>
                      )}
                    </div>
                    <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '2px' }}>
                      {player.games_played} game{player.games_played !== '1' ? 's' : ''} played
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '24px', textAlign: 'center' }}>
                    <div>
                      <div style={{ fontSize: '22px', fontFamily: 'Outfit, sans-serif', fontWeight: 700, color: 'var(--primary)' }}>
                        {player.wins}
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>wins</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '22px', fontFamily: 'Outfit, sans-serif', fontWeight: 700 }}>
                        {player.total_score}
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>total pts</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '22px', fontFamily: 'Outfit, sans-serif', fontWeight: 700 }}>
                        {Math.round((player.wins / player.games_played) * 100)}%
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>win rate</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab: Chart */}
      {activeTab === 'chart' && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
            <h3>Score over time</h3>
            <select
              className="input"
              style={{ width: 'auto' }}
              value={selectedGame}
              onChange={e => setSelectedGame(e.target.value)}
            >
              <option value="all">All games</option>
              {uniqueGames.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>

          {sessions.length === 0 ? (
            <EmptySessionsState onLog={() => navigate(`/group/${id}/session/new`)} />
          ) : (
            <ResponsiveContainer width="100%" height={340}>
              <LineChart data={buildChartData()} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="name" stroke="var(--text-muted)" tick={{ fontSize: 12 }} />
                <YAxis stroke="var(--text-muted)" tick={{ fontSize: 12 }} />
                <Tooltip
                  contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '8px' }}
                  labelStyle={{ color: 'var(--text)', marginBottom: '4px' }}
                />
                <Legend />
                {members.map((m, i) => (
                  <Line
                    key={m.username}
                    type="monotone"
                    dataKey={m.username}
                    stroke={chartColors[i % chartColors.length]}
                    strokeWidth={2}
                    dot={{ r: 4 }}
                    activeDot={{ r: 6 }}
                    connectNulls
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      )}

      {/* Tab: Sessions */}
      {activeTab === 'sessions' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {sessions.length === 0 ? (
            <EmptySessionsState onLog={() => navigate(`/group/${id}/session/new`)} />
          ) : (
            sessions.map(session => (
              <div key={session.id} className="card" style={{ padding: '18px 24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 600, fontSize: '16px', marginBottom: '4px' }}>
                      🎲 {session.game_name}
                    </div>
                    <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                      {new Date(session.played_at).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                    </div>
                  </div>
                  <button className="btn btn-danger" onClick={() => deleteSession(session.id)} style={{ padding: '5px 12px', fontSize: '12px' }}>
                    Delete
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function EmptySessionsState({ onLog }) {
  return (
    <div style={{ textAlign: 'center', padding: '60px 24px' }}>
      <div style={{ fontSize: '48px', marginBottom: '16px' }}>🏆</div>
      <h3 style={{ marginBottom: '8px' }}>No sessions yet</h3>
      <p style={{ color: 'var(--text-muted)', marginBottom: '24px', fontSize: '14px' }}>
        Log your first game night to start tracking scores.
      </p>
      <button className="btn btn-primary" onClick={onLog}>+ Log Session</button>
    </div>
  );
}