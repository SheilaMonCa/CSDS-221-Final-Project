import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

export default function GameNight() {
  const { id: groupId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [members, setMembers] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [guests, setGuests] = useState([]); // List of guest names
  const [nightName, setNightName] = useState(`Game Night - ${new Date().toLocaleDateString()}`);

  useEffect(() => {
    const fetchMembers = async () => {
      try {
        const res = await axios.get(`/api/groups/${groupId}/members`);
        setMembers(res.data);
        setSelectedIds(res.data.map(m => m.id)); // Default: everyone in group is present
      } catch (err) {
        toast.error("Could not load group members");
      }
    };
    fetchMembers();
  }, [groupId]);

  const handleStartNight = async () => {
    try {
      const payload = {
        name: nightName,
        group_id: groupId,
        created_by: user.id,
        attendees: [
          ...selectedIds.map(id => ({ user_id: id })),
          ...guests.map(name => ({ guest_name: name }))
        ]
      };
      
      const { data } = await axios.post('/api/game-nights', payload);
      toast.success("Let the games begin!");
      navigate(`/game-nights/${data.game_night_id}`);
    } catch (err) {
      toast.error("Failed to start session");
    }
  };

  const addGuest = () => {
    const name = prompt("Enter guest name:");
    if (name) setGuests([...guests, name]);
  };

  return (
    <div className="page container">
      <h1>New Game Night 🍻</h1>
      <div className="card" style={{ marginTop: '24px' }}>
        <div className="form-group">
          <label>Night Name</label>
          <input className="input" value={nightName} onChange={e => setNightName(e.target.value)} />
        </div>

        <h3 style={{ marginTop: '24px' }}>Who is here?</h3>
        {members.map(m => (
          <div key={m.id} className="stat-row" style={{ padding: '8px 0' }}>
            <span>{m.username}</span>
            <input 
              type="checkbox" 
              checked={selectedIds.includes(m.id)} 
              onChange={() => setSelectedIds(prev => prev.includes(m.id) ? prev.filter(i => i !== m.id) : [...prev, m.id])} 
            />
          </div>
        ))}

        <div className="divider-line" />
        <button className="btn btn-subtle" onClick={addGuest}>+ Add Outside Guest</button>
        <div style={{ marginTop: '10px' }}>
          {guests.map((g, i) => <span key={i} className="feature-pill" style={{ marginRight: '8px' }}>{g}</span>)}
        </div>

        <button className="btn btn-primary" style={{ width: '100%', marginTop: '32px' }} onClick={handleStartNight}>
          Confirm Attendance & Start
        </button>
      </div>
    </div>
  );
}