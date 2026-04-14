import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";
import { useAuth } from "../context/AuthContext";
import "./Groups.css";

export default function Groups() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchGroups();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchGroups = async () => {
    try {
      const { data } = await api.get(`/api/groups/user/${user.id}`);
      setGroups(data);
    } catch (err) {
      setError("Failed to load groups");
    } finally {
      setLoading(false);
    }
  };

  const createGroup = async (e) => {
    e.preventDefault();
    if (!newGroupName.trim()) return;
    setCreating(true);
    try {
      const { data } = await api.post("/api/groups", {
        name: newGroupName,
        user_id: user.id,
      });
      setGroups([...groups, data]);
      setNewGroupName("");
      setShowModal(false);
    } catch (err) {
      setError("Failed to create group");
    } finally {
      setCreating(false);
    }
  };

  const emojis = ["🎲", "🃏", "♟️", "🎯", "🎮", "🏆", "🎳", "🎰"];
  const getEmoji = (name) => emojis[name.charCodeAt(0) % emojis.length];

  return (
    <div className="page">
      <div className="groups-header-section">
        <div>
          <h1 className="welcome-text">Hey, {user.username} 👋</h1>
          <p className="sub-text">
            Select a group to view stats, or create a new one.
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          + New Group
        </button>
      </div>

      {error && <div className="error">{error}</div>}

      {loading ? (
        <p className="loading-text">Loading...</p>
      ) : groups.length === 0 ? (
        <EmptyState onCreateClick={() => setShowModal(true)} />
      ) : (
        <div className="groups-grid">
          {groups.map((group) => (
            <GroupCard
              key={group.id}
              group={group}
              emoji={getEmoji(group.name)}
              onClick={() => navigate(`/groups/${group.id}`)}
            />
          ))}
        </div>
      )}

      {showModal && (
        <Modal onClose={() => setShowModal(false)}>
          <h2 style={{ marginBottom: "6px" }}>Create a group</h2>
          <p
            style={{
              color: "var(--text-muted)",
              fontSize: "14px",
              marginBottom: "24px",
            }}
          >
            Give your friend group a name — you can invite members after.
          </p>
          <form onSubmit={createGroup}>
            <div className="form-group">
              <label>Group name</label>
              <input
                className="input"
                placeholder="e.g. College Friends, Family..."
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                autoFocus
                required
              />
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setShowModal(false)}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={creating}
              >
                {creating ? "Creating..." : "Create group"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

function GroupCard({ group, emoji, onClick }) {
  return (
    <div className="card group-card-clickable" onClick={onClick}>
      <div className="bg-emoji-decoration">{emoji}</div>
      <div className="card-emoji">{emoji}</div>
      <h3 className="card-title">{group.name}</h3>
      <p className="card-date">
        Created{" "}
        {new Date(group.created_at).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })}
      </p>
      <div className="card-footer">
        <span>View stats & sessions</span>
        <span className="arrow">→</span>
      </div>
    </div>
  );
}

function EmptyState({ onCreateClick }) {
  return (
    <div className="empty-state">
      <div className="empty-icon">🎲</div>
      <h2>No groups yet</h2>
      <p>
        Create a group for your friend circle or family and start tracking who's
        the real champion.
      </p>
      <button className="btn btn-primary" onClick={onCreateClick}>
        + Create your first group
      </button>
    </div>
  );
}

function Modal({ children, onClose }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card card" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}
