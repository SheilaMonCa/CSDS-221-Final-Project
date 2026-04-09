import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';

export default function GroupDetail() {
  const { id } = useParams();
  const [members, setMembers] = useState([]);

  useEffect(() => {
    const fetchMembers = async () => {
      try {
        const res = await axios.get(`/api/groups/${id}/members`);
        setMembers(res.data);
      } catch (err) {
        console.error("Error fetching members", err);
      }
    };
    fetchMembers();
  }, [id]);

  return (
    <div className="container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div>
          <Link to="/groups" style={{ color: 'var(--primary)', fontSize: '14px' }}>← Back to Groups</Link>
          <h1 style={{ marginTop: '8px' }}>Group Details</h1>
        </div>
        <Link to={`/groups/${id}/gamenight/new`} className="btn btn-primary">
          + Log Game Night
        </Link>
      </div>

      <div className="card">
        <h3>Members</h3>
        <ul style={{ listStyle: 'none', marginTop: '16px' }}>
          {members.map(member => (
            <li key={member.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
              {member.username}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}