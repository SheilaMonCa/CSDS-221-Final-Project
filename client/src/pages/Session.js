import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

export default function Session() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [members, setMembers] = useState([]);
  const [games, setGames] = useState([]);
  const [selectedGame, setSelectedGame] = useState('');
  const [newGameName, setNewGameName] = useState('');
  const [isNewGame, setIsNewGame] = useState(false);
  const [playedAt, setPlayedAt] = useState(new Date().toISOString().split('T')[0]);
  const [scores, setScores] = useState({});
  const [presentPlayers, setPresentPlayers] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchData();
  }, [id]);

  const fetchData = async () => {
    try {
      const [membersRes, gamesRes] = await Promise.all([
        axios.get(`/api/groups/${id}/members`),
        axios.get('/api/games'),
      ]);
      setMembers(membersRes.data);
      setGames(gamesRes.data);

      // Default: all members are present
      const presence = {};
      const scoreDefaults = {};
      membersRes.data.forEach(m => {
        presence[m.id] = true;
        scoreDefaults[m.id] = '';
      });
      setPresentPlayers(presence);
      setScores(scoreDefaults);
    } catch (err) {
      setError('Failed to load data');
    }
  };

  const togglePresence = (memberId) => {
    setPresentPlayers(prev => ({ ...prev, [memberId]: !prev[memberId] }));
    if (presentPlayers[memberId]) {
      setScores(prev => ({ ...prev, [memberId]: '' }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const presentMemberIds = Object.keys(presentPlayers).filter(id => presentPlayers[id]);
    if (presentMemberIds.length < 2) {
      setError('At least 2 players must be present');
      return;
    }

    const missingScores = presentMemberIds.some(id => scores[id] === '');
    if (missingScores) {
      setError('Please enter a score for every present player');
      return;
    }

    setSubmitting(true);
    try {
      // Create game if new
      let gameId = selectedGame;
      if (isNewGame) {
        if (!newGameName.trim()) { setError('Enter a game name'); setSubmitting(false); return; }
        const { data } = await axios.post('/api/games', { name: newGameName });
        gameId = data.id;
      }

      if (!gameId) { setError('Please select or enter a game'); setSubmitting(false); return; }

      const players = presentMemberIds.map(memberId => ({
        user_id: parseInt(memberId),
        score: parseInt(scores[memberId]),
      }));

      await axios.post('/api/sessions', {
        group_id: parseInt(id),
        game_id: parseInt(gameId),
        played_at: playedAt,
        players,
      });

      navigate(`/group/${id}`);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to log session');
    } finally {
      setSubmitting(false);
    }
  };

  const presentCount = Object.values(presentPlayers).filter(Boolean).length;

  return (
    <div className="page" style={{ maxWidth: '620px' }}>
      {/* Header */}
      <button
        className="btn btn-ghost"
        onClick={() => navigate(`/group/${id}`)}
        style={{ marginBottom: '24px', padding: '6px 14px', fontSize: '13px' }}
      >
        ← Back
      </button>

      <h1 style={{ fontSize: '28px', marginBottom: '6px' }}>Log a session</h1>
      <p style={{ color: 'var(--text-muted)', marginBottom: '32px', fontSize: '14px' }}>
        Record who played, what game, and the final scores.
      </p>

      {error && <div className="error">{error}</div>}

      <form onSubmit={handleSubmit}>

        {/* Game selection */}
        <div className="card" style={{ marginBottom: '16px' }}>
          <h3 style={{ fontSize: '16px', marginBottom: '16px' }}>🎲 What game was played?</h3>

          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
            <button
              type="button"
              className="btn"
              onClick={() => setIsNewGame(false)}
              style={{
                flex: 1, justifyContent: 'center',
                background: !isNewGame ? 'var(--primary)' : 'transparent',
                color: !isNewGame ? 'var(--bg)' : 'var(--text-muted)',
                border: !isNewGame ? 'none' : '1px solid var(--border)',
              }}
            >
              Existing game
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => setIsNewGame(true)}
              style={{
                flex: 1, justifyContent: 'center',
                background: isNewGame ? 'var(--primary)' : 'transparent',
                color: isNewGame ? 'var(--bg)' : 'var(--text-muted)',
                border: isNewGame ? 'none' : '1px solid var(--border)',
              }}
            >
              New game
            </button>
          </div>

          {isNewGame ? (
            <input
              className="input"
              placeholder="e.g. Catan, Charades, Uno..."
              value={newGameName}
              onChange={e => setNewGameName(e.target.value)}
            />
          ) : (
            <select
              className="input"
              value={selectedGame}
              onChange={e => setSelectedGame(e.target.value)}
            >
              <option value="">Select a game...</option>
              {games.map(g => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          )}
        </div>

        {/* Date */}
        <div className="card" style={{ marginBottom: '16px' }}>
          <h3 style={{ fontSize: '16px', marginBottom: '16px' }}>📅 When was it played?</h3>
          <input
            className="input"
            type="date"
            value={playedAt}
            onChange={e => setPlayedAt(e.target.value)}
            style={{ colorScheme: 'dark' }}
          />
        </div>

        {/* Players & scores */}
        <div className="card" style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '16px' }}>👥 Who played?</h3>
            <span className="stat-pill">
              <span>{presentCount}</span> present
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {members.map(member => (
              <div
                key={member.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px 16px',
                  borderRadius: '10px',
                  background: presentPlayers[member.id] ? 'var(--surface)' : 'transparent',
                  border: `1px solid ${presentPlayers[member.id] ? 'var(--primary)' : 'var(--border)'}`,
                  transition: 'all 0.2s',
                  opacity: presentPlayers[member.id] ? 1 : 0.5,
                }}
              >
                {/* Presence toggle */}
                <button
                  type="button"
                  onClick={() => togglePresence(member.id)}
                  style={{
                    width: '22px', height: '22px', borderRadius: '50%', border: 'none',
                    background: presentPlayers[member.id] ? 'var(--primary)' : 'var(--border)',
                    cursor: 'pointer', flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '12px', transition: 'all 0.2s',
                  }}
                >
                  {presentPlayers[member.id] ? '✓' : ''}
                </button>

                {/* Name */}
                <span style={{ flex: 1, fontWeight: 500 }}>
                  {member.username}
                  {member.username === user.username && (
                    <span style={{ marginLeft: '6px', fontSize: '12px', color: 'var(--primary)' }}>you</span>
                  )}
                </span>

                {/* Score input */}
                {presentPlayers[member.id] && (
                  <input
                    className="input"
                    type="number"
                    placeholder="Score"
                    value={scores[member.id]}
                    onChange={e => setScores(prev => ({ ...prev, [member.id]: e.target.value }))}
                    style={{ width: '90px', textAlign: 'center' }}
                    min="0"
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        <button
          type="submit"
          className="btn btn-primary"
          disabled={submitting}
          style={{ width: '100%', justifyContent: 'center', padding: '14px', fontSize: '15px' }}
        >
          {submitting ? 'Saving...' : '🏆 Save session'}
        </button>
      </form>
    </div>
  );
}