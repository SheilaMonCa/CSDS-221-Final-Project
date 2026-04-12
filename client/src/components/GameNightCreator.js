import React, { useState, useEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './GameNightCreator.css';

/**
 * GameNightCreator
 * Props:
 *   isOpen        — boolean
 *   onClose       — function
 *   prefillGroupId — optional string/number: auto-fetches that group's members on open
 *                    AND links the new night to that group via groups_present
 */
export default function GameNightCreator({ isOpen, onClose, prefillGroupId = null }) {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [nightName, setNightName] = useState('');
  const [pills, setPills] = useState([]);  // { id, name, type: 'user'|'guest', userId, absent }
  const [groupInput, setGroupInput] = useState('');
  const [personInput, setPersonInput] = useState('');
  const [loadingGroup, setLoadingGroup] = useState(false);
  const [starting, setStarting] = useState(false);

  // Reset and optionally prefill whenever modal opens
  useEffect(() => {
    if (isOpen) {
      const defaultName = `Game Night — ${new Date().toLocaleDateString('en-US', {
        month: 'short', day: 'numeric',
      })}`;
      setNightName(defaultName);
      setPills([]);
      setGroupInput('');
      setPersonInput('');

      if (prefillGroupId) {
        fetchAndAddGroup(prefillGroupId);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // ─── Helpers ──────────────────────────────────────────────────────────────

  const mergeMembersIntoPills = (members) => {
    setPills(prev => {
      const existingUserIds = new Set(prev.map(p => p.userId).filter(Boolean));
      const fresh = members
        .filter(m => !existingUserIds.has(m.id))
        .map(m => ({
          id: `user-${m.id}`,
          name: m.username,
          type: 'user',
          userId: m.id,
          absent: false,
        }));
      return [...prev, ...fresh];
    });
  };

  const fetchAndAddGroup = async (groupId) => {
    setLoadingGroup(true);
    try {
      const { data } = await axios.get(`/api/groups/${groupId}/members`);
      mergeMembersIntoPills(data);
    } catch {
      toast.error("Couldn't load that group");
    } finally {
      setLoadingGroup(false);
    }
  };

  // ─── Handlers ─────────────────────────────────────────────────────────────

  const handleAddGroup = async () => {
    const id = groupInput.trim();
    if (!id) return;
    await fetchAndAddGroup(id);
    setGroupInput('');
    toast.success('Group members added!');
  };

  const handleAddPerson = async () => {
    const raw = personInput.trim();
    if (!raw) return;
    setPersonInput('');

    try {
      const { data } = await axios.get(`/api/users/search?q=${encodeURIComponent(raw)}`);
      if (data?.id) {
        const alreadyIn = pills.some(p => p.userId === data.id);
        if (alreadyIn) {
          toast('Already in the list!', { icon: '👀' });
          return;
        }
        setPills(prev => [...prev, {
          id: `user-${data.id}`,
          name: data.username,
          type: 'user',
          userId: data.id,
          absent: false,
        }]);
        toast.success(`${data.username} added`);
        return;
      }
    } catch {
      // Not found as user — fall through to guest
    }

    setPills(prev => [...prev, {
      id: `guest-${Date.now()}-${Math.random()}`,
      name: raw,
      type: 'guest',
      userId: null,
      absent: false,
    }]);
    toast.success(`${raw} added as guest 👤`);
  };

  const toggleAbsent = (id) =>
    setPills(prev => prev.map(p => p.id === id ? { ...p, absent: !p.absent } : p));

  const removePill = (id) =>
    setPills(prev => prev.filter(p => p.id !== id));

  const handleStartNight = async () => {
    const present = pills.filter(p => !p.absent);
    if (present.length === 0) {
      toast.error('Add at least one attendee');
      return;
    }
    if (!nightName.trim()) {
      toast.error('Give the night a name');
      return;
    }
    setStarting(true);
    try {
      // ✅ FIX: pass group_ids so this night appears in the group's game-nights list
      const groupIds = prefillGroupId ? [parseInt(prefillGroupId, 10)] : [];

      const { data } = await axios.post('/api/game-nights', {
        name: nightName.trim(),
        created_by: user.id,
        attendees: present.map(p =>
          p.type === 'user'
            ? { user_id: p.userId }
            : { guest_name: p.name }
        ),
        group_ids: groupIds,
      });
      toast.success('Game night started! 🎲');
      onClose();
      navigate(`/game-nights/${data.game_night_id}`);
    } catch {
      toast.error('Failed to start game night');
    } finally {
      setStarting(false);
    }
  };

  // ─── Derived ──────────────────────────────────────────────────────────────

  if (!isOpen) return null;

  const present = pills.filter(p => !p.absent);
  const absent  = pills.filter(p =>  p.absent);

  return (
    <div className="gnc-overlay" onClick={onClose}>
      <div className="gnc-modal card" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="gnc-header">
          <h2>Start Game Night 🎲</h2>
          <button className="gnc-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        {/* Night name */}
        <div className="form-group">
          <label>Night Name</label>
          <input
            className="input"
            value={nightName}
            onChange={e => setNightName(e.target.value)}
            placeholder="e.g. Friday Poker Night"
          />
        </div>

        {/* Add sources */}
        <div className="gnc-add-grid">
          <div className="form-group">
            <label>Add Group by ID</label>
            <div className="gnc-input-row">
              <input
                className="input"
                placeholder="Group ID…"
                value={groupInput}
                onChange={e => setGroupInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddGroup()}
              />
              <button
                className="btn btn-ghost"
                onClick={handleAddGroup}
                disabled={loadingGroup || !groupInput.trim()}
              >
                {loadingGroup ? '…' : '+ Add'}
              </button>
            </div>
          </div>

          <div className="form-group">
            <label>Add Person</label>
            <div className="gnc-input-row">
              <input
                className="input"
                placeholder="Username or guest name…"
                value={personInput}
                onChange={e => setPersonInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddPerson()}
              />
              <button
                className="btn btn-ghost"
                onClick={handleAddPerson}
                disabled={!personInput.trim()}
              >
                + Add
              </button>
            </div>
          </div>
        </div>

        {/* Pills area */}
        {pills.length > 0 ? (
          <div className="gnc-pills-area">
            {present.length > 0 && (
              <div>
                <p className="gnc-section-label">Present · {present.length}</p>
                <div className="gnc-pills">
                  {present.map(p => (
                    <div key={p.id} className="gnc-pill gnc-pill--present">
                      {p.type === 'guest' && <span className="gnc-guest-badge">G</span>}
                      <span className="gnc-pill-name">{p.name}</span>
                      <button
                        className="gnc-pill-action gnc-pill-action--absent"
                        onClick={() => toggleAbsent(p.id)}
                        title="Mark absent"
                      >✕</button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {absent.length > 0 && (
              <div style={{ marginTop: '14px' }}>
                <p className="gnc-section-label">Absent · {absent.length}</p>
                <div className="gnc-pills">
                  {absent.map(p => (
                    <div key={p.id} className="gnc-pill gnc-pill--absent">
                      <span className="gnc-pill-name">{p.name}</span>
                      <button
                        className="gnc-pill-action gnc-pill-action--present"
                        onClick={() => toggleAbsent(p.id)}
                        title="Mark present"
                      >✓</button>
                      <button
                        className="gnc-pill-remove"
                        onClick={() => removePill(p.id)}
                        title="Remove entirely"
                      >×</button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="gnc-empty-state">
            <span>🎲</span>
            <p>No one added yet — search for a group or individual above.</p>
          </div>
        )}

        {/* Footer */}
        <div className="gnc-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button
            className="btn btn-primary"
            onClick={handleStartNight}
            disabled={starting || present.length === 0}
          >
            {starting
              ? 'Starting…'
              : `Start Night with ${present.length} player${present.length !== 1 ? 's' : ''}`}
          </button>
        </div>
      </div>
    </div>
  );
}
