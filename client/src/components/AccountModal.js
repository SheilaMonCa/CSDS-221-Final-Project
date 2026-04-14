import { useState } from 'react';
import api from '../api'
import toast from 'react-hot-toast';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';
import EyeIcon from './EyeIcon';

// ─── Edit Profile Modal ───────────────────────────────────────────────────────
function EditModal({ onClose }) {
  const { user, refreshUser } = useAuth();

  const [editData, setEditData] = useState({
    username:    user.username,
    newPass:     '',
    confirmPass: '',
    currentPass: '',
  });

  const [needsReauth, setNeedsReauth] = useState(false);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew,     setShowNew]     = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [saving,      setSaving]      = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    const isChangingPass = editData.newPass !== '';

    // If changing password, ask for current password first before proceeding
    if (isChangingPass && !needsReauth) {
      setNeedsReauth(true);
      toast('Enter your current password to confirm changes.', { icon: '🔐' });
      return;
    }

    if (isChangingPass && editData.newPass !== editData.confirmPass) {
      toast.error('New passwords do not match.');
      return;
    }

    setSaving(true);
    try {
      // Re-authenticate before any sensitive change
      if (needsReauth) {
        const { error: signInErr } = await supabase.auth.signInWithPassword({
          email:    user.email,
          password: editData.currentPass,
        });
        if (signInErr) {
          toast.error('Incorrect current password.');
          setSaving(false);
          return;
        }
      }

      // Update password in Supabase Auth if provided
      if (isChangingPass) {
        const { error: authErr } = await supabase.auth.updateUser({
          password: editData.newPass,
        });
        if (authErr) {
          toast.error(authErr.message);
          setSaving(false);
          return;
        }
      }

      // Update username in public.users via Express API
      if (editData.username.trim() !== user.username) {
        await api.put(`/api/users/${user.id}`, { username: editData.username.trim() });
      }

      // Refresh context so navbar/header reflect changes immediately
      await refreshUser();
      toast.success('Profile updated!');
      onClose();
    } catch {
      toast.error('Update failed. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-card card">
        <h3>Update Profile</h3>
        <form onSubmit={handleSubmit}>

          <div className="form-group">
            <label>Username</label>
            <input
              className="input"
              value={editData.username}
              onChange={e => setEditData({ ...editData, username: e.target.value })}
            />
          </div>

          {/*
            ── EMAIL UPDATE — TEMPORARILY REMOVED ──────────────────────────────
            Supabase Auth requires the user to click a confirmation link in their
            inbox whenever an email change is requested. This is enforced at the
            Supabase platform level and cannot be disabled without a custom SMTP
            provider (e.g. Resend or SendGrid) and a verified sending domain —
            neither of which is practical within the scope of this class project.

            The free Supabase plan also caps outbound emails at 2/hour, making
            repeated testing during development painful.

            To re-enable email updating in the future:
              1. Set up a custom SMTP provider in Supabase →
                 Project Settings → Auth → SMTP Settings
              2. Verify a sending domain with that provider
              3. Optionally disable "Secure email change" in
                 Supabase → Authentication → Configuration
              4. Uncomment the field below and add isChangingEmail logic
                 back into handleSubmit (mirroring the password flow)

            <div className="form-group">
              <label>Email Address</label>
              <input
                className="input"
                type="email"
                value={editData.email}
                onChange={e => setEditData({ ...editData, email: e.target.value })}
              />
            </div>
          ────────────────────────────────────────────────────────────────────── */}

          <hr className="divider-line" />

          <div className="form-group">
            <label>
              New Password{' '}
              <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(optional)</span>
            </label>
            <div className="input-wrapper">
              <input
                className="input"
                type={showNew ? 'text' : 'password'}
                placeholder="Leave blank to keep current"
                value={editData.newPass}
                onChange={e => setEditData({ ...editData, newPass: e.target.value })}
              />
              <button type="button" className="eye-btn" onClick={() => setShowNew(v => !v)}>
                <EyeIcon visible={showNew} />
              </button>
            </div>
          </div>

          {editData.newPass && (
            <div className="form-group">
              <label>Confirm New Password</label>
              <div className="input-wrapper">
                <input
                  className="input"
                  type={showConfirm ? 'text' : 'password'}
                  value={editData.confirmPass}
                  onChange={e => setEditData({ ...editData, confirmPass: e.target.value })}
                  style={{
                    borderColor: editData.confirmPass && editData.confirmPass !== editData.newPass
                      ? 'var(--danger)' : undefined,
                  }}
                />
                <button type="button" className="eye-btn" onClick={() => setShowConfirm(v => !v)}>
                  <EyeIcon visible={showConfirm} />
                </button>
              </div>
              {editData.confirmPass && editData.confirmPass !== editData.newPass && (
                <span style={{ fontSize: '12px', color: 'var(--danger)', marginTop: '4px' }}>
                  Passwords do not match
                </span>
              )}
            </div>
          )}

          {needsReauth && (
            <div className="reauth-box">
              <p style={{ fontSize: 13, marginBottom: 10 }}>
                Confirm your current password to apply changes:
              </p>
              <div className="input-wrapper">
                <input
                  className="input"
                  type={showCurrent ? 'text' : 'password'}
                  placeholder="Current password"
                  required
                  value={editData.currentPass}
                  onChange={e => setEditData({ ...editData, currentPass: e.target.value })}
                />
                <button type="button" className="eye-btn" onClick={() => setShowCurrent(v => !v)}>
                  <EyeIcon visible={showCurrent} />
                </button>
              </div>
            </div>
          )}

          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving…' : needsReauth ? 'Confirm Changes' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Delete Account Modal ─────────────────────────────────────────────────────
function DeleteModal({ onClose }) {
  const { user, logoutLocal } = useAuth();
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    const tid = toast.loading('Deleting account…');
    try {
      // Server handles both DB anonymization AND Supabase Auth deletion
      // using the service role key — secret never touches the frontend
      await api.delete(`/api/users/${user.id}`);
      toast.success('Account deleted. See you around!', { id: tid });
      await logoutLocal();
    } catch {
      toast.error('Failed to delete account. Please try again.', { id: tid });
      setDeleting(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-card card">
        <h2 style={{ color: 'var(--danger)' }}>⚠️ Irreversible Action</h2>
        <p style={{ margin: '16px 0', color: 'var(--text-muted)' }}>
          Are you sure? Your account will be permanently deleted. Your game history
          will be anonymised so group stats remain intact.
        </p>
        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onClose} disabled={deleting}>
            Cancel
          </button>
          <button className="btn btn-danger" onClick={handleDelete} disabled={deleting}>
            {deleting ? 'Deleting…' : 'Yes, Delete Account'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Exported wrapper — Dashboard renders this with mode='edit' or 'delete' ───
export default function AccountModal({ mode, onClose }) {
  if (mode === 'edit')   return <EditModal   onClose={onClose} />;
  if (mode === 'delete') return <DeleteModal onClose={onClose} />;
  return null;
}