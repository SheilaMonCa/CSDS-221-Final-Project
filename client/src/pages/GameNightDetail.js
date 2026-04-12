import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import GameWidget from '../components/GameWidget';
import './GameNightDetail.css';

export default function GameNightDetail() {
  const { nightId } = useParams();

  const [night,     setNight]     = useState(null);
  const [attendees, setAttendees] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [widgets,   setWidgets]   = useState([]);
  const [widgetCounter, setWidgetCounter] = useState(1);
  const [pointsMap, setPointsMap] = useState({});   // { attendeeId: cumulativePoints }

  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await axios.get(`/api/game-nights/${nightId}`);
        setNight(data.night);

        const normalised = (data.attendees || []).map(a => ({
          id:     a.id,
          name:   a.username || a.guest_name || 'Unknown',
          type:   a.username ? 'user' : 'guest',
          userId: a.user_id ?? null,
        }));
        setAttendees(normalised);

        // Build attendee id→name map for result hydration
        const attendeeMap = {};
        (data.attendees || []).forEach(a => {
          attendeeMap[a.id] = a.username || a.guest_name || 'Unknown';
        });

        const pts = {};

        const hydratedWidgets = (data.games || []).map(g => {
          const results = (g.participants || [])
            .filter(p => p.position != null)
            .sort((a, b) => a.position - b.position);

          const totalPlayers = results.length;

          results.forEach(p => {
            const earned = Math.max(0, totalPlayers - p.position);
            pts[p.attendee_id] = (pts[p.attendee_id] || 0) + earned;
          });

          const completedResults = results.map(r => ({
            id:       r.attendee_id,
            name:     attendeeMap[r.attendee_id] || 'Unknown',
            position: r.position,
            score:    r.score ?? null,
          }));

          return {
            id:              `db-${g.id}`,
            gameId:          g.id,
            nightId,
            name:            g.game_name,
            type:            g.game_type === 'winner_order' ? 'positions' : 'cumulative',
            players:         completedResults.map(r => ({ id: r.id, name: r.name })),
            completedResults,
            completed:       g.is_complete,
          };
        });

        // Newest first
        setWidgets(hydratedWidgets.reverse());
        setPointsMap(pts);
      } catch {
        toast.error('Failed to load game night');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [nightId]);

  const addWidget = () => {
    const id = `new-${widgetCounter}`;
    setWidgetCounter(n => n + 1);
    setWidgets(prev => [
      { id, gameId: null, nightId, name: '', type: null, players: [], completed: false },
      ...prev,
    ]);
  };

  // Called by widget when configure succeeds — updates the label in parent state immediately
  const handleNameResolved = useCallback((widgetId, resolvedName) => {
    setWidgets(prev =>
      prev.map(w => w.id === widgetId ? { ...w, name: resolvedName } : w)
    );
  }, []);

  // Called by widget when mark-done succeeds
  // results = [{id: attendeeId, name, position, score?}]
  const handleComplete = useCallback((widgetId, results) => {
    const totalPlayers = results.length;
    setWidgets(prev =>
      prev.map(w => w.id === widgetId ? { ...w, completed: true, completedResults: results } : w)
    );
    setPointsMap(prev => {
      const next = { ...prev };
      results.forEach(r => {
        const earned = Math.max(0, totalPlayers - r.position);
        next[r.id] = (next[r.id] || 0) + earned;
      });
      return next;
    });
  }, []);

  const handleRemove = useCallback((widgetId) => {
    setWidgets(prev => prev.filter(w => w.id !== widgetId));
  }, []);

  // Leaderboard: all attendees, sorted by cumulative points this night
  const leaderboard = [...attendees]
    .map(a => ({ ...a, points: pointsMap[a.id] || 0 }))
    .sort((a, b) => b.points - a.points);

  const rankIcon = (i) => ['🥇', '🥈', '🥉'][i] ?? `${i + 1}.`;

  const activeWidgets = widgets.filter(w => !w.completed);
  const doneWidgets   = widgets.filter(w =>  w.completed);

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
    ? new Date(playedAt).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
    : '';

  return (
    <div className="page gnd-page">

      <header className="gnd-header">
        <div className="gnd-header-left">
          <Link to="/groups" className="gnd-back-link">← Back to Groups</Link>
          <h1 className="gnd-title">{night?.name ?? 'Game Night'}</h1>
          <p className="gnd-meta">{dateStr} · {attendees.length} players</p>
        </div>
        <button className="btn btn-primary gnd-add-btn" onClick={addWidget}>+ Add Game</button>
      </header>

      <div className="gnd-grid">
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
                    onNameResolved={handleNameResolved}
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
                    onNameResolved={handleNameResolved}
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

        <aside className="gnd-sidebar">
          <div className="card gnd-sidebar-card">
            <h3 className="gnd-sidebar-title">Tonight's Leaderboard</h3>
            {leaderboard.length === 0 ? (
              <p className="gnd-sidebar-empty">No players yet</p>
            ) : leaderboard.map((player, i) => (
              <div key={player.id} className="gnd-lb-row">
                <span className="gnd-lb-rank">{rankIcon(i)}</span>
                <span className="gnd-lb-name">
                  {player.name}
                  {player.type === 'guest' && <span className="gnd-guest-pill">G</span>}
                </span>
                <span className="gnd-lb-wins">
                  {player.points}
                  <span style={{ fontWeight: 400, fontSize: '11px', color: 'var(--text-muted)', marginLeft: '2px' }}>pts</span>
                </span>
              </div>
            ))}
          </div>

          <div className="card gnd-sidebar-card">
            <h3 className="gnd-sidebar-title">Games Tonight</h3>
            <div className="gnd-games-summary">
              <div className="gnd-summary-stat">
                <strong>{widgets.length}</strong><span>Total</span>
              </div>
              <div className="gnd-summary-stat">
                <strong>{activeWidgets.length}</strong><span>Active</span>
              </div>
              <div className="gnd-summary-stat">
                <strong>{doneWidgets.length}</strong><span>Done</span>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
