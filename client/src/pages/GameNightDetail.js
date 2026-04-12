import React, { useState, useEffect, useCallback, useMemo } from 'react';
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

  const [endingNight, setEndingNight] = useState(false);
  const [showEndConfirm, setShowEndConfirm] = useState(false);

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

        const attendeeMap = {};
        (data.attendees || []).forEach(a => {
          attendeeMap[a.id] = a.username || a.guest_name || 'Unknown';
        });

        const hydratedWidgets = (data.games || []).map(g => {
          const results = (g.participants || [])
            .filter(p => p.position != null)
            .sort((a, b) => a.position - b.position);

          // Compute totals from rounds for cumulative/scores games
          // rounds rows: { attendee_id, score, round_number, ... }
          const roundTotals = {};
          if (g.rounds?.length > 0) {
            g.rounds.forEach(row => {
              const aid = row.attendee_id;
              roundTotals[aid] = (roundTotals[aid] || 0) + Number(row.score || 0);
            });
          }

          const completedResults = results.map(r => ({
            id:       r.attendee_id,
            name:     attendeeMap[r.attendee_id] || 'Unknown',
            position: r.position,
            score:    roundTotals[r.attendee_id] ?? null,
          }));

          return {
            id:              `db-${g.id}`,
            gameId:          g.id,
            nightId,
            name:            g.game_name,
            type:            g.game_type === 'winner_order' ? 'positions' : g.game_type === 'scores' ? 'scores' : 'cumulative',
            higherIsBetter:  g.higher_is_better ?? true,
            players:         completedResults.map(r => ({ id: r.id, name: r.name })),
            completedResults,
            completed:       g.is_complete,
          };
        });

        setWidgets(hydratedWidgets.reverse());
      } catch {
        toast.error('Failed to load game night');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [nightId]);

  const isNightActive = night?.is_active !== false; // treat null/undefined as active

  const handleEndNight = async () => {
    setEndingNight(true);
    try {
      await axios.put(`/api/game-nights/${nightId}/end`);
      setNight(prev => ({ ...prev, is_active: false }));
      setShowEndConfirm(false);
      toast.success('Game night ended — results are now locked 🔒');
    } catch {
      toast.error('Failed to end game night');
    } finally {
      setEndingNight(false);
    }
  };

  const addWidget = () => {
    const id = `new-${widgetCounter}`;
    setWidgetCounter(n => n + 1);
    setWidgets(prev => [
      { id, gameId: null, nightId, name: '', type: null, players: [], completed: false },
      ...prev,
    ]);
  };

  const handleNameResolved = useCallback((widgetId, resolvedName) => {
    setWidgets(prev =>
      prev.map(w => w.id === widgetId ? { ...w, name: resolvedName } : w)
    );
  }, []);

  const handleComplete = useCallback((widgetId, serverData) => {
    setWidgets(prev =>
      prev.map(w => {
        if (w.id === widgetId) {
          return { 
            ...w, 
            // 1. Swap temporary ID for DB ID so 'null' error disappears
            id: `db-${serverData.id}`, 
            gameId: serverData.id,
            // 2. Use the results we passed up
            results: serverData.results,
            completed: true 
          };
        }
        return w;
      })
    );

  }, []);

  const handleRemove = useCallback((widgetId) => {
    setWidgets(prev => prev.filter(w => w.id !== widgetId));
  }, []);

  // ── Targeted sync: fetch a single game from the DB and update its widget ──
  // Called by GameWidget after any mutating API call (configure / mark done).
  // This is the fix for stale IDs and empty edit views without a full reload.
  const syncWidget = useCallback(async (tempWidgetId, gamePlayedId) => {
    if (!gamePlayedId) return;
    try {
      const { data } = await axios.get(`/api/game-nights/${nightId}/games/${gamePlayedId}`);

      // Re-use existing attendees already in state — no extra fetch needed
      setWidgets(prev => {
        return prev.map(w => {
          if (w.id !== tempWidgetId && w.id !== `db-${gamePlayedId}`) return w;

          const results = (data.participants || [])
            .filter(p => p.position != null)
            .sort((a, b) => a.position - b.position);

          const roundTotals = {};
          if (data.rounds?.length > 0) {
            data.rounds.forEach(row => {
              const aid = row.attendee_id;
              roundTotals[aid] = (roundTotals[aid] || 0) + Number(row.score || 0);
            });
          }

          const completedResults = results.map(r => ({
            id:       r.attendee_id,
            name:     r.name || 'Unknown',
            position: r.position,
            score:    roundTotals[r.attendee_id] ?? null,
          }));

          return {
            ...w,
            id:              `db-${gamePlayedId}`,
            gameId:          gamePlayedId,
            name:            data.game_name,
            type:            data.game_type === 'winner_order' ? 'positions' : data.game_type === 'scores' ? 'scores' : 'cumulative',
            higherIsBetter:  data.higher_is_better ?? true,
            players:         (data.participants || []).map(p => ({
              id:   p.attendee_id,
              name: p.name || 'Unknown',
              type: p.user_id ? 'user' : 'guest',
            })),
            completedResults: data.is_complete ? completedResults : w.completedResults,
            completed:        data.is_complete,
            // Only overwrite rounds from DB if the game is complete — while in progress
            // the DB rounds are empty and we must keep the widget's local round state.
            rounds:           data.is_complete ? (data.rounds || []) : w.rounds,
          };
        });
      });
    } catch {
      // Sync failure is non-fatal — the widget still works from local state.
      // The user can refresh if they see stale data.
      console.warn(`syncWidget failed for gamePlayedId=${gamePlayedId}`);
    }
  }, [nightId]);

  // Derive points from completed widgets — automatically stays in sync with
  // any widget change (complete, delete, reopen) without manual setPointsMap calls.
  const pointsMap = useMemo(() => {
    const pts = {};
    widgets.forEach(w => {
      if (!w.completed || !w.completedResults?.length) return;
      const totalPlayers = w.completedResults.length;
      w.completedResults.forEach(r => {
        const earned = Math.max(0, totalPlayers - r.position);
        pts[r.id] = (pts[r.id] || 0) + earned;
      });
    });
    return pts;
  }, [widgets]);

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
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h1 className="gnd-title">{night?.name ?? 'Game Night'}</h1>
            {!isNightActive && (
              <span className="gnd-ended-badge">🔒 Ended</span>
            )}
          </div>
          <p className="gnd-meta">{dateStr} · {attendees.length} players</p>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          {isNightActive && (
            <>
              <button
                className="btn btn-ghost"
                style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }}
                onClick={() => setShowEndConfirm(true)}
              >
                🔒 End Night
              </button>
              <button className="btn btn-primary gnd-add-btn" onClick={addWidget}>+ Add Game</button>
            </>
          )}
        </div>
      </header>

      {/* End night confirmation modal */}
      {showEndConfirm && (
        <div className="gnd-modal-overlay" onClick={() => setShowEndConfirm(false)}>
          <div className="card" style={{ maxWidth: 420, width: '100%', padding: '28px' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ marginBottom: '8px' }}>End Game Night?</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '24px' }}>
              This will lock all scores and results. No further changes can be made. Any in-progress games will be left incomplete.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button className="btn btn-ghost" onClick={() => setShowEndConfirm(false)}>Cancel</button>
              <button className="btn btn-danger" onClick={handleEndNight} disabled={endingNight}>
                {endingNight ? 'Ending…' : 'Yes, End Night'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="gnd-grid">
        <main className="gnd-main">

          {activeWidgets.length > 0 && (
            <section className="gnd-section">
              <h4 className="gnd-section-label">In Progress · {activeWidgets.length}</h4>
              <div className="gnd-widgets">
                {activeWidgets.map(w => (
                  <GameWidget
                    key={w.gameId ?? w.id}
                    widget={w}
                    attendees={attendees}
                    onComplete={handleComplete}
                    onRemove={handleRemove}
                    onNameResolved={handleNameResolved}
                    onSync={syncWidget}
                    readOnly={!isNightActive}
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
                    key={w.gameId ?? w.id}
                    widget={w}
                    attendees={attendees}
                    onComplete={handleComplete}
                    onRemove={handleRemove}
                    onNameResolved={handleNameResolved}
                    onSync={syncWidget}
                    readOnly={!isNightActive}
                  />
                ))}
              </div>
            </section>
          )}

          {widgets.length === 0 && (
            <div className="gnd-empty">
              <span className="gnd-empty-icon">🎲</span>
              <h3>No games yet</h3>
              {isNightActive ? (
                <>
                  <p>Hit "+ Add Game" to start tracking your first game of the night.</p>
                  <button className="btn btn-primary" style={{ marginTop: '20px' }} onClick={addWidget}>
                    + Add First Game
                  </button>
                </>
              ) : (
                <p>This game night has ended with no games recorded.</p>
              )}
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