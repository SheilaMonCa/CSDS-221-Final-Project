import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import './GameWidget.css';

/** Inline confirmation modal — replaces window.confirm */
function ConfirmModal({ title, message, confirmLabel = 'Confirm', danger = true, onConfirm, onCancel }) {
  return (
    <div className="gw-confirm-overlay" onClick={onCancel}>
      <div className="gw-confirm-modal card" onClick={e => e.stopPropagation()}>
        <h3 className="gw-confirm-title">{title}</h3>
        <p className="gw-confirm-msg">{message}</p>
        <div className="gw-confirm-footer">
          <button className="btn btn-ghost" onClick={onCancel}>Cancel</button>
          <button
            className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function GameWidget({ widget, attendees, onComplete, onRemove, onNameResolved, onSync, readOnly = false }) {
  const [gameName,   setGameName]   = useState(widget.name || '');
  const [gameType,   setGameType]   = useState(widget.type || null);
  const [players,    setPlayers]    = useState(widget.players?.length ? widget.players : []);
  const [configured, setConfigured] = useState(widget.completed || !!widget.gameId);
  const [completed,  setCompleted]  = useState(widget.completed || false);
  const [saving,     setSaving]     = useState(false);
  const [expanded,   setExpanded]   = useState(false);
  const [completedResults, setCompletedResults] = useState(widget.completedResults || []);

  // Custom confirm modal state
  const [confirmState, setConfirmState] = useState(null); // { title, message, confirmLabel, danger, onConfirm }

  const showConfirm = (opts) => new Promise(resolve => {
    setConfirmState({
      ...opts,
      onConfirm: () => { setConfirmState(null); resolve(true); },
      onCancel:  () => { setConfirmState(null); resolve(false); },
    });
  });

  // Restore higher_is_better from DB-hydrated widget (fixes Bug 4: lost on reload)
  const [higherIsBetter, setHigherIsBetter] = useState(
    widget.higherIsBetter !== undefined ? widget.higherIsBetter : true
  );

  // ── gameId as state (not a ref) so it's always current ──────────────────
  // useRef only initialises once; for DB-hydrated widgets widget.gameId is
  // already set on first render, so state is the safe choice here.
  const [gameId, setGameId] = useState(widget.gameId || null);

  // Keep completedResults in sync when parent pushes a syncWidget update.
  // useState only initialises once from props — this effect catches subsequent updates.
  useEffect(() => {
    if (widget.completedResults?.length > 0) {
      setCompletedResults(widget.completedResults);
    }
  }, [widget.completedResults]);

  // ── Autocomplete ──────────────────────────────────────────────────────────
  const [allGames, setAllGames]           = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const nameInputRef = useRef(null);

  useEffect(() => {
    axios.get('/api/games').then(r => setAllGames(r.data || [])).catch(() => {});
  }, []);

  const suggestions = allGames
    .filter(g =>
      gameName.trim().length > 0 &&
      g.name.toLowerCase().includes(gameName.trim().toLowerCase()) &&
      g.name.toLowerCase() !== gameName.trim().toLowerCase()
    )
    .slice(0, 6);

  // ── Positions ─────────────────────────────────────────────────────────────
  const [positionInputs, setPositionInputs] = useState({});

  useEffect(() => {
    setPositionInputs(prev => {
      const next = {};
      players.forEach((p, i) => {
        next[p.id] = prev[p.id] ?? String(i + 1);
      });
      return next;
    });
  }, [players]);

  const validatePositions = () => {
    const n = players.length;
    const vals = players.map(p => parseInt(positionInputs[p.id], 10));
    if (vals.some(isNaN)) return 'Every player needs a position number';
    if (vals.some(v => v < 1 || v > n)) return `Positions must be between 1 and ${n}`;
    if (new Set(vals).size !== n) return 'Each position must be unique — no ties or duplicates';
    return null;
  };

  // ── Cumulative rounds ─────────────────────────────────────────────────────
  // Initialise with one empty round when the widget is already configured and
  // active (i.e. it just remounted after the parent swapped its key from
  // "new-X" → "db-Y" following the onSync call in handleConfigure).
  // Without this the first row flickers in then disappears on remount.
  const [rounds, setRounds] = useState(() => {
    if (widget.rounds?.length > 0) return widget.rounds;
    const isScoreType = widget.type === 'cumulative' || widget.type === 'scores';
    if (isScoreType && widget.gameId && !widget.completed) {
      const pList = widget.players ?? [];
      if (pList.length > 0) {
        const r = {};
        pList.forEach(p => { r[p.id] = ''; });
        return [r];
      }
    }
    return [];
  });

  const makeEmptyRound = (pList) => {
    const r = {};
    pList.forEach(p => { r[p.id] = ''; });
    return r;
  };

  const addRound    = () => setRounds(prev => [...prev, makeEmptyRound(players)]);
  const updateRound = (ri, pid, val) =>
    setRounds(prev => prev.map((r, i) => i === ri ? { ...r, [pid]: val } : r));

  const getTotals = () => {
    const t = {};
    players.forEach(p => {
      t[p.id] = rounds.reduce((sum, r) => sum + (parseFloat(r[p.id]) || 0), 0);
    });
    return t;
  };

  // ── Player toggling ───────────────────────────────────────────────────────
  const togglePlayer = (attendee) => {
    setPlayers(prev => {
      const exists = prev.find(p => p.id === attendee.id);
      if (exists) {
        const next = prev.filter(p => p.id !== attendee.id);
        return next;
      }
      return [...prev, attendee];
    });
  };

  // ── Delete ────────────────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!gameId) {
      onRemove(widget.id);
      return;
    }
    const confirmed = await showConfirm({
      title: `Delete "${gameName || 'this game'}"?`,
      message: 'This will permanently remove this game and all its results. This cannot be undone.',
      confirmLabel: 'Delete Game',
      danger: true,
    });
    if (!confirmed) return;

    setSaving(true);
    try {
      await axios.delete(`/api/game-nights/${widget.nightId}/games/${gameId}`);
      onRemove(widget.id);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to delete game');
    } finally {
      setSaving(false);
    }
  };

  // ── Reopen ────────────────────────────────────────────────────────────────
  const handleReopen = async () => {
    setSaving(true);
    try {
      // 1. Fetch existing data BEFORE wiping so we can pre-populate state
      let prefillRounds = [];
      let prefillPositions = {};

      if (gameType === 'cumulative' || gameType === 'scores') {
        try {
          const { data } = await axios.get(`/api/game-nights/${widget.nightId}/games/${gameId}`);
          if (data.rounds?.length > 0) {
            // Group flat rows { round_number, attendee_id, score } into per-round objects
            const roundMap = {};
            data.rounds.forEach(row => {
              const rn = row.round_number;
              if (!roundMap[rn]) roundMap[rn] = makeEmptyRound(players);
              roundMap[rn][row.attendee_id] = String(row.score ?? '');
            });
            prefillRounds = Object.keys(roundMap)
              .sort((a, b) => Number(a) - Number(b))
              .map(rn => roundMap[rn]);
          }
        } catch {
          // Non-fatal — fall back to one empty round below
        }
        if (prefillRounds.length === 0) prefillRounds = [makeEmptyRound(players)];
      } else {
        // Positions game — restore finishing positions from completedResults already in state
        prefillPositions = completedResults.length > 0
          ? Object.fromEntries(completedResults.map(r => [r.id, String(r.position)]))
          : Object.fromEntries(players.map((p, i) => [p.id, String(i + 1)]));
      }

      // 2. Wipe DB results so re-submission is clean
      await axios.put(`/api/game-nights/${widget.nightId}/games/${gameId}/reopen`);

      // 3. Restore local state with pre-filled values
      setCompleted(false);
      setCompletedResults([]);
      setRounds(prefillRounds);
      setPositionInputs(prefillPositions);
      toast.success('Edit mode — your previous scores are pre-filled');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to reopen game');
    } finally {
      setSaving(false);
    }
  };

  const handleConfigure = async () => {
    if (!gameName.trim())   { toast.error('Enter a game name'); return; }
    if (!gameType)          { toast.error('Choose a game type'); return; }
    if (players.length < 2) { toast.error('Select at least 2 players'); return; }

    setSaving(true);
    try {
      const gameRes = await axios.post('/api/games', { name: gameName.trim() });
      const game_id = gameRes.data?.id;
      if (!game_id) throw new Error('Could not resolve game ID');

      const { data } = await axios.post(`/api/game-nights/${widget.nightId}/games`, {
        game_id,
        game_type:       gameType === 'positions' ? 'winner_order' : 'cumulative',
        is_complete:     false,
        higher_is_better: higherIsBetter,
        participants:    players.map((p, i) => ({ attendee_id: p.id, position: i + 1 })),
      });

      setGameId(data.games_played_id);
      onNameResolved?.(widget.id, gameName.trim());
      setConfigured(true);
      if (gameType === 'cumulative' || gameType === 'scores') {
        setRounds([makeEmptyRound(players)]);
      }
      // Targeted sync: swap the temp widget ID in the parent and persist all fields
      await onSync?.(widget.id, data.games_played_id);
      toast.success(`${gameName} is live! 🎯`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create game');
    } finally {
      setSaving(false);
    }
  };

  // ── Mark done ─────────────────────────────────────────────────────────────
  const handleMarkDone = async () => {
    setSaving(true);
    try {
      let finalResults;

      if (gameType === 'positions') {
        const err = validatePositions();
        if (err) { toast.error(err); setSaving(false); return; }

        const participants = players.map(p => ({
          attendee_id: p.id,
          position: parseInt(positionInputs[p.id], 10),
        }));

        await axios.put(
          `/api/game-nights/${widget.nightId}/games/${gameId}/positions`,
          { participants }
        );

        finalResults = participants
          .map(p => ({
            id:       p.attendee_id,
            name:     players.find(pl => pl.id === p.attendee_id)?.name || 'Unknown',
            position: p.position,
            score:    null,
          }))
          .sort((a, b) => a.position - b.position);

      } else {
        // Submit each round's scores then finalize (auto-ranks by total)
        for (const round of rounds) {
          await axios.post(
            `/api/game-nights/${widget.nightId}/games/${gameId}/rounds`,
            { scores: players.map(p => ({ attendee_id: p.id, score: parseFloat(round[p.id]) || 0 })) }
          );
        }

        const { data } = await axios.post(
          `/api/game-nights/${widget.nightId}/games/${gameId}/finalize`,
          { higher_is_better: higherIsBetter }
        );

        const totals = getTotals();

        finalResults = (data.positions || [])
          .map(r => ({
            id:       r.attendee_id,
            name:     players.find(p => p.id === r.attendee_id)?.name || 'Unknown',
            position: r.position,
            score:    totals[r.attendee_id] ?? 0,
          }))
          .sort((a, b) => a.position - b.position);
      }

      setCompletedResults(finalResults);
      setCompleted(true);

      // --- CRITICAL SYNC FIX ---
      // We send the results AND the database ID back to the parent
      onComplete(widget.id, {
        id: gameId,              // The real integer ID from state
        results: finalResults,   // Your calculated leaderboard
        is_complete: true        // Explicitly mark as done
      });
      // -------------------------

      // Targeted sync: ensure parent widget entry has the real DB ID and full results
      await onSync?.(widget.id, gameId);

      toast.success(`${gameName} wrapped up! 🏆`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save results');
    } finally {
      setSaving(false);
    }
  };

  const rankLabel = (i) => ['🥇', '🥈', '🥉'][i] ?? `${i + 1}.`;

  // ── Score display helper ───────────────────────────────────────────────────
  // For completed games from DB, score may be stored on the result.
  // We show it for scores/cumulative types.
  const showScore = (r) => {
    if (gameType === 'positions') return null;
    if (r.score == null) return null;
    // Format nicely: if it's a whole number, don't show decimals
    const num = Number(r.score);
    return Number.isInteger(num) ? num : num.toFixed(1);
  };

  // ══ COMPLETED ════════════════════════════════════════════════════════
  if (completed) {
    const winner = completedResults[0];
    return (
      <>
        {confirmState && <ConfirmModal {...confirmState} />}
        <div className="gw-widget gw-widget--done">
          <div
            className="gw-completed-header"
            onClick={() => setExpanded(e => !e)}
            role="button" tabIndex={0}
            onKeyDown={e => e.key === 'Enter' && setExpanded(p => !p)}
          >
            <div className="gw-completed-left">
              <span className="gw-type-badge">
                {gameType === 'positions' ? '🏅' : '📊'}
              </span>
              <span className="gw-completed-name">{gameName || widget.name}</span>
              {winner && <span className="gw-completed-winner">🥇 {winner.name}</span>}
            </div>
            <div className="gw-completed-right">
              {!readOnly && (
                <>
                  <button
                    className="gw-action-btn gw-action-btn--edit"
                    onClick={e => { e.stopPropagation(); handleReopen(); }}
                    disabled={saving}
                    title="Edit results"
                  >
                    ✏️ Edit
                  </button>
                  <button
                    className="gw-action-btn gw-action-btn--delete"
                    onClick={e => { e.stopPropagation(); handleDelete(); }}
                    disabled={saving}
                    title="Delete game"
                  >
                    🗑
                  </button>
                </>
              )}
              <span className="gw-done-badge">✓ Done</span>
              <span className="gw-expand-chevron">{expanded ? '▲' : '▼'}</span>
            </div>
          </div>
          {expanded && (
            <div className="gw-expanded-results">
              {completedResults.map((r, i) => {
                const scoreDisplay = showScore(r);
                return (
                  <div key={r.id ?? i} className="gw-summary-row">
                    <span className="gw-summary-rank">{rankLabel(i)}</span>
                    <span className="gw-summary-name">{r.name}</span>
                    {scoreDisplay != null && (
                      <span className="gw-summary-score">
                        {scoreDisplay}
                        <span className="gw-summary-score-label"> pts</span>
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </>
    );
  }

  // ══ READ-ONLY (night ended, game incomplete) ══════════════════════════════
  if (readOnly) {
    return (
      <div className="gw-widget gw-widget--done">
        <div className="gw-completed-header" style={{ cursor: 'default' }}>
          <div className="gw-completed-left">
            <span className="gw-type-badge">⏸</span>
            <span className="gw-completed-name">{gameName || widget.name || 'In Progress'}</span>
          </div>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Night ended</span>
        </div>
      </div>
    );
  }

  // ══ CONFIG PHASE ══════════════════════════════════════════════════════════
  if (!configured) {
    return (
      <>
        {confirmState && <ConfirmModal {...confirmState} />}
        <div className="gw-widget">
          <div className="gw-header">
            <div className="gw-header-left" style={{ position: 'relative', flex: 1 }}>
              <input
                ref={nameInputRef}
                className="input gw-name-input"
                placeholder="Game name (e.g. poker, catan…)"
                value={gameName}
                onChange={e => { setGameName(e.target.value); setShowSuggestions(true); }}
                onFocus={() => setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                autoFocus
              />
              {showSuggestions && suggestions.length > 0 && (
                <div className="gw-suggestions">
                  {suggestions.map(g => (
                    <button
                      key={g.id}
                      className="gw-suggestion-item"
                      onMouseDown={() => {
                        setGameName(g.name);
                        setShowSuggestions(false);
                      }}
                    >
                      {g.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button className="gw-remove-btn" onClick={handleDelete} disabled={saving} title="Discard">✕</button>
          </div>

          <div className="gw-config">
            <div className="gw-type-selector">
              {[
                { key: 'positions',  label: '🏅 Positions',  desc: 'Track finishing order (1st, 2nd…)' },
                { key: 'cumulative', label: '📊 Scores',     desc: 'Enter scores — add rounds as needed' },
              ].map(({ key, label, desc }) => (
                <button
                  key={key}
                  className={`gw-type-btn ${gameType === key ? 'gw-type-btn--active' : ''}`}
                  onClick={() => setGameType(key)}
                >
                  <span className="gw-type-label">{label}</span>
                  <span className="gw-type-desc">{desc}</span>
                </button>
              ))}
            </div>

            {(gameType === 'scores' || gameType === 'cumulative') && (
              <div className="gw-toggle-row">
                <span className="gw-toggle-label">Winning condition:</span>
                <div className="gw-toggle-group">
                  <button
                    className={`gw-toggle-btn ${higherIsBetter ? 'gw-toggle-btn--active' : ''}`}
                    onClick={() => setHigherIsBetter(true)}
                  >
                    ↑ Higher wins
                  </button>
                  <button
                    className={`gw-toggle-btn ${!higherIsBetter ? 'gw-toggle-btn--active' : ''}`}
                    onClick={() => setHigherIsBetter(false)}
                  >
                    ↓ Lower wins
                  </button>
                </div>
              </div>
            )}

            <div className="gw-player-picker">
              <p className="gw-picker-label">Who's playing? ({players.length} selected)</p>
              <div className="gw-picker-pills">
                {attendees.map(a => {
                  const selected = !!players.find(p => p.id === a.id);
                  return (
                    <button
                      key={a.id}
                      className={`gw-picker-pill ${selected ? 'gw-picker-pill--on' : ''}`}
                      onClick={() => togglePlayer(a)}
                    >
                      {a.name}
                      {selected && <span className="gw-picker-check">✓</span>}
                    </button>
                  );
                })}
              </div>
            </div>

            <button
              className="btn btn-primary gw-setup-btn"
              onClick={handleConfigure}
              disabled={saving || !gameName.trim() || !gameType || players.length < 2}
            >
              {saving ? 'Setting up…' : 'Start Tracking →'}
            </button>
          </div>
        </div>
      </>
    );
  }

  // ══ ACTIVE TRACKING ══════════════════════════════════════════════════════
  return (
    <>
      {confirmState && <ConfirmModal {...confirmState} />}
      <div className="gw-widget">
        <div className="gw-header">
          <div className="gw-header-left">
            <span className="gw-type-badge">
              {gameType === 'positions' ? '🏅 Positions' : '📊 Scores'}
            </span>
            <h3 className="gw-title">{gameName}</h3>
            {gameType !== 'positions' && (
              <span className="gw-dir-badge" title="Winning condition">
                {higherIsBetter ? '↑ high wins' : '↓ low wins'}
              </span>
            )}
          </div>
          <button
            className="gw-remove-btn"
            title="Delete this game"
            onClick={handleDelete}
            disabled={saving}
          >✕</button>
        </div>

        <div className="gw-body">

          {gameType === 'positions' && (
            <div className="gw-positions">
              <p className="gw-hint">Enter each player's finishing position (1 = 1st place). Every number must be unique and between 1 and {players.length}.</p>
              <div className="gw-position-grid">
                {players.map(player => (
                  <div key={player.id} className="gw-position-row">
                    <span className="gw-position-name">
                      {player.name}
                      {player.type === 'guest' && <span className="gw-guest-tag">Guest</span>}
                    </span>
                    <input
                      type="number"
                      className="gw-score-input"
                      min="1"
                      max={players.length}
                      placeholder="#"
                      value={positionInputs[player.id] ?? ''}
                      onChange={e => setPositionInputs(prev => ({ ...prev, [player.id]: e.target.value }))}
                    />
                  </div>
                ))}
              </div>
              {players.every(p => positionInputs[p.id] && !isNaN(parseInt(positionInputs[p.id]))) && (
                <div className="gw-position-preview">
                  {[...players]
                    .sort((a, b) => parseInt(positionInputs[a.id]) - parseInt(positionInputs[b.id]))
                    .map((p) => (
                      <span key={p.id} className="gw-preview-pill">
                        {rankLabel(parseInt(positionInputs[p.id]) - 1)} {p.name}
                      </span>
                    ))
                  }
                </div>
              )}
            </div>
          )}

          {(gameType === 'cumulative' || gameType === 'scores') && (
            <div className="gw-rounds-wrap">
              <div className="gw-rounds-table">
                <div
                  className="gw-rounds-header"
                  style={{ display: 'grid', gridTemplateColumns: `60px repeat(${players.length}, 1fr)` }}
                >
                  <span className="gw-cell gw-cell--label">Rd</span>
                  {players.map(p => (
                    <span key={p.id} className="gw-cell gw-cell--head">{p.name}</span>
                  ))}
                </div>
                {rounds.map((round, ri) => (
                  <div
                    key={ri}
                    className="gw-round-row"
                    style={{ display: 'grid', gridTemplateColumns: `60px repeat(${players.length}, 1fr)` }}
                  >
                    <span className="gw-cell gw-cell--label">{ri + 1}</span>
                    {players.map(p => (
                      <input
                        key={p.id}
                        type="number"
                        className="gw-round-input"
                        placeholder="0"
                        value={round[p.id]}
                        onChange={e => updateRound(ri, p.id, e.target.value)}
                      />
                    ))}
                  </div>
                ))}
                <div
                  className="gw-totals-row"
                  style={{ display: 'grid', gridTemplateColumns: `60px repeat(${players.length}, 1fr)` }}
                >
                  <span className="gw-cell gw-cell--label gw-cell--total">Total</span>
                  {players.map(p => (
                    <span key={p.id} className="gw-cell gw-cell--total-val">{getTotals()[p.id]}</span>
                  ))}
                </div>
              </div>
              <button className="btn btn-ghost gw-add-round-btn" onClick={addRound}>+ Add Round</button>
            </div>
          )}

          <button className="btn btn-primary gw-done-btn" onClick={handleMarkDone} disabled={saving}>
            {saving ? 'Saving…' : '✓ Mark Done'}
          </button>
        </div>
      </div>
    </>
  );
}