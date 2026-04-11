import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import GameNightCreator from '../components/GameNightCreator';

export default function GroupDetail() {
  const { id }      = useParams();
  const { user }    = useAuth();
  const navigate    = useNavigate();

  const [group,      setGroup]      = useState(null);
  const [members,    setMembers]    = useState([]);
  const [gameNights, setGameNights] = useState([]);
  const [leaderboard,setLeaderboard]= useState([]);  // [{ id, username, wins, games }]
  const [loading,    setLoading]    = useState(true);

  const [showNightModal, setShowNightModal] = useState(false);

  // ── Fetch all group data ────────────────────────────────────────────────
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
        setGameNights((nightsRes.data || []).slice(0, 5));  // most recent 5

        // Try to fetch leaderboard; gracefully fall back to members list
        try {
          const lbRes = await axios.get(`/api/groups/${id}/leaderboard`);
          setLeaderboard(lbRes.data || []);
        } catch {
          setLeaderboard(
            (membersRes.data || []).map(m => ({ ...m, wins: 0, games: 0 }))
          );
        }
      } catch {
        toast.error('Failed to load group');
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, [id]);

  const rankIcon = (i) => ['🥇', '🥈', '🥉'][i] ?? `${i + 1}.`;

  // ── Render ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="page" style={{ textAlign: 'center', paddingTop: '80px', color: 'var(--text-muted)' }}>
        Loading group…
      </div>
    );
  }

  return (
    <div className="page">

      {/* Header */}
      <header style={{ marginBottom: '36px', paddingBottom: '24px', borderBottom: '1px solid var(--border)' }}>
        <Link
          to="/groups"
          style={{ fontSize: '13px', color: 'var(--text-muted)', display: 'inline-block', marginBottom: '8px' }}
        >
          ← All Groups
        </Link>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div>
            <h1 style={{ fontSize: '28px', fontWeight: 800, letterSpacing: '-0.03em', margin: 0 }}>
              {group?.name ?? 'Group'}
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '4px' }}>
              {members.length} member{members.length !== 1 ? 's' : ''}
              {group?.created_at && ` · Created ${new Date(group.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`}
            </p>
          </div>
          <button className="btn btn-primary" onClick={() => setShowNightModal(true)}>
            🎲 New Game Night
          </button>
        </div>
      </header>

      {/* Two-column layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '28px', alignItems: 'start' }}>

        {/* Left: Leaderboard + Recent Nights */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

          {/* All-time leaderboard */}
          <div className="card">
            <h3 style={{ marginBottom: '16px', paddingBottom: '12px', borderBottom: '1px solid var(--border)' }}>
              All-Time Leaderboard
            </h3>
            {leaderboard.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
                No games played yet — start a game night!
              </p>
            ) : (
              leaderboard.map((player, i) => (
                <div
                  key={player.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '12px 0',
                    borderBottom: i < leaderboard.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                  }}
                >
                  <span style={{ fontSize: '22px', minWidth: '32px' }}>{rankIcon(i)}</span>
                  <span style={{ flex: 1, fontWeight: 600, fontSize: '14px' }}>{player.username}</span>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 800, color: 'var(--primary)', fontSize: '16px' }}>
                      {player.wins ?? 0}W
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      {player.games ?? 0} games
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Recent game nights */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', paddingBottom: '12px', borderBottom: '1px solid var(--border)' }}>
              <h3 style={{ margin: 0 }}>Recent Game Nights</h3>
            </div>
            {gameNights.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0' }}>
                <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '16px' }}>
                  No game nights yet.
                </p>
                <button className="btn btn-primary" onClick={() => setShowNightModal(true)}>
                  Start First Night
                </button>
              </div>
            ) : (
              gameNights.map((night, i) => (
                <div
                  key={night.id}
                  onClick={() => navigate(`/game-nights/${night.id}`)}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '14px 0',
                    borderBottom: i < gameNights.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                    cursor: 'pointer',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '14px' }}>{night.name}</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                      {new Date(night.played_at || night.created_at).toLocaleDateString('en-US', {
                        weekday: 'short', month: 'short', day: 'numeric',
                      })}
                      {night.game_count != null && ` · ${night.game_count} game${night.game_count !== 1 ? 's' : ''}`}
                    </div>
                  </div>
                  <span style={{ color: 'var(--primary)', fontSize: '18px' }}>→</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right: Members sidebar */}
        <aside style={{ position: 'sticky', top: '24px' }}>
          <div className="card">
            <h3 style={{ marginBottom: '14px', paddingBottom: '12px', borderBottom: '1px solid var(--border)' }}>
              Members · {members.length}
            </h3>
            {members.map(m => (
              <div
                key={m.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '9px 0',
                  borderBottom: '1px solid rgba(255,255,255,0.04)',
                  fontSize: '14px',
                }}
              >
                <span style={{
                  width: '32px', height: '32px',
                  borderRadius: '50%',
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '13px', fontWeight: 700, color: 'var(--primary)',
                  flexShrink: 0,
                }}>
                  {m.username?.[0]?.toUpperCase() ?? '?'}
                </span>
                <span style={{ flex: 1, fontWeight: 500 }}>{m.username}</span>
                {m.id === user?.id && (
                  <span style={{
                    fontSize: '10px', fontWeight: 700, color: 'var(--primary)',
                    background: 'rgba(0,212,170,0.12)', padding: '2px 8px', borderRadius: '4px',
                  }}>You</span>
                )}
              </div>
            ))}
          </div>
        </aside>
      </div>

      {/* Game Night Creator modal — prefill this group */}
      <GameNightCreator
        isOpen={showNightModal}
        onClose={() => setShowNightModal(false)}
        prefillGroupId={id}
      />
    </div>
  );
}
