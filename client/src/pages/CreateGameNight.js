import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

export default function CreateGameNight() {
  const { groupId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [groupMembers, setGroupMembers] = useState([]);
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [guests, setGuests] = useState([]); // Array of strings (names)
  const [nightName, setNightName] = useState(`Game Night - ${new Date().toLocaleDateString()}`);

  useEffect(() => {
    const fetchMembers = async () => {
      const res = await axios.get(`/api/groups/${groupId}/members`);
      setGroupMembers(res.data);
      setSelectedMembers(res.data.map(m => m.id)); // Default: everyone in group is present
    };
    fetchMembers();
  }, [groupId]);

  const handleCreateNight = async () => {
    try {
      const payload = {
        name: nightName,
        group_id: groupId,
        created_by: user.id,
        played_at: new Date(),
        // Combine real users and manual guest entries
        attendees: [
          ...selectedMembers.map(id => ({ user_id: id })),
          ...guests.map(name => ({ guest_name: name }))
        ]
      };
      
      const { data } = await axios.post('/api/game-nights', payload);
      toast.success("Game Night Started!");
      // Redirect to the specific Page for this Night to log games
      navigate(`/game-nights/${data.game_night_id}`);
    } catch (err) {
      toast.error("Failed to start game night");
    }
  };

  return (
    <div className="page container">
      <h1>Plan Game Night 🍻</h1>
      <div className="card">
        <label>Night Name</label>
        <input className="input" value={nightName} onChange={e => setNightName(e.target.value)} />
        
        <h3 style={{ marginTop: '20px' }}>Who is here?</h3>
        {groupMembers.map(m => (
          <div key={m.id} className="stat-row">
            <span>{m.username}</span>
            <input type="checkbox" checked={selectedMembers.includes(m.id)} 
              onChange={() => setSelectedMembers(prev => prev.includes(m.id) ? prev.filter(x => x !== m.id) : [...prev, m.id])} />
          </div>
        ))}

        <div className="divider-line" />
        <label>Add Guests (Manual)</label>
        <div className="input-wrapper">
           <input className="input" placeholder="Guest Name" id="guestInput" />
           <button className="btn btn-subtle" onClick={() => {
             const val = document.getElementById('guestInput').value;
             if(val) { setGuests([...guests, val]); document.getElementById('guestInput').value = ''; }
           }}>Add</button>
        </div>
        <div style={{ marginTop: '10px' }}>{guests.map((g, i) => <span key={i} className="feature-pill">{g}</span>)}</div>

        <button className="btn btn-primary" style={{ width: '100%', marginTop: '30px' }} onClick={handleCreateNight}>
          Start Game Night
        </button>
      </div>
    </div>
  );
}