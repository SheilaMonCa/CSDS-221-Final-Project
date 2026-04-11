import React, { useState, useRef } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import './GameWidget.css';

/**
 * GameWidget
 *
 * Props:
 *   widget     — { id, gameId, nightId, name, type, players, completed }
 *   attendees  — [{ id, name, type, userId }] — full list from the night
 *   onComplete — (widgetId) => void
 *   onRemove   — (widgetId) => void
 */
export default function GameWidget({ widget, attendees, onComplete, onRemove }) {
  // ── Config phase state ─────────────────────────────────────────────────
  const [gameName,   setGameName]   = useState(widget.name  || '');
  const [gameType,   setGameType]   = useState(widget.type  || null);   // 'positions' | 'scores' | 'cumulative'
  const [players,    setPlayers]    = useState(widget.players || []);   // subset of attendees
  const [configured, setConfigured] = useState(!!widget.gameId);
  const [completed,  setCompleted]  = useState(widget.completed || false);
  const [saving,     setSaving]     = useState(false);

  // Shared ref for current gameId (updated after first save)
  const gameIdRef = useRef(widget.gameId || null);

  // ── Positions (drag-and-drop) ──────────────────────────────────────────
  const [orderedPlayers, setOrderedPlayers] = useState(players);
  const dragIdx     = useRef(null);
  const dragOverIdx = useRef(null);

  const handleDragStart = (i) => { dragIdx.current = i; };

  const handleDragEnter = (i) => {
    if (dragIdx.current === i) return;
    dragOverIdx.current = i;
    setOrderedPlayers(prev => {
      const arr  = [...prev];
      const item = arr.splice(dragIdx.current, 1)[0];
      arr.splice(i, 0, item);
      dragIdx.current = i;
      return arr;
    });
  };

  // ── Scores ─────────────────────────────────────────────────────────────
  const [scores, setScores] = useState({});   // { playerId: string }

  // ── Cumulative rounds ──────────────────────────────────────────────────
  const [rounds, setRounds] = useState([]);   // [{ playerId: string }]

  const makeEmptyRound = (pList) => {
    const r = {};
    pList.forEach(p => { r[p.id] = ''; });
    return r;
  };

  const addRound = () => setRounds(prev => [...prev, makeEmptyRound(players)]);

  const updateRound = (ri, pid, val) =>
    setRounds(prev => prev.map((r, i) => i === ri ? { ...r, [pid]: val } : r));

  const getTotals = () => {
    const t = {};
    players.forEach(p => {
      t[p.id] = rounds.reduce((sum, r) => sum + (parseFloat(r[p.id]) || 0), 0);
    });
    return t;
  };

  // ── Player toggling in config phase ───────────────────────────────────
  const togglePlayer = (attendee) => {
    setPlayers(prev => {
      const exists = prev.find(p => p.id === attendee.id);
      if (exists) {
        const next = prev.filter(p => p.id !== attendee.id);
        setOrderedPlayers(next);
        setScores(s => { const n = { ...s }; delete n[attendee.id]; return n; });
        return next;
      } else {
        const next = [...prev, attendee];
        setOrderedPlayers(next);
        setScores(s => ({ ...s, [attendee.id]: '' }));
        return next;
      }
    });
  };

  // ── Configure (save game to DB) ────────────────────────────────────────
  const handleConfigure = async () => {
    if (!gameName.trim()) { toast.error('Enter a game name'); return; }
    if (!gameType)        { toast.error('Choose a game type'); return; }
    if (players.length < 2) { toast.error('Select at least 2 players'); return; }

    setSaving(true);
    try {
      const { data } = await axios.post('/api/games-played', {
        game_night_id: widget.nightId,
        game_name:     gameName.trim(),
        game_type:     gameType === 'positions' ? 'winner_order' : 'cumulative',
        participants:  players.map(p =>
          p.type === 'user' ? { user_id: p.userId } : { guest_name: p.name }
        ),
      });
      gameIdRef.current = data.game_id;
      setConfigured(true);
      if (gameType === 'cumulative') setRounds([makeEmptyRound(players)]);
      toast.success(`${gameName} is live! 🎯`);
    } catch {
      toast.error('Failed to create game');
    } finally {
      setSaving(false);
    }
  };

  // ── Mark game done ─────────────────────────────────────────────────────
  const handleMarkDone = async () => {
    setSaving(true);
    try {
      let results;

      if (gameType === 'positions') {
        results = orderedPlayers.map((p, i) => ({
          participant_ref: p.type === 'user' ? { user_id: p.userId } : { guest_name: p.name },
          position: i + 1,
          score: null,
        }));
      } else if (gameType === 'scores') {
        results = players.map(p => ({
          participant_ref: p.type === 'user' ? { user_id: p.userId } : { guest_name: p.name },
          position: null,
          score: parseFloat(scores[p.id]) || 0,
        }));
      } else {
        // Cumulative — send totals
        const totals = getTotals();
        results = players.map(p => ({
          participant_ref: p.type === 'user' ? { user_id: p.userId } : { guest_name: p.name },
          position: null,
          score: totals[p.id],
        }));
      }

      await axios.post(`/api/games-played/${gameIdRef.current}/results`, { results });
      setCompleted(true);
      onComplete(widget.id);
      toast.success(`${gameName} wrapped up! 🏆`);
    } catch {
      toast.error('Failed to save results');
    } finally {
      setSaving(false);
    }
  };

  // ── Rank label helpers ─────────────────────────────────────────────────
  const rankLabel = (i) => ['🥇', '🥈', '🥉'][i] ?? `${i + 1}th`;

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div className={`gw-widget ${completed ? 'gw-widget--done' : ''}`}>

      {/* ── Header ── */}
      <div className="gw-header">
        <div className="gw-header-left">
          {configured && (
            <span className={`gw-type-badge gw-type-badge--${gameType}`}>
              {gameType === 'positions' ? '🏅 Positions' : gameType === 'scores' ? '🎯 Scores' : '📊 Rounds'}
            </span>
          )}
          {configured
            ? <h3 className="gw-title">{gameName}</h3>
            : <input
                className="input gw-name-input"
                placeholder="Game name (e.g. Poker, Catan…)"
                value={gameName}
                onChange={e => setGameName(e.target.value)}
              />
          }
        </div>
        <div className="gw-header-right">
          {completed
            ? <span className="gw-done-badge">✓ Done</span>
            : !configured && (
                <button className="gw-remove-btn" onClick={() => onRemove(widget.id)} title="Remove">✕</button>
              )
          }
        </div>
      </div>

      {/* ══ PHASE 1: Configure ══ */}
      {!configured && (
        <div className="gw-config">

          {/* Type selector */}
          <div className="gw-type-selector">
            {[
              { key: 'positions',  label: '🏅 Positions',  desc: 'Drag to rank players' },
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

          {/* Player picker */}
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
      )}

      {/* ══ PHASE 2: Active tracking ══ */}
      {configured && !completed && (
        <div className="gw-body">

          {/* ── Positions: drag & drop ── */}
          {gameType === 'positions' && (
            <div className="gw-dnd">
              <p className="gw-hint">Drag cards to set finishing order — top = 1st place</p>
              {orderedPlayers.map((player, i) => (
                <div
                  key={player.id}
                  className="gw-dnd-card"
                  draggable
                  onDragStart={() => handleDragStart(i)}
                  onDragEnter={() => handleDragEnter(i)}
                  onDragOver={e => e.preventDefault()}
                  onDragEnd={() => { dragIdx.current = null; dragOverIdx.current = null; }}
                >
                  <span className="gw-dnd-rank">{rankLabel(i)}</span>
                  <span className="gw-dnd-handle" aria-hidden>⠿</span>
                  <span className="gw-dnd-name">{player.name}</span>
                  {player.type === 'guest' && <span className="gw-guest-tag">Guest</span>}
                </div>
              ))}
            </div>
          )}

          {/* ── Scores: one number each ── */}
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

          {/* ── Cumulative: round-by-round table ── */}
          {gameType === 'cumulative' && (
            <div className="gw-rounds-wrap">
              <div
                className="gw-rounds-table"
                style={{ gridTemplateColumns: `72px repeat(${players.length}, 1fr)` }}
              >
                {/* Table header */}
                <div className="gw-rounds-header" style={{ gridColumn: `1 / -1`, display: 'grid', gridTemplateColumns: `72px repeat(${players.length}, 1fr)` }}>
                  <span className="gw-cell gw-cell--label">Round</span>
                  {players.map(p => (
                    <span key={p.id} className="gw-cell gw-cell--head">{p.name}</span>
                  ))}
                </div>

                {/* Round rows */}
                {rounds.map((round, ri) => (
                  <div
                    key={ri}
                    className="gw-round-row"
                    style={{ gridColumn: `1 / -1`, display: 'grid', gridTemplateColumns: `72px repeat(${players.length}, 1fr)` }}
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

                {/* Totals row */}
                <div
                  className="gw-totals-row"
                  style={{ gridColumn: `1 / -1`, display: 'grid', gridTemplateColumns: `72px repeat(${players.length}, 1fr)` }}
                >
                  <span className="gw-cell gw-cell--label gw-cell--total">Total</span>
                  {players.map(p => (
                    <span key={p.id} className="gw-cell gw-cell--total-val">
                      {getTotals()[p.id]}
                    </span>
                  ))}
                </div>
              </div>

              <button className="btn btn-ghost gw-add-round-btn" onClick={addRound}>
                + Add Round
              </button>
            </div>
          )}

          {/* Mark done */}
          <button
            className="btn btn-primary gw-done-btn"
            onClick={handleMarkDone}
            disabled={saving}
          >
            {saving ? 'Saving…' : '✓ Mark Done'}
          </button>
        </div>
      )}

      {/* ══ PHASE 3: Completed summary ══ */}
      {completed && (
        <div className="gw-summary">
          {gameType === 'positions' && orderedPlayers.map((p, i) => (
            <div key={p.id} className="gw-summary-row">
              <span className="gw-summary-rank">{rankLabel(i)}</span>
              <span>{p.name}</span>
            </div>
          ))}

          {gameType === 'scores' && (
            [...players]
              .sort((a, b) => (parseFloat(scores[b.id]) || 0) - (parseFloat(scores[a.id]) || 0))
              .map((p, i) => (
                <div key={p.id} className="gw-summary-row">
                  <span>{rankLabel(i)} {p.name}</span>
                  <strong className="gw-summary-score">{scores[p.id] ?? 0} pts</strong>
                </div>
              ))
          )}

          {gameType === 'cumulative' && (
            (() => {
              const totals = getTotals();
              return [...players]
                .sort((a, b) => totals[b.id] - totals[a.id])
                .map((p, i) => (
                  <div key={p.id} className="gw-summary-row">
                    <span>{rankLabel(i)} {p.name}</span>
                    <strong className="gw-summary-score">{totals[p.id]} pts</strong>
                  </div>
                ));
            })()
          )}
        </div>
      )}
    </div>
  );
}
