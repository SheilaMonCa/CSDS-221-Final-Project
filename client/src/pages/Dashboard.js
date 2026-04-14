import React, { useState, useEffect, useRef } from "react";
import api from "../api";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import GameNightCreator from "../components/GameNightCreator";
import AccountModal from "../components/AccountModal";
import "./Dashboard.css";

const COLOURS = [
  "#00d4aa",
  "#00b4d8",
  "#7b61ff",
  "#ff6b6b",
  "#ffd166",
  "#06d6a0",
];

// ─── Stat Chip ────────────────────────────────────────────────────────────────
function StatChip({ icon, label, value, sub }) {
  return (
    <div className="dash-chip">
      <span className="dash-chip-icon">{icon}</span>
      <div className="dash-chip-body">
        <div className="dash-chip-value">{value}</div>
        <div className="dash-chip-label">{label}</div>
        {sub && <div className="dash-chip-sub">{sub}</div>}
      </div>
    </div>
  );
}

// ─── Placement Donut Chart ────────────────────────────────────────────────────
function PlacementPie({ stats }) {
  const total = Number(stats?.total_games ?? 0);

  if (!stats || total === 0) {
    return (
      <div className="dash-empty-chart">
        <span>🎲</span>
        <p>No completed games yet</p>
      </div>
    );
  }

  const wins = Number(stats.wins ?? 0);
  const second = Number(stats.second_place ?? 0);
  const third = Number(stats.third_place ?? 0);
  const rest = Math.max(0, total - wins - second - third);

  const slices = [
    { label: "1st Place", value: wins, color: "#00d4aa", emoji: "🥇" },
    { label: "2nd Place", value: second, color: "#00b4d8", emoji: "🥈" },
    { label: "3rd Place", value: third, color: "#7b61ff", emoji: "🥉" },
    { label: "No Podium", value: rest, color: "#2e2e40", emoji: "📊" },
  ].filter((s) => s.value > 0);

  const cx = 80,
    cy = 80,
    R = 62,
    innerR = 40;
  let cumAngle = -Math.PI / 2;

  const paths = slices.map((slice) => {
    const frac = slice.value / total;

    if (frac >= 0.9999) {
      return (
        <path
          key={slice.label}
          d={`M ${cx} ${cy - R}
              A ${R} ${R} 0 1 1 ${cx - 0.001} ${cy - R}
              L ${cx - 0.001} ${cy - innerR}
              A ${innerR} ${innerR} 0 1 0 ${cx} ${cy - innerR} Z`}
          fill={slice.color}
          stroke="var(--bg)"
          strokeWidth="2"
        />
      );
    }

    const startAngle = cumAngle;
    cumAngle += frac * 2 * Math.PI;
    const endAngle = cumAngle;
    const large = frac > 0.5 ? 1 : 0;

    const x1 = cx + R * Math.cos(startAngle);
    const y1 = cy + R * Math.sin(startAngle);
    const x2 = cx + R * Math.cos(endAngle);
    const y2 = cy + R * Math.sin(endAngle);
    const ix1 = cx + innerR * Math.cos(startAngle);
    const iy1 = cy + innerR * Math.sin(startAngle);
    const ix2 = cx + innerR * Math.cos(endAngle);
    const iy2 = cy + innerR * Math.sin(endAngle);

    return (
      <path
        key={slice.label}
        d={`M ${ix1} ${iy1} L ${x1} ${y1}
            A ${R} ${R} 0 ${large} 1 ${x2} ${y2}
            L ${ix2} ${iy2}
            A ${innerR} ${innerR} 0 ${large} 0 ${ix1} ${iy1} Z`}
        fill={slice.color}
        stroke="var(--bg)"
        strokeWidth="2"
      />
    );
  });

  return (
    <div className="dash-pie-wrap">
      <div className="dash-pie-svg-wrap">
        <svg width="160" height="160" viewBox="0 0 160 160">
          {paths}
          <text
            x={cx}
            y={cy - 6}
            textAnchor="middle"
            fontSize="22"
            fontWeight="800"
            fill="var(--text)"
          >
            {wins}
          </text>
          <text
            x={cx}
            y={cy + 12}
            textAnchor="middle"
            fontSize="11"
            fill="var(--text-muted)"
          >
            wins
          </text>
        </svg>
      </div>
      <div className="dash-pie-legend">
        {slices.map((s) => (
          <div key={s.label} className="dash-pie-legend-row">
            <span className="dash-pie-dot" style={{ background: s.color }} />
            <span className="dash-pie-legend-name">
              {s.emoji} {s.label}
            </span>
            <span className="dash-pie-legend-count">{s.value}</span>
            <span className="dash-pie-legend-pct">
              {Math.round((s.value / total) * 100)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Win Rate Bar Chart ───────────────────────────────────────────────────────
function WinRateChart({ byGame }) {
  if (!byGame || byGame.length === 0) {
    return (
      <div className="dash-empty-chart">
        <span>🎮</span>
        <p>Play more games to see your win rates</p>
      </div>
    );
  }

  const sorted = [...byGame].sort(
    (a, b) => Number(b.total_games) - Number(a.total_games),
  );

  const opacityFor = (n) => {
    const t = Number(n);
    if (t >= 15) return 1;
    if (t >= 8) return 0.78;
    if (t >= 4) return 0.54;
    return 0.33;
  };

  return (
    <div className="dash-bar-wrap">
      {sorted.map((g) => {
        const rate = Number(g.win_rate);
        const total = Number(g.total_games);
        const wins = Number(g.wins);
        const op = opacityFor(total);
        const showInside = rate > 22;

        return (
          <div key={g.game_name} className="dash-bar-row">
            <div className="dash-bar-label" title={g.game_name}>
              {g.game_name}
            </div>
            <div className="dash-bar-track">
              <div
                className="dash-bar-fill"
                style={{ width: `${rate}%`, opacity: op }}
              >
                {showInside && (
                  <span className="dash-bar-inner-label">
                    {wins}/{total}
                  </span>
                )}
              </div>
              {!showInside && (
                <span className="dash-bar-outer-label">
                  {wins}/{total}
                </span>
              )}
            </div>
            <div className="dash-bar-pct">{rate}%</div>
          </div>
        );
      })}
      <p className="dash-bar-hint">
        Bar opacity reflects sample size — more transparent = fewer games played
      </p>
    </div>
  );
}

// ─── H2H Line Chart ───────────────────────────────────────────────────────────
function H2HChart({ timeline, user1, user2, gameFilter }) {
  const svgRef = useRef(null);
  const [tooltip, setTooltip] = useState(null);

  const filtered =
    gameFilter === "all"
      ? timeline
      : timeline.filter((d) => d.game_id === gameFilter);

  if (!filtered || filtered.length === 0) {
    return (
      <div className="dash-empty-chart" style={{ paddingTop: 32 }}>
        <span>📊</span>
        <p>
          No shared games found{gameFilter !== "all" ? " for this game" : ""}
        </p>
      </div>
    );
  }

  const nightMap = new Map();
  filtered.forEach((entry) => {
    const k = entry.night_id;
    if (!nightMap.has(k)) {
      nightMap.set(k, {
        nightId: entry.night_id,
        name: entry.night_name,
        date: new Date(entry.date),
        u1_pts: 0,
        u2_pts: 0,
      });
    }
    const n = nightMap.get(k);
    n.u1_pts += entry.user1_pts;
    n.u2_pts += entry.user2_pts;
  });

  let cum1 = 0,
    cum2 = 0;
  const points = Array.from(nightMap.values())
    .sort((a, b) => a.date - b.date)
    .map((n) => {
      cum1 += n.u1_pts;
      cum2 += n.u2_pts;
      return {
        ...n,
        cum1,
        cum2,
        shortDate: n.date.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        }),
        fullDate: n.date.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        }),
      };
    });

  const W = 680,
    H = 230;
  const PAD = { top: 16, right: 16, bottom: 38, left: 40 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;
  const maxPts = Math.max(...points.map((p) => Math.max(p.cum1, p.cum2)), 1);
  const xScale = (i) => (i / Math.max(points.length - 1, 1)) * chartW;
  const yScale = (v) => chartH - (v / maxPts) * chartH;
  const buildPath = (key) =>
    points
      .map((p, i) => `${PAD.left + xScale(i)},${PAD.top + yScale(p[key])}`)
      .join(" ");
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(f * maxPts));
  const u1Col = COLOURS[0];
  const u2Col = COLOURS[1];
  const last = points[points.length - 1];
  const u1Leading = last.cum1 >= last.cum2;

  return (
    <div className="h2h-chart-wrap">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="chart-svg"
        onMouseLeave={() => setTooltip(null)}
      >
        {yTicks.map((v) => (
          <g key={v}>
            <line
              x1={PAD.left}
              y1={PAD.top + yScale(v)}
              x2={PAD.left + chartW}
              y2={PAD.top + yScale(v)}
              stroke="rgba(255,255,255,0.05)"
              strokeWidth="1"
            />
            <text
              x={PAD.left - 6}
              y={PAD.top + yScale(v) + 4}
              textAnchor="end"
              fontSize="10"
              fill="rgba(255,255,255,0.28)"
            >
              {v}
            </text>
          </g>
        ))}
        {points.map((p, i) => {
          const skip = points.length > 8 ? Math.ceil(points.length / 8) : 1;
          if (i % skip !== 0 && i !== points.length - 1) return null;
          return (
            <text
              key={`xl-${p.nightId}`}
              x={PAD.left + xScale(i)}
              y={H - 4}
              textAnchor="middle"
              fontSize="10"
              fill="rgba(255,255,255,0.28)"
            >
              {p.shortDate}
            </text>
          );
        })}
        <polyline
          points={buildPath("cum1")}
          fill="none"
          stroke={u1Col}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.92"
        />
        <polyline
          points={buildPath("cum2")}
          fill="none"
          stroke={u2Col}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.92"
        />
        {points.map((p, i) => {
          const x = PAD.left + xScale(i);
          return (
            <g key={`pt-${p.nightId}`}>
              <circle
                cx={x}
                cy={PAD.top + yScale(p.cum1)}
                r="3.5"
                fill={u1Col}
              />
              <circle
                cx={x}
                cy={PAD.top + yScale(p.cum2)}
                r="3.5"
                fill={u2Col}
              />
              <rect
                x={x - 22}
                y={PAD.top}
                width={44}
                height={chartH}
                fill="transparent"
                style={{ cursor: "crosshair" }}
                onMouseEnter={(e) => {
                  const rect = svgRef.current?.getBoundingClientRect();
                  setTooltip({ p, x: e.clientX - (rect?.left || 0) });
                }}
                onMouseLeave={() => setTooltip(null)}
              />
            </g>
          );
        })}
      </svg>
      {tooltip && (
        <div
          className="chart-tooltip"
          style={{ left: Math.min(tooltip.x + 8, 480), top: 12 }}
        >
          <div className="chart-tooltip-night">{tooltip.p.name}</div>
          <div className="chart-tooltip-date">{tooltip.p.fullDate}</div>
          <div className="chart-tooltip-rows">
            {[
              { name: user1.username, pts: tooltip.p.cum1, color: u1Col },
              { name: user2.username, pts: tooltip.p.cum2, color: u2Col },
            ]
              .sort((a, b) => b.pts - a.pts)
              .map((row) => (
                <div key={row.name} className="chart-tooltip-row">
                  <span
                    className="chart-tooltip-dot"
                    style={{ background: row.color }}
                  />
                  <span className="chart-tooltip-name">{row.name}</span>
                  <span className="chart-tooltip-pts">{row.pts} pts</span>
                </div>
              ))}
          </div>
        </div>
      )}
      <div className="chart-legend">
        <div className="chart-legend-item chart-legend-item--active">
          <span className="chart-legend-dot" style={{ background: u1Col }} />
          <span>
            {user1.username}
            {u1Leading ? " 👑" : ""}
          </span>
        </div>
        <div className="chart-legend-item chart-legend-item--active">
          <span className="chart-legend-dot" style={{ background: u2Col }} />
          <span>
            {user2.username}
            {!u1Leading ? " 👑" : ""}
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Head-to-Head Section ─────────────────────────────────────────────────────
function H2HSection({ userId }) {
  const [input, setInput] = useState("");
  const [searching, setSearching] = useState(false);
  const [h2hData, setH2hData] = useState(null);
  const [gameFilter, setGameFilter] = useState("all");
  const [error, setError] = useState("");

  const handleSearch = async () => {
    const q = input.trim();
    if (!q) return;
    setSearching(true);
    setError("");
    setH2hData(null);
    try {
      const { data: found } = await api.get(
        `/api/users/search?q=${encodeURIComponent(q)}`,
      );
      if (!found?.id) {
        setError(`No registered user found with username "${q}"`);
        return;
      }
      // UUID string comparison — no Number() casting needed
      if (found.id === userId) {
        setError("That's you! Try searching for someone else.");
        return;
      }
      const { data } = await api.get(`/api/users/${userId}/vs/${found.id}`);
      setH2hData(data);
      setGameFilter("all");
    } catch {
      setError("Failed to load comparison data. Please try again.");
    } finally {
      setSearching(false);
    }
  };

  return (
    <section className="card h2h-section">
      <div className="h2h-top">
        <div>
          <h3>Head-to-Head</h3>
          <p className="sub-text" style={{ fontSize: 13, marginTop: 3 }}>
            Compare your stats against another player — only games you both
            played count.
          </p>
        </div>
      </div>
      <div className="h2h-search-row">
        <input
          className="input"
          placeholder="Enter a username…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          style={{ maxWidth: 260 }}
        />
        <button
          className="btn btn-ghost"
          onClick={handleSearch}
          disabled={searching || !input.trim()}
        >
          {searching ? "Searching…" : "Compare →"}
        </button>
      </div>
      {error && <p className="h2h-error">{error}</p>}
      {h2hData &&
        (h2hData.total_shared === 0 ? (
          <div className="dash-empty-chart" style={{ marginTop: 20 }}>
            <span>🤝</span>
            <p>
              You and <strong>{h2hData.user2.username}</strong> haven't played
              any completed games together yet.
            </p>
          </div>
        ) : (
          <div className="h2h-content">
            <div className="h2h-rivalry">
              <div className="h2h-rival-side">
                <div className="h2h-rival-name">{h2hData.user1.username}</div>
                <div className="h2h-rival-wins">
                  {h2hData.overall.user1_wins}
                </div>
                <div className="h2h-rival-sub">
                  {h2hData.overall.user1_win_rate}% win rate
                </div>
              </div>
              <div className="h2h-rival-center">
                <div className="h2h-rival-total">{h2hData.total_shared}</div>
                <div className="h2h-rival-total-label">shared games</div>
                <div className="h2h-rival-vs">VS</div>
              </div>
              <div className="h2h-rival-side h2h-rival-side--right">
                <div className="h2h-rival-name">{h2hData.user2.username}</div>
                <div className="h2h-rival-wins">
                  {h2hData.overall.user2_wins}
                </div>
                <div className="h2h-rival-sub">
                  {h2hData.overall.user2_win_rate}% win rate
                </div>
              </div>
            </div>
            {h2hData.games.length > 1 && (
              <div className="h2h-pills">
                <span className="chart-filter-label">Filter:</span>
                <div className="chart-filter-pills">
                  <button
                    className={`chart-filter-pill ${gameFilter === "all" ? "chart-filter-pill--active" : ""}`}
                    onClick={() => setGameFilter("all")}
                  >
                    All Games
                  </button>
                  {h2hData.games.map((g) => (
                    <button
                      key={g.id}
                      className={`chart-filter-pill ${gameFilter === g.id ? "chart-filter-pill--active" : ""}`}
                      onClick={() => setGameFilter(g.id)}
                    >
                      {g.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div style={{ marginTop: 20, position: "relative" }}>
              <H2HChart
                timeline={h2hData.timeline}
                user1={h2hData.user1}
                user2={h2hData.user2}
                gameFilter={gameFilter}
              />
            </div>
            {h2hData.by_game.length > 0 && (
              <div className="h2h-breakdown">
                <p className="h2h-breakdown-title">Per-Game Breakdown</p>
                <div className="h2h-breakdown-header">
                  <span>Game</span>
                  <span>{h2hData.user1.username}</span>
                  <span>{h2hData.user2.username}</span>
                  <span>Games</span>
                </div>
                {h2hData.by_game.map((g) => (
                  <div key={g.game_id} className="h2h-breakdown-row">
                    <span className="h2h-breakdown-game">{g.game_name}</span>
                    <span className="h2h-breakdown-stat">
                      {g.u1_wins}W · {g.u1_win_rate}%
                    </span>
                    <span className="h2h-breakdown-stat">
                      {g.u2_wins}W · {g.u2_win_rate}%
                    </span>
                    <span className="h2h-breakdown-total">{g.total}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
    </section>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────
export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [stats, setStats] = useState(null);
  const [chips, setChips] = useState(null);
  const [byGame, setByGame] = useState([]);
  const [history, setHistory] = useState([]);
  const [expandedHistory, setExpandedHistory] = useState(null);
  const [historyDetails, setHistoryDetails] = useState({});
  const [showNightModal, setShowNightModal] = useState(false);

  // Single state drives both account modals — null | 'edit' | 'delete'
  const [accountModal, setAccountModal] = useState(null);

  useEffect(() => {
    const load = async () => {
      const [s, c, g, h] = await Promise.allSettled([
        api.get(`/api/users/${user.id}/stats`),
        api.get(`/api/users/${user.id}/chips`),
        api.get(`/api/users/${user.id}/stats/by-game`),
        api.get(`/api/users/${user.id}/history`),
      ]);
      if (s.status === "fulfilled") setStats(s.value.data);
      if (c.status === "fulfilled") setChips(c.value.data);
      if (g.status === "fulfilled") setByGame(g.value.data || []);
      if (h.status === "fulfilled") setHistory(h.value.data || []);
    };
    load();
  }, [user.id]);

  const rankIcon = (pos) => ["🥇", "🥈", "🥉"][pos - 1] ?? `#${pos}`;
  const rankEmoji = (pos) => ["🥇", "🥈", "🥉"][pos - 1] ?? `#${pos}`;

  const toggleHistoryItem = async (game) => {
    const gpId = game.games_played_id;
    if (expandedHistory === gpId) {
      setExpandedHistory(null);
      return;
    }
    setExpandedHistory(gpId);
    if (historyDetails[gpId]) return;
    try {
      const { data } = await api.get(`/api/users/history-detail/${gpId}`);
      setHistoryDetails((prev) => ({ ...prev, [gpId]: data }));
    } catch {
      setHistoryDetails((prev) => ({ ...prev, [gpId]: { error: true } }));
    }
  };

  return (
    <div className="page dash-page">
      {/* ── Header ── */}
      <header className="dash-header">
        <div className="dash-header-left">
          <div className="dash-title-row">
            <h1 className="page-title">Hey, {user.username} 👋</h1>
            <span className="dash-title-sub">
              — Welcome back to your dashboard
            </span>
          </div>
          <div className="dash-meta-row">
            <button
              className="dash-meta-link"
              onClick={() => setAccountModal("edit")}
            >
              ⚙ Account Settings
            </button>
            <span className="dash-meta-sep">·</span>
            <button
              className="dash-meta-link dash-meta-link--danger"
              onClick={() => setAccountModal("delete")}
            >
              🗑 Delete Account
            </button>
          </div>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => setShowNightModal(true)}
        >
          🎲 New Game Night
        </button>
      </header>

      {/* ── Stat chips ── */}
      {chips && (
        <div className="dash-chips">
          {chips.streak > 0 && (
            <StatChip
              icon="🔥"
              label="Win Streak"
              value={chips.streak}
              sub={`game${chips.streak !== 1 ? "s" : ""} in a row`}
            />
          )}
          <StatChip
            icon="🌙"
            label="Nights Attended"
            value={chips.total_nights}
          />
          {stats && (
            <StatChip
              icon="🏆"
              label="Total Wins"
              value={Number(stats.wins ?? 0)}
              sub={`of ${Number(stats.total_games ?? 0)} games`}
            />
          )}
          {chips.avg_position && (
            <StatChip
              icon="📍"
              label="Avg Finish"
              value={`#${chips.avg_position}`}
            />
          )}
          {chips.most_played_game && (
            <StatChip
              icon="🎮"
              label="Most Played"
              value={chips.most_played_game}
              sub={`${chips.most_played_count}× played`}
            />
          )}
        </div>
      )}

      {/* ── Two side-by-side charts ── */}
      <div className="dash-charts-row">
        <section className="card dash-chart-half">
          <h3 className="dash-section-title">Placement Breakdown</h3>
          <PlacementPie stats={stats} />
        </section>
        <section className="card dash-chart-half">
          <h3 className="dash-section-title">Win Rate by Game</h3>
          <WinRateChart byGame={byGame} />
        </section>
      </div>

      {/* ── Head-to-Head ── */}
      <H2HSection userId={user.id} />

      {/* ── Recent History ── */}
      <section className="card" style={{ marginTop: 24 }}>
        <h3>Recent Game History</h3>
        <div className="history-list" style={{ marginTop: 16 }}>
          {history.length > 0 ? (
            history.map((game, i) => {
              const gpId = game.games_played_id;
              const isOpen = expandedHistory === gpId;
              const detail = historyDetails[gpId];
              return (
                <div key={`hist-${i}-${gpId}`} className="history-item">
                  <div
                    className="history-item-row"
                    onClick={() => toggleHistoryItem(game)}
                  >
                    <div className="history-item-left">
                      <span
                        className={`history-chevron ${isOpen ? "history-chevron--open" : ""}`}
                      >
                        ▶
                      </span>
                      <div>
                        <div className="game-name">{game.game_name}</div>
                        <div className="game-meta">
                          {game.played_at
                            ? new Date(game.played_at).toLocaleDateString(
                                "en-US",
                                {
                                  month: "short",
                                  day: "numeric",
                                  year: "numeric",
                                },
                              )
                            : "Date unknown"}
                          {game.night_name && ` · ${game.night_name}`}
                        </div>
                      </div>
                    </div>
                    <div className={`game-rank ${game.is_win ? "win" : ""}`}>
                      {game.is_win
                        ? "🏆 1st"
                        : `${rankIcon(Number(game.position))} of ${game.total_players}`}
                    </div>
                  </div>
                  {isOpen && (
                    <div className="history-expanded">
                      {!detail ? (
                        <div className="history-expanded-loading">Loading…</div>
                      ) : detail.error ? (
                        <div className="history-expanded-loading">
                          Couldn't load game details.
                        </div>
                      ) : (
                        <>
                          <div className="history-results">
                            {detail.participants.map((p, pi) => {
                              // UUID string comparison — no Number() casting
                              const isMe = p.user_id === user.id;
                              const pos = Number(p.position);
                              let score = null;
                              if (
                                detail.game_type === "scores" ||
                                detail.game_type === "cumulative"
                              ) {
                                score = detail.rounds.reduce(
                                  (sum, r) =>
                                    r.name === p.name
                                      ? sum + Number(r.score)
                                      : sum,
                                  0,
                                );
                              }
                              return (
                                <div
                                  key={pi}
                                  className={`history-result-row ${isMe ? "history-result-row--me" : ""}`}
                                >
                                  <span className="history-result-rank">
                                    {rankEmoji(pos)}
                                  </span>
                                  <span
                                    className={`history-result-name ${isMe ? "history-result-name--me" : ""}`}
                                  >
                                    {p.name}
                                    {isMe ? " (you)" : ""}
                                  </span>
                                  {score !== null && (
                                    <span className="history-result-score">
                                      {score} pts
                                    </span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                          {game.game_night_id && (
                            <div className="history-expanded-links">
                              <button
                                className="history-link-btn"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigate(
                                    `/game-nights/${game.game_night_id}`,
                                  );
                                }}
                              >
                                🌙 View Game Night →
                              </button>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <div style={{ padding: "32px 0", textAlign: "center" }}>
              <p className="sub-text">No games recorded yet.</p>
              <button
                className="btn btn-primary"
                style={{ marginTop: 16 }}
                onClick={() => setShowNightModal(true)}
              >
                Start your first game night
              </button>
            </div>
          )}
        </div>
      </section>

      {/* ── Game Night Creator modal ── */}
      <GameNightCreator
        isOpen={showNightModal}
        onClose={() => setShowNightModal(false)}
        prefillGroupId={null}
      />

      {/* ── Account modals (edit / delete) — all logic lives in AccountModal ── */}
      <AccountModal mode={accountModal} onClose={() => setAccountModal(null)} />
    </div>
  );
}
