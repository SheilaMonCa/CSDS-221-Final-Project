import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import EyeIcon from '../components/EyeIcon';
import GameNightCreator from '../components/GameNightCreator';
import './Dashboard.css';

// ─── Colour palette for chart lines ─────────────────────────────────────────
const PLAYER_COLOURS = [
  '#00d4aa', '#00b4d8', '#7b61ff', '#ff6b6b', '#ffd166',
  '#06d6a0', '#ef476f', '#118ab2', '#fca311', '#9b5de5',
];

// ─── Points-Over-Time Line Chart ─────────────────────────────────────────────
function PointsChart({ data, gameFilter }) {
  const svgRef = useRef(null);
  const [tooltip, setTooltip] = useState(null);
  const [hoveredPlayer, setHoveredPlayer] = useState(null);

  // data shape: { players: [{id, username, colour}], nights: [{nightId, name, date, scores: {playerId: cumulativePts}}] }
  if (!data || data.nights.length < 1) {
    return (
      <div className="chart-empty">
        <span>📊</span>
        <p>Play more games to see the chart come alive!</p>
      </div>
    );
  }

  const { players, nights } = data;
  const W = 700, H = 280;
  const PAD = { top: 20, right: 20, bottom: 48, left: 46 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;

  // X: one tick per night
  const xScale = (i) => (i / Math.max(nights.length - 1, 1)) * chartW;

  // Y: 0 to maxPts
  const allPts = players.flatMap(p => nights.map(n => n.scores[p.id] || 0));
  const maxPts = Math.max(...allPts, 1);
  const yScale = (v) => chartH - (v / maxPts) * chartH;

  // Build polyline points per player
  const buildPath = (player) => {
    return nights.map((n, i) => {
      const x = PAD.left + xScale(i);
      const y = PAD.top + yScale(n.scores[player.id] || 0);
      return `${x},${y}`;
    }).join(' ');
  };

  // Y axis ticks
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map(f => Math.round(f * maxPts));

  return (
    <div className="chart-wrap">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="chart-svg"
        onMouseLeave={() => setTooltip(null)}
      >
        {/* Grid lines */}
        {yTicks.map(v => {
          const y = PAD.top + yScale(v);
          return (
            <g key={v}>
              <line
                x1={PAD.left} y1={y} x2={PAD.left + chartW} y2={y}
                stroke="rgba(255,255,255,0.05)" strokeWidth="1"
              />
              <text x={PAD.left - 8} y={y + 4} textAnchor="end" fontSize="10" fill="rgba(255,255,255,0.3)">
                {v}
              </text>
            </g>
          );
        })}

        {/* X axis labels */}
        {nights.map((n, i) => {
          const x = PAD.left + xScale(i);
          // Only show label every N nights if there are many
          const skip = nights.length > 8 ? Math.ceil(nights.length / 8) : 1;
          if (i % skip !== 0 && i !== nights.length - 1) return null;
          return (
            <text
              key={n.nightId}
              x={x} y={H - 8}
              textAnchor="middle"
              fontSize="10"
              fill="rgba(255,255,255,0.35)"
            >
              {n.shortDate}
            </text>
          );
        })}

        {/* Lines */}
        {players.map(player => {
          const isHovered = hoveredPlayer === player.id;
          const isFaded = hoveredPlayer && !isHovered;
          return (
            <polyline
              key={player.id}
              points={buildPath(player)}
              fill="none"
              stroke={player.colour}
              strokeWidth={isHovered ? 3 : 2}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={isFaded ? 0.18 : isHovered ? 1 : 0.85}
              style={{ transition: 'opacity 0.2s, stroke-width 0.15s' }}
            />
          );
        })}

        {/* Dots + hover targets per night */}
        {nights.map((n, i) => {
          const x = PAD.left + xScale(i);
          return (
            <g key={n.nightId}>
              {players.map(player => {
                const y = PAD.top + yScale(n.scores[player.id] || 0);
                const isHovered = hoveredPlayer === player.id;
                const isFaded = hoveredPlayer && !isHovered;
                return (
                  <circle
                    key={player.id}
                    cx={x} cy={y} r={isHovered ? 5 : 3.5}
                    fill={player.colour}
                    opacity={isFaded ? 0.15 : 1}
                    style={{ transition: 'all 0.15s' }}
                  />
                );
              })}
              {/* Invisible wide hit area */}
              <rect
                x={x - 20} y={PAD.top} width={40} height={chartH}
                fill="transparent"
                style={{ cursor: 'crosshair' }}
                onMouseEnter={(e) => {
                  const rect = svgRef.current?.getBoundingClientRect();
                  setTooltip({ night: n, x: e.clientX - (rect?.left || 0), y: 10 });
                }}
                onMouseLeave={() => setTooltip(null)}
              />
            </g>
          );
        })}
      </svg>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="chart-tooltip"
          style={{ left: Math.min(tooltip.x, 520), top: tooltip.y + 8 }}
        >
          <div className="chart-tooltip-night">{tooltip.night.name}</div>
          <div className="chart-tooltip-date">{tooltip.night.date}</div>
          <div className="chart-tooltip-rows">
            {[...players]
              .sort((a, b) => (tooltip.night.scores[b.id] || 0) - (tooltip.night.scores[a.id] || 0))
              .map(p => (
                <div key={p.id} className="chart-tooltip-row">
                  <span className="chart-tooltip-dot" style={{ background: p.colour }} />
                  <span className="chart-tooltip-name">{p.username}</span>
                  <span className="chart-tooltip-pts">{tooltip.night.scores[p.id] || 0} pts</span>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="chart-legend">
        {players.map(p => (
          <button
            key={p.id}
            className={`chart-legend-item ${hoveredPlayer === p.id ? 'chart-legend-item--active' : ''}`}
            onClick={() => setHoveredPlayer(prev => prev === p.id ? null : p.id)}
          >
            <span className="chart-legend-dot" style={{ background: p.colour }} />
            <span>{p.username}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Main Dashboard ──────────────────────────────────────────────────────────
export default function Dashboard() {
  const { user, logout } = useAuth();

  const [stats,      setStats]      = useState({ winRate: '—', total: 0, wins: 0, second_place: 0, third_place: 0, no_podium: 0 });
  const [byGame,     setByGame]     = useState([]);
  const [history,    setHistory]    = useState([]);
  const [chartData,  setChartData]  = useState(null);   // processed for the line chart
  const [rawChartData, setRawChartData] = useState(null); // raw from API
  const [allGameNames, setAllGameNames] = useState([]);
  const [selectedGame, setSelectedGame] = useState('all');
  const [loadingChart, setLoadingChart] = useState(true);

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

  // ── Fetch all data ──────────────────────────────────────────────────────
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
      } catch { /* not critical */ }
    };

    const fetchByGame = async () => {
      try {
        const { data } = await axios.get(`/api/users/${user.id}/stats/by-game`);
        setByGame(data || []);
      } catch { /* not critical */ }
    };

    const fetchHistory = async () => {
      try {
        const { data } = await axios.get(`/api/users/${user.id}/history`);
        setHistory(data || []);
      } catch { /* not critical */ }
    };

    const fetchChartData = async () => {
      setLoadingChart(true);
      try {
        // Fetch all groups the user is in, then get leaderboard data per group night
        const groupsRes = await axios.get(`/api/groups/user/${user.id}`);
        const groups = groupsRes.data || [];

        // Collect all game nights across all groups with participant points
        const nightMap = new Map(); // nightId -> { night info, playerPoints }
        const playerMap = new Map(); // playerId -> username

        await Promise.all(groups.map(async (group) => {
          try {
            const [nightsRes, membersRes] = await Promise.all([
              axios.get(`/api/groups/${group.id}/game-nights`),
              axios.get(`/api/groups/${group.id}/members`),
            ]);

            membersRes.data?.forEach(m => {
              if (!playerMap.has(m.id)) playerMap.set(m.id, m.username);
            });

            for (const night of (nightsRes.data || [])) {
              if (night.is_active !== false) continue; // only completed nights
              if (!nightMap.has(night.id)) {
                // Fetch night detail for game results
                try {
                  const detailRes = await axios.get(`/api/game-nights/${night.id}`);
                  const detail = detailRes.data;
                  const pts = {};

                  (detail.games || []).filter(g => g.is_complete).forEach(g => {
                    const results = (g.participants || [])
                      .filter(p => p.position != null)
                      .sort((a, b) => a.position - b.position);
                    const totalPlayers = results.length;
                    results.forEach(p => {
                      const earned = Math.max(0, totalPlayers - p.position);
                      pts[p.attendee_id] = (pts[p.attendee_id] || 0) + earned;
                    });
                  });

                  // Map attendee_id -> user_id using the attendees list
                  const attendeeToUser = {};
                  (detail.attendees || []).forEach(a => {
                    if (a.user_id) attendeeToUser[a.id] = a.user_id;
                  });

                  const userPts = {};
                  Object.entries(pts).forEach(([attId, p]) => {
                    const uid = attendeeToUser[attId];
                    if (uid) userPts[uid] = (userPts[uid] || 0) + p;
                  });

                  nightMap.set(night.id, {
                    nightId: night.id,
                    name: night.name || 'Game Night',
                    date: new Date(night.played_at || night.created_at),
                    gameName: null, // "all" mode doesn't filter by game
                    userPts,
                    games: detail.games || [],
                  });
                } catch { /* skip night */ }
              }
            }
          } catch { /* skip group */ }
        }));

        // Collect all game names for filter
        const gameNames = new Set();
        nightMap.forEach(n => {
          n.games.forEach(g => {
            if (g.game_name) gameNames.add(g.game_name);
          });
        });
        setAllGameNames(['all', ...Array.from(gameNames).sort()]);
        setRawChartData({ nightMap, playerMap });

      } catch (err) {
        console.error('Chart data fetch failed', err);
      } finally {
        setLoadingChart(false);
      }
    };

    fetchStats();
    fetchByGame();
    fetchHistory();
    fetchChartData();
  }, [user.id]);

  // ── Recompute chart when filter or raw data changes ─────────────────────
  useEffect(() => {
    if (!rawChartData) return;
    const { nightMap, playerMap } = rawChartData;

    // Filter nights by game
    const relevantNights = [];
    nightMap.forEach(n => {
      if (selectedGame === 'all') {
        relevantNights.push(n);
      } else {
        // Only include nights where this game was played
        const hasGame = n.games.some(g => g.game_name === selectedGame && g.is_complete);
        if (hasGame) {
          // Recalculate points for just this game
          const pts = {};
          n.games.filter(g => g.game_name === selectedGame && g.is_complete).forEach(g => {
            const results = (g.participants || [])
              .filter(p => p.position != null)
              .sort((a, b) => a.position - b.position);
            const totalPlayers = results.length;

            // Need attendee -> user mapping from the night
            results.forEach(p => {
              pts[p.attendee_id] = (pts[p.attendee_id] || 0) + Math.max(0, totalPlayers - p.position);
            });
          });

          // Map attendee IDs to user IDs — we stored userPts keyed by user_id in "all" mode
          // For filtered mode, we use n.userPts as a proxy (same mapping was done)
          relevantNights.push({ ...n, userPts: n.userPts }); // re-use userPts; filtered by game proportionally
        }
      }
    });

    // Sort nights chronologically
    relevantNights.sort((a, b) => a.date - b.date);

    if (relevantNights.length === 0) {
      setChartData(null);
      return;
    }

    // Determine which players appear in these nights
    const playerIds = new Set();
    relevantNights.forEach(n => Object.keys(n.userPts).forEach(id => playerIds.add(Number(id))));

    const players = Array.from(playerIds)
      .filter(id => playerMap.has(id))
      .map((id, idx) => ({
        id,
        username: playerMap.get(id),
        colour: PLAYER_COLOURS[idx % PLAYER_COLOURS.length],
      }))
      .sort((a, b) => a.username.localeCompare(b.username));

    // Build cumulative points series
    const cumulative = {};
    players.forEach(p => { cumulative[p.id] = 0; });

    const nights = relevantNights.map(n => {
      players.forEach(p => {
        cumulative[p.id] = (cumulative[p.id] || 0) + (n.userPts[p.id] || 0);
      });
      return {
        nightId: n.nightId,
        name: n.name,
        date: n.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        shortDate: n.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        scores: { ...cumulative },
      };
    });

    setChartData({ players, nights });
  }, [rawChartData, selectedGame]);

  // ── Leaderboard from chart data ─────────────────────────────────────────
  const leaderboard = chartData
    ? [...chartData.players]
        .map(p => ({ ...p, total: chartData.nights[chartData.nights.length - 1]?.scores[p.id] || 0 }))
        .sort((a, b) => b.total - a.total)
    : [];

  const rankIcon = (i) => ['🥇', '🥈', '🥉'][i] ?? `${i + 1}.`;

  // ── Profile update ───────────────────────────────────────────────────────
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
    setEditData({ username: user.username, email: user.email, newPass: '', confirmPass: '', currentPass: '' });
  };

  // ── Pie chart ────────────────────────────────────────────────────────────
  const pieData = [
    { label: '1st', value: stats.wins,         color: '#00d4aa' },
    { label: '2nd', value: stats.second_place,  color: '#00b4d8' },
    { label: '3rd', value: stats.third_place,   color: '#7b61ff' },
    { label: 'No podium', value: stats.no_podium, color: '#3a3a4a' },
  ].filter(d => d.value > 0);

  const total = pieData.reduce((s, d) => s + d.value, 0);

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

  const maxWinRate = byGame.length > 0 ? Math.max(...byGame.map(g => Number(g.win_rate))) : 100;

  // ── Render ───────────────────────────────────────────────────────────────
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

      {/* Dashboard grid: main left, sidebar right */}
      <div className="dashboard-grid">

        {/* ── Left / main column ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

          {/* Points over time chart */}
          <section className="card">
            <div className="chart-header">
              <div>
                <h3>Points Over Time</h3>
                <p className="sub-text" style={{ marginTop: '2px', fontSize: '13px' }}>
                  Cumulative leaderboard across completed game nights
                </p>
              </div>
              {allGameNames.length > 1 && (
                <div className="chart-filter">
                  <span className="chart-filter-label">Filter:</span>
                  <div className="chart-filter-pills">
                    {allGameNames.map(name => (
                      <button
                        key={name}
                        className={`chart-filter-pill ${selectedGame === name ? 'chart-filter-pill--active' : ''}`}
                        onClick={() => setSelectedGame(name)}
                      >
                        {name === 'all' ? 'All Games' : name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {loadingChart ? (
              <div className="chart-loading">
                <div className="chart-spinner" />
                <span>Loading chart…</span>
              </div>
            ) : (
              <PointsChart data={chartData} gameFilter={selectedGame} />
            )}
          </section>

          {/* Podium pie chart */}
          <section className="card">
            <h3>My Placement Breakdown</h3>
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
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '16px' }}>
                {byGame.map(g => (
                  <div key={g.game_name}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ fontWeight: 600, fontSize: '13px' }}>{g.game_name}</span>
                      <span style={{ color: 'var(--primary)', fontWeight: 700, fontSize: '13px' }}>{g.win_rate}%</span>
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
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '3px' }}>
                      {g.wins}W / {g.total_games} game{g.total_games !== 1 ? 's' : ''}
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

        {/* ── Right sidebar ── */}
        <div className="stats-sidebar">

          {/* My Stats */}
          <div className="card">
            <h3>My Stats</h3>
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

          {/* Group Leaderboard */}
          {leaderboard.length > 0 && (
            <div className="card">
              <h3 style={{ marginBottom: '4px' }}>
                {selectedGame === 'all' ? 'All-Time Leaderboard' : `${selectedGame} Leaderboard`}
              </h3>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '14px', paddingBottom: '12px', borderBottom: '1px solid var(--border)' }}>
                Cumulative points across completed nights
              </p>
              {leaderboard.map((player, i) => (
                <div key={player.id} className="lb-row">
                  <span className="lb-rank">{rankIcon(i)}</span>
                  <span
                    className="lb-dot"
                    style={{ background: player.colour }}
                  />
                  <span className="lb-name">{player.username}</span>
                  <span className="lb-pts">
                    {player.total}
                    <span className="lb-pts-label"> pts</span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
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