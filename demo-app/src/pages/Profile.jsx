import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function Profile() {
  const { user, isAuthenticated, updateProfile, logout } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [saved, setSaved] = useState(false);

  if (!isAuthenticated) {
    return (
      <div className="profile-page" data-testid="profile-page">
        <div className="glass-card" style={{ textAlign: 'center', padding: '3rem' }}>
          <h2>Please Log In</h2>
          <p>You need to be logged in to view your profile.</p>
          <button
            className="primary-btn"
            onClick={() => navigate('/login')}
            id="profile-login-btn"
            data-testid="profile-login-btn"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  const handleSave = (e) => {
    e.preventDefault();
    updateProfile(name, email);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="profile-page" id="profile-page" data-testid="profile-page">
      <h1 className="page-title" data-testid="profile-title">My Profile</h1>

      <div className="profile-layout">
        <div className="profile-card glass-card">
          <div className="profile-avatar" data-testid="profile-avatar">
            {user.name?.charAt(0)?.toUpperCase() || 'U'}
          </div>
          <h2 className="profile-name" data-testid="profile-display-name">{user.name}</h2>
          <p className="profile-email" data-testid="profile-display-email">{user.email}</p>
        </div>

        <div className="profile-edit glass-card">
          <h2>Edit Profile</h2>
          <form onSubmit={handleSave} id="profile-form" data-testid="profile-form">
            <div className="form-group">
              <label htmlFor="profile-name">Name</label>
              <input
                type="text"
                id="profile-name"
                data-testid="profile-name-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="profile-email">Email</label>
              <input
                type="email"
                id="profile-email"
                data-testid="profile-email-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <button
              type="submit"
              className="primary-btn save-btn"
              id="save-profile"
              data-testid="save-profile"
            >
              Save Changes
            </button>

            {saved && (
              <div className="save-success" data-testid="save-success">
                ✓ Profile updated successfully!
              </div>
            )}
          </form>

          <div className="profile-divider" />

          <button
            className="danger-btn"
            onClick={handleLogout}
            id="profile-logout"
            data-testid="profile-logout"
          >
            Log Out
          </button>
        </div>
      </div>
    </div>
  );
}

export default Profile;
