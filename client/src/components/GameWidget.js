import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import './GameWidget.css';

export default function GameWidget({ widget, attendees, onComplete, onRemove, onNameResolved, readOnly = false }) {
  const [gameName,   setGameName]   = useState(widget.name || '');
  const [gameType,   setGameType]   = useState(widget.type || null);
  const [players,    setPlayers]    = useState(widget.players?.length ? widget.players : []);
  const [configured, setConfigured] = useState(widget.completed || !!widget.gameId);
  const [completed,  setCompleted]  = useState(widget.completed || false);
  const [saving,     setSaving]     = useState(false);
  const [expanded,   setExpanded]   = useState(false);
  const [completedResults, setCompletedResults] = useState(widget.completedResults || []);

  // Higher or lower wins (for scores + cumulative)
  const [higherIsBetter, setHigherIsBetter] = useState(true);

  const gameIdRef = useRef(widget.gameId || null);

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

  // ── Positions (replaces DnD) ──────────────────────────────────────────────
  // { [playerId]: string } — the position number each player typed
  const [positionInputs, setPositionInputs] = useState({});

  // Initialise position inputs whenever players list changes
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

  // ── Scores ────────────────────────────────────────────────────────────────
  const [scores, setScores] = useState({});

  // ── Cumulative rounds ─────────────────────────────────────────────────────
  const [rounds, setRounds] = useState([]);

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
        setScores(s => { const n = { ...s }; delete n[attendee.id]; return n; });
        return next;
      }
      return [...prev, attendee];
    });
  };

  // ── Configure ─────────────────────────────────────────────────────────────
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
        game_type:   gameType === 'positions' ? 'winner_order' : 'cumulative',
        is_complete: false,
        participants: players.map((p, i) => ({ attendee_id: p.id, position: i + 1 })),
      });

      gameIdRef.current = data.games_played_id;
      onNameResolved?.(widget.id, gameName.trim());
      setConfigured(true);
      if (gameType === 'cumulative' || gameType === 'scores') {
        setRounds([makeEmptyRound(players)]);
      }
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
          `/api/game-nights/${widget.nightId}/games/${gameIdRef.current}/positions`,
          { participants }
        );

        finalResults = participants
          .map(p => ({
            id:       p.attendee_id,
            name:     players.find(pl => pl.id === p.attendee_id)?.name || 'Unknown',
            position: p.position,
          }))
          .sort((a, b) => a.position - b.position);

      } else {
        // scores or cumulative — both use rounds + finalize
        const scoresToSubmit = gameType === 'scores'
          ? players.map(p => ({ attendee_id: p.id, score: parseFloat(scores[p.id]) || 0 }))
          : null;

        if (gameType === 'scores') {
          await axios.post(
            `/api/game-nights/${widget.nightId}/games/${gameIdRef.current}/rounds`,
            { scores: scoresToSubmit }
          );
        } else {
          // Submit each tracked round
          for (const round of rounds) {
            await axios.post(
              `/api/game-nights/${widget.nightId}/games/${gameIdRef.current}/rounds`,
              { scores: players.map(p => ({ attendee_id: p.id, score: parseFloat(round[p.id]) || 0 })) }
            );
          }
        }

        const { data } = await axios.post(
          `/api/game-nights/${widget.nightId}/games/${gameIdRef.current}/finalize`,
          { higher_is_better: higherIsBetter }
        );

        const totals = gameType === 'scores'
          ? Object.fromEntries(players.map(p => [p.id, parseFloat(scores[p.id]) || 0]))
          : getTotals();

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
      onComplete(widget.id, finalResults);
      toast.success(`${gameName} wrapped up! 🏆`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save results');
    } finally {
      setSaving(false);
    }
  };

  const rankLabel = (i) => ['🥇', '🥈', '🥉'][i] ?? `${i + 1}`;

  // ══ COMPLETED ════════════════════════════════════════════════════════
  if (completed) {
    const winner = completedResults[0];
    return (
      <div className="gw-widget gw-widget--done">
        <div
          className="gw-completed-header"
          onClick={() => setExpanded(e => !e)}
          role="button" tabIndex={0}
          onKeyDown={e => e.key === 'Enter' && setExpanded(p => !p)}
        >
          <div className="gw-completed-left">
            <span className="gw-type-badge">
              {gameType === 'positions' ? '🏅' : gameType === 'scores' ? '🎯' : '📊'}
            </span>
            <span className="gw-completed-name">{gameName || widget.name}</span>
            {winner && <span className="gw-completed-winner">🥇 {winner.name}</span>}
          </div>
          <div className="gw-completed-right">
            <span className="gw-done-badge">✓ Done</span>
            <span className="gw-expand-chevron">{expanded ? '▲' : '▼'}</span>
          </div>
        </div>
        {expanded && (
          <div className="gw-expanded-results">
            {completedResults.map((r, i) => (
              <div key={r.id ?? i} className="gw-summary-row">
                <span className="gw-summary-rank">{rankLabel(i)}</span>
                <span className="gw-summary-name">{r.name}</span>
                {r.score != null && gameType !== 'positions' && (
                  <span className="gw-summary-score">{r.score} pts</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ══ READ-ONLY (night ended) ═══════════════════════════════════════════════
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
          <button className="gw-remove-btn" onClick={() => onRemove(widget.id)} title="Discard">✕</button>
        </div>

        <div className="gw-config">
          <div className="gw-type-selector">
            {[
              { key: 'positions',  label: '🏅 Positions',  desc: 'Enter each player\'s place (1st, 2nd…)' },
              { key: 'scores',     label: '🎯 Scores',     desc: 'Enter a final score each' },
              { key: 'cumulative', label: '📊 Rounds',     desc: 'Track score round by round' },
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

          {/* Scoring direction toggle (scores + cumulative only) */}
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
    );
  }

  // ══ ACTIVE TRACKING ══════════════════════════════════════════════════════
  return (
    <div className="gw-widget">
      <div className="gw-header">
        <div className="gw-header-left">
          <span className="gw-type-badge">
            {gameType === 'positions' ? '🏅 Positions' : gameType === 'scores' ? '🎯 Scores' : '📊 Rounds'}
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
          title="Cancel this game"
          onClick={() => {
            if (window.confirm(`Cancel "${gameName}"? The game entry will remain but be incomplete.`))
              onRemove(widget.id);
          }}
        >✕</button>
      </div>

      <div className="gw-body">

        {/* ── Positions: numbered inputs ── */}
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
            {/* Live preview sorted by entered position */}
            {players.every(p => positionInputs[p.id] && !isNaN(parseInt(positionInputs[p.id]))) && (
              <div className="gw-position-preview">
                {[...players]
                  .sort((a, b) => parseInt(positionInputs[a.id]) - parseInt(positionInputs[b.id]))
                  .map((p, i) => (
                    <span key={p.id} className="gw-preview-pill">
                      {rankLabel(parseInt(positionInputs[p.id]) - 1)} {p.name}
                    </span>
                  ))
                }
              </div>
            )}
          </div>
        )}

        {/* ── Scores: single score per player ── */}
        {gameType === 'scores' && (
          <div className="gw-scores">
            {players.map(player => (
              <div key={player.id} className="gw-score-row">
                <span className="gw-score-name">
                  {player.name}
                  {player.type === 'guest' && <span className="gw-guest-tag">Guest</span>}
                </span>
                <input
                  type="number"
                  className="gw-score-input"
                  placeholder="0"
                  value={scores[player.id] ?? ''}
                  onChange={e => setScores(s => ({ ...s, [player.id]: e.target.value }))}
                />
              </div>
            ))}
          </div>
        )}

        {/* ── Cumulative rounds ── */}
        {gameType === 'cumulative' && (
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
  );
}
