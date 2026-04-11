import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import GameWidget from '../components/GameWidget';
import './GameNightDetail.css';

export default function GameNightDetail() {
  const { nightId } = useParams();

  const [night,     setNight]     = useState(null);
  const [attendees, setAttendees] = useState([]);  // [{ id, name, type, userId }]
  const [loading,   setLoading]   = useState(true);

  // Widgets: each represents one game being tracked (active or done)
  const [widgets,       setWidgets]       = useState([]);
  const [widgetCounter, setWidgetCounter] = useState(1);

  // Per-widget win tracking (updated when a widget calls onComplete)
  const [winsMap, setWinsMap] = useState({});  // { attendeeId: count }

  // ── Fetch night data ────────────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await axios.get(`/api/game-nights/${nightId}`);
        setNight(data.night);

        // Normalise attendees to a common shape
        const normalised = (data.attendees || []).map(a => ({
          id:     a.id,
          name:   a.username || a.guest_name || 'Unknown',
          type:   a.username ? 'user' : 'guest',
          userId: a.user_id ?? null,
        }));
        setAttendees(normalised);

        // Hydrate any already-completed games from the DB
        if (data.games?.length) {
          const existing = data.games.map((g, i) => ({
            id:        `db-${g.id}`,
            gameId:    g.id,
            nightId,
            name:      g.game_name,
            type:      g.game_type === 'winner_order' ? 'positions' : 'cumulative',
            players:   [], // could be enriched from g.participants if your API returns them
            completed: true,
          }));
          setWidgets(existing);
        }
      } catch {
        toast.error('Failed to load game night');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [nightId]);

  // ── Add a blank widget ──────────────────────────────────────────────────
  const addWidget = () => {
    const id = `new-${widgetCounter}`;
    setWidgetCounter(n => n + 1);
    setWidgets(prev => [
      ...prev,
      { id, gameId: null, nightId, name: '', type: null, players: [], completed: false },
    ]);
  };

  // ── Handle a widget completing ──────────────────────────────────────────
  const handleComplete = useCallback((widgetId, winnerId) => {
    setWidgets(prev =>
      prev.map(w => w.id === widgetId ? { ...w, completed: true } : w)
    );
    if (winnerId) {
      setWinsMap(prev => ({ ...prev, [winnerId]: (prev[winnerId] || 0) + 1 }));
    }
  }, []);

  // ── Handle removing an unconfigured widget ──────────────────────────────
  const handleRemove = useCallback((widgetId) => {
    setWidgets(prev => prev.filter(w => w.id !== widgetId));
  }, []);

  // ── Leaderboard (sorted by wins tracked this session) ──────────────────
  const leaderboard = [...attendees].sort(
    (a, b) => (winsMap[b.id] || 0) - (winsMap[a.id] || 0)
  );

  const rankIcon = (i) => ['🥇', '🥈', '🥉'][i] ?? `${i + 1}.`;

  // ── Derived lists ───────────────────────────────────────────────────────
  const activeWidgets = widgets.filter(w => !w.completed);
  const doneWidgets   = widgets.filter(w =>  w.completed);

  // ── Render ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="page gnd-loading">
        <div className="gnd-spinner" />
        <p>Loading game night…</p>
      </div>
    );
  }

  const playedAt = night?.played_at || night?.created_at;
  const dateStr  = playedAt
    ? new Date(playedAt).toLocaleDateString('en-US', {
        weekday: 'long', month: 'long', day: 'numeric',
      })
    : '';

  return (
    <div className="page gnd-page">

      {/* ── Page header ── */}
      <header className="gnd-header">
        <div className="gnd-header-left">
          <Link to="/groups" className="gnd-back-link">← Back to Groups</Link>
          <h1 className="gnd-title">{night?.name ?? 'Game Night'}</h1>
          <p className="gnd-meta">{dateStr} · {attendees.length} players</p>
        </div>
        <button className="btn btn-primary gnd-add-btn" onClick={addWidget}>
          + Add Game
        </button>
      </header>

      {/* ── Main grid ── */}
      <div className="gnd-grid">

        {/* Left: game widgets */}
        <main className="gnd-main">

          {activeWidgets.length > 0 && (
            <section className="gnd-section">
              <h4 className="gnd-section-label">In Progress · {activeWidgets.length}</h4>
              <div className="gnd-widgets">
                {activeWidgets.map(w => (
                  <GameWidget
                    key={w.id}
                    widget={w}
                    attendees={attendees}
                    onComplete={handleComplete}
                    onRemove={handleRemove}
                  />
                ))}
              </div>
            </section>
          )}

          {doneWidgets.length > 0 && (
            <section className="gnd-section">
              <h4 className="gnd-section-label">Completed · {doneWidgets.length}</h4>
              <div className="gnd-widgets">
                {doneWidgets.map(w => (
                  <GameWidget
                    key={w.id}
                    widget={w}
                    attendees={attendees}
                    onComplete={handleComplete}
                    onRemove={handleRemove}
                  />
                ))}
              </div>
            </section>
          )}

          {widgets.length === 0 && (
            <div className="gnd-empty">
              <span className="gnd-empty-icon">🎲</span>
              <h3>No games yet</h3>
              <p>Hit "+ Add Game" to start tracking your first game of the night.</p>
              <button className="btn btn-primary" style={{ marginTop: '20px' }} onClick={addWidget}>
                + Add First Game
              </button>
            </div>
          )}
        </main>

        {/* Right: sidebar */}
        <aside className="gnd-sidebar">

          {/* Tonight's Leaderboard */}
          <div className="card gnd-sidebar-card">
            <h3 className="gnd-sidebar-title">Tonight's Leaderboard</h3>
            {leaderboard.map((player, i) => (
              <div key={player.id} className="gnd-lb-row">
                <span className="gnd-lb-rank">{rankIcon(i)}</span>
                <span className="gnd-lb-name">{player.name}</span>
                <span className="gnd-lb-wins">
                  {winsMap[player.id] ?? 0}W
                </span>
              </div>
            ))}
            {attendees.length === 0 && (
              <p className="gnd-sidebar-empty">No players yet</p>
            )}
          </div>

          {/* Attendees */}
          <div className="card gnd-sidebar-card">
            <h3 className="gnd-sidebar-title">Attendees</h3>
            {attendees.map(a => (
              <div key={a.id} className="gnd-attendee-row">
                <span className="gnd-attendee-dot" />
                <span className="gnd-attendee-name">{a.name}</span>
                {a.type === 'guest' && <span className="gnd-guest-pill">Guest</span>}
              </div>
            ))}
          </div>

          {/* Games summary */}
          <div className="card gnd-sidebar-card">
            <h3 className="gnd-sidebar-title">Games Tonight</h3>
            <div className="gnd-games-summary">
              <div className="gnd-summary-stat">
                <strong>{widgets.length}</strong>
                <span>Total</span>
              </div>
              <div className="gnd-summary-stat">
                <strong>{activeWidgets.length}</strong>
                <span>Active</span>
              </div>
              <div className="gnd-summary-stat">
                <strong>{doneWidgets.length}</strong>
                <span>Done</span>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
