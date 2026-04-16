import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Toast from '../components/Toast';
import useToast from '../hooks/useToast';

const SuperAdmin = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState(null);
  const [clubs, setClubs] = useState([]);
  const [users, setUsers] = useState([]);
  const [gymnasts, setGymnasts] = useState([]);
  const [selectedClub, setSelectedClub] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const [gymnastSearchTerm, setGymnastSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [userPage, setUserPage] = useState(1);
  const [gymnastPage, setGymnastPage] = useState(1);
  const { toast, showToast, dismissToast } = useToast();
  // Set password modal state
  const [setPasswordModal, setSetPasswordModal] = useState(null); // { userId, userEmail }
  const [setPasswordValue, setSetPasswordValue] = useState('');
  const [setPasswordWorking, setSetPasswordWorking] = useState(false);
  // Reset password result modal state
  const [tempPasswordModal, setTempPasswordModal] = useState(null); // temporary password string

  useEffect(() => {
    fetchStats();
    fetchClubs();
  }, []);

  const fetchStats = async () => {
    try {
      const response = await axios.get('/api/super-admin/stats');
      setStats(response.data);
    } catch (error) {
      console.error('Failed to fetch stats:', error);
      setError('Failed to load statistics');
    }
  };

  const fetchClubs = async () => {
    try {
      const response = await axios.get('/api/super-admin/clubs');
      setClubs(response.data);
    } catch (error) {
      console.error('Failed to fetch clubs:', error);
      setError('Failed to load clubs');
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async (page = 1, search = '') => {
    try {
      const response = await axios.get('/api/super-admin/users', {
        params: { page, limit: 20, search }
      });
      setUsers(response.data);
    } catch (error) {
      console.error('Failed to fetch users:', error);
      setError('Failed to load users');
    }
  };

  const fetchGymnasts = async (page = 1, search = '') => {
    try {
      const response = await axios.get('/api/super-admin/gymnasts', {
        params: { page, limit: 20, search }
      });
      setGymnasts(response.data);
    } catch (error) {
      console.error('Failed to fetch gymnasts:', error);
      setError('Failed to load gymnasts');
    }
  };

  const handleClubSelect = async (clubId) => {
    try {
      const response = await axios.get(`/api/super-admin/clubs/${clubId}`);
      setSelectedClub(response.data);
    } catch (error) {
      console.error('Failed to fetch club details:', error);
      setError('Failed to load club details');
    }
  };

  const handleUserRoleUpdate = async (userId, newRole) => {
    try {
      await axios.patch(`/api/super-admin/users/${userId}`, { role: newRole });
      fetchUsers(userPage, userSearchTerm);
      setError(null);
    } catch (error) {
      console.error('Failed to update user role:', error);
      setError('Failed to update user role');
    }
  };

  const handleGymnastStatusUpdate = async (gymnastId, archived, reason = '') => {
    try {
      await axios.patch(`/api/super-admin/gymnasts/${gymnastId}`, { 
        archived, 
        archiveReason: reason 
      });
      fetchGymnasts(gymnastPage, gymnastSearchTerm);
      setError(null);
    } catch (error) {
      console.error('Failed to update gymnast status:', error);
      setError('Failed to update gymnast status');
    }
  };

  const handleResetPassword = async (userId) => {
    try {
      const response = await axios.post(`/api/super-admin/users/${userId}/reset-password`);
      setTempPasswordModal(response.data.temporaryPassword);
    } catch (error) {
      console.error('Failed to reset password:', error);
      setError('Failed to reset password');
    }
  };

  const openSetPassword = (userId, userEmail) => {
    setSetPasswordModal({ userId, userEmail });
    setSetPasswordValue('');
  };

  const handleSetPasswordConfirm = async () => {
    if (!setPasswordModal) return;
    if (setPasswordValue.length < 6) {
      showToast('Password must be at least 6 characters long.', 'error');
      return;
    }
    setSetPasswordWorking(true);
    try {
      await axios.post(`/api/super-admin/users/${setPasswordModal.userId}/set-password`, {
        password: setPasswordValue,
      });
      showToast('Password updated successfully!', 'success');
      setSetPasswordModal(null);
      setSetPasswordValue('');
    } catch (error) {
      console.error('Failed to set password:', error);
      setError('Failed to set password');
    } finally {
      setSetPasswordWorking(false);
    }
  };

  const handleClubEdit = async (clubId) => {
    // TODO: Implement club editing functionality
    showToast('Club editing functionality will be implemented', 'warning');
  };

  const handleClubConnectAs = async (clubId) => {
    // TODO: Implement connect-as functionality
    showToast('Connect-as functionality will be implemented', 'warning');
  };

  const handleClubDelete = async (clubId) => {
    if (window.confirm('Are you sure you want to delete this club? This action cannot be undone.')) {
      try {
        await axios.delete(`/api/super-admin/clubs/${clubId}`);
        fetchClubs();
        setError(null);
        showToast('Club deleted successfully', 'success');
      } catch (error) {
        console.error('Failed to delete club:', error);
        setError('Failed to delete club');
      }
    }
  };

  const handleUserEdit = async (userId) => {
    // TODO: Implement user editing functionality
    showToast('User editing functionality will be implemented', 'warning');
  };

  const handleUserDelete = async (userId) => {
    if (window.confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
      try {
        await axios.delete(`/api/super-admin/users/${userId}`);
        fetchUsers(userPage, userSearchTerm);
        setError(null);
        showToast('User deleted successfully', 'success');
      } catch (error) {
        console.error('Failed to delete user:', error);
        setError('Failed to delete user');
      }
    }
  };

  const handleGlobalEmailToggle = async (e) => {
    const enabled = e.target.checked;
    try {
      await axios.post('/api/super-admin/settings/email', {
        globalEmailEnabled: enabled
      });
      // Refresh stats to get updated email setting
      await fetchStats();
    } catch (error) {
      console.error('Failed to update email settings:', error);
      setError('Failed to update email settings');
    }
  };

  useEffect(() => {
    if (activeTab === 'users') {
      fetchUsers(userPage, userSearchTerm);
    }
  }, [activeTab, userPage, userSearchTerm]);

  useEffect(() => {
    if (activeTab === 'gymnasts') {
      fetchGymnasts(gymnastPage, gymnastSearchTerm);
    }
  }, [activeTab, gymnastPage, gymnastSearchTerm]);

  if (loading) {
    return (
      <div className="container">
        <div className="loading">Loading Super Admin Portal...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container">
        <div className="alert alert-danger">{error}</div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="page-header">
        <h1>Super Admin Portal</h1>
        <p>Manage all clubs, users, and provide support</p>
      </div>

      {/* Navigation Tabs */}
      <div className="admin-tabs">
        <button
          className={`tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          Overview
        </button>
        <button
          className={`tab-btn ${activeTab === 'clubs' ? 'active' : ''}`}
          onClick={() => setActiveTab('clubs')}
        >
          Clubs
        </button>
        <button
          className={`tab-btn ${activeTab === 'users' ? 'active' : ''}`}
          onClick={() => setActiveTab('users')}
        >
          Users
        </button>
        <button
          className={`tab-btn ${activeTab === 'settings' ? 'active' : ''}`}
          onClick={() => setActiveTab('settings')}
        >
          Settings
        </button>
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && stats && (
        <div className="admin-overview">
          <div className="stats-grid">
            <div className="stat-card">
              <h3>{stats.totalClubs}</h3>
              <p>Total Clubs</p>
            </div>
            <div className="stat-card">
              <h3>{stats.totalUsers}</h3>
              <p>Total Users</p>
            </div>
            <div className="stat-card">
              <h3>{stats.totalGymnasts}</h3>
              <p>Total Gymnasts</p>
            </div>
            <div className="stat-card">
              <h3>{stats.activeGymnasts}</h3>
              <p>Active Gymnasts</p>
            </div>
            <div className="stat-card">
              <h3>{stats.totalLevels}</h3>
              <p>Total Levels</p>
            </div>
            <div className="stat-card">
              <h3>{stats.totalSkills}</h3>
              <p>Total Skills</p>
            </div>
          </div>

          <div className="recent-activity">
            <h3>Recent Activity (Last 7 Days)</h3>
            <div className="activity-list">
              {stats.recentActivity.map((user, index) => (
                <div key={index} className="activity-item">
                  <div className="activity-user">
                    <strong>{user.firstName} {user.lastName}</strong>
                    <span className="text-muted">({user.club.name})</span>
                  </div>
                  <div className="activity-time">
                    Last login: {new Date(user.lastLoginAt).toLocaleDateString()}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Clubs Tab */}
      {activeTab === 'clubs' && (
        <div className="admin-clubs">
          <div className="search-controls">
            <input
              type="text"
              placeholder="Search clubs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="form-control"
            />
          </div>

          <div className="table-responsive">
            <table className="table table-striped">
              <thead>
                <tr>
                  <th>Club Name</th>
                  <th>Email</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {clubs && clubs.length > 0 ? clubs
                  .filter(club => 
                    club.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    club.email?.toLowerCase().includes(searchTerm.toLowerCase())
                  )
                  .map(club => (
                    <tr key={club.id}>
                      <td>
                        <strong>{club.name}</strong>
                        <br />
                        <small className="text-muted">
                          {club._count.users} users, {club._count.gymnasts} gymnasts, {club._count.levels} levels
                        </small>
                      </td>
                      <td>{club.email || <span className="text-muted">No email</span>}</td>
                      <td>
                        <div className="btn-group" role="group">
                          <button
                            className="btn btn-outline btn-sm"
                            onClick={() => handleClubEdit(club.id)}
                            title="Edit Club"
                          >
                            Edit
                          </button>
                          <button
                            className="btn btn-outline btn-sm"
                            onClick={() => handleClubConnectAs(club.id)}
                            title="Connect as Club Admin"
                          >
                            Connect As
                          </button>
                          <button
                            className="btn btn-outline btn-sm btn-danger"
                            onClick={() => handleClubDelete(club.id)}
                            title="Delete Club"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan="3" className="text-center">
                        <p>No clubs found</p>
                      </td>
                    </tr>
                  )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Users Tab */}
      {activeTab === 'users' && (
        <div className="admin-users">
          <div className="search-controls">
            <input
              type="text"
              placeholder="Search users..."
              value={userSearchTerm}
              onChange={(e) => {
                setUserSearchTerm(e.target.value);
                setUserPage(1);
              }}
              className="form-control"
            />
          </div>

          <div className="users-table">
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Club</th>
                  <th>Gymnasts</th>
                  <th>Last Login</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.users?.map(user => (
                  <tr key={user.id}>
                    <td>{user.firstName} {user.lastName}</td>
                    <td>{user.email}</td>
                    <td>
                      <select
                        value={user.role}
                        onChange={(e) => handleUserRoleUpdate(user.id, e.target.value)}
                        className="form-control form-control-sm"
                      >
                        <option value="CLUB_ADMIN">Club Admin</option>
                        <option value="COACH">Coach</option>
                        <option value="ADULT">Adult</option>
                        <option value="GYMNAST">Gymnast</option>
                        <option value="SUPER_ADMIN">Super Admin</option>
                      </select>
                    </td>
                    <td>{user.club?.name || 'N/A'}</td>
                    <td>{user._count?.gymnasts || 0}</td>
                    <td>{user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleDateString() : 'Never'}</td>
                    <td>
                      <div className="btn-group" role="group">
                        <button
                          className="btn btn-outline btn-sm"
                          onClick={() => handleUserEdit(user.id)}
                          title="Edit User"
                        >
                          Edit
                        </button>
                        <button
                          className="btn btn-outline btn-sm"
                          onClick={() => handleResetPassword(user.id)}
                          title="Reset Password (Generate Temporary)"
                        >
                          Reset Password
                        </button>
                        <button
                          className="btn btn-outline btn-sm"
                          onClick={() => openSetPassword(user.id, user.email)}
                          title="Set Password (Manual)"
                        >
                          Set Password
                        </button>
                        <button
                          className="btn btn-outline btn-sm btn-danger"
                          onClick={() => handleUserDelete(user.id)}
                          title="Delete User"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination */}
            {users.pagination && (
              <div className="pagination">
                <button
                  className="btn btn-outline btn-sm"
                  disabled={userPage === 1}
                  onClick={() => setUserPage(userPage - 1)}
                >
                  Previous
                </button>
                <span>Page {userPage} of {users.pagination.pages}</span>
                <button
                  className="btn btn-outline btn-sm"
                  disabled={userPage === users.pagination.pages}
                  onClick={() => setUserPage(userPage + 1)}
                >
                  Next
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Settings Tab */}
      {activeTab === 'settings' && (
        <div className="admin-settings">
          <div className="card">
            <div className="card-header">
              <h3>Email Configuration</h3>
              <p className="text-muted">Configure email settings for all clubs</p>
            </div>
            <div className="card-body">
              <div className="form-group">
                <label className="form-label">
                  <input
                    type="checkbox"
                    id="globalEmailEnabled"
                    checked={stats?.globalEmailEnabled || false}
                    onChange={handleGlobalEmailToggle}
                    style={{ marginRight: '0.5rem' }}
                  />
                  Enable Email Notifications Globally
                </label>
                <div className="text-muted small">
                  When enabled, all clubs can send emails for password resets, invitations, and certificate notifications. 
                  When disabled, emails will be logged to the console for testing purposes.
                </div>
              </div>
              
              <div className="alert alert-info">
                <strong>Email Features:</strong>
                <ul style={{ marginTop: '0.5rem', marginBottom: 0 }}>
                  <li>Password reset emails</li>
                  <li>User invitation emails</li>
                  <li>Guardian invitation emails</li>
                  <li>Certificate award notifications</li>
                  <li>Welcome emails for new users</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Gymnasts Tab - Removed */}
      {false && (
        <div className="admin-gymnasts">
          <div className="search-controls">
            <input
              type="text"
              placeholder="Search gymnasts..."
              value={gymnastSearchTerm}
              onChange={(e) => {
                setGymnastSearchTerm(e.target.value);
                setGymnastPage(1);
              }}
              className="form-control"
            />
          </div>

          <div className="gymnasts-table">
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Club</th>
                  <th>Guardians</th>
                  <th>Level Progress</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {gymnasts.gymnasts?.map(gymnast => (
                  <tr key={gymnast.id}>
                    <td>{gymnast.firstName} {gymnast.lastName}</td>
                    <td>{gymnast.club?.name || 'N/A'}</td>
                    <td>{gymnast.guardians?.length || 0}</td>
                    <td>
                      {gymnast.levelProgress?.length > 0 ? (
                        <span className="badge badge-success">
                          {gymnast.levelProgress.filter(lp => lp.status === 'COMPLETED').length} completed
                        </span>
                      ) : (
                        <span className="badge badge-secondary">Not started</span>
                      )}
                    </td>
                    <td>
                      <span className={`badge ${gymnast.archived ? 'badge-warning' : 'badge-success'}`}>
                        {gymnast.archived ? 'Archived' : 'Active'}
                      </span>
                    </td>
                    <td>
                      <button
                        className={`btn btn-sm ${gymnast.archived ? 'btn-success' : 'btn-warning'}`}
                        onClick={() => handleGymnastStatusUpdate(gymnast.id, !gymnast.archived)}
                      >
                        {gymnast.archived ? 'Restore' : 'Archive'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination */}
            {gymnasts.pagination && (
              <div className="pagination">
                <button
                  className="btn btn-outline btn-sm"
                  disabled={gymnastPage === 1}
                  onClick={() => setGymnastPage(gymnastPage - 1)}
                >
                  Previous
                </button>
                <span>Page {gymnastPage} of {gymnasts.pagination.pages}</span>
                <button
                  className="btn btn-outline btn-sm"
                  disabled={gymnastPage === gymnasts.pagination.pages}
                  onClick={() => setGymnastPage(gymnastPage + 1)}
                >
                  Next
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Club Details Modal */}
      {selectedClub && (
        <div className="modal-overlay" onClick={() => setSelectedClub(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{selectedClub.name} - Detailed View</h3>
              <button
                className="btn btn-outline btn-sm"
                onClick={() => setSelectedClub(null)}
              >
                ×
              </button>
            </div>
            
            <div className="modal-body">
              <div className="club-details-grid">
                <div className="detail-section">
                  <h4>Club Information</h4>
                  <p><strong>Email:</strong> {selectedClub.email || 'N/A'}</p>
                  <p><strong>Phone:</strong> {selectedClub.phone || 'N/A'}</p>
                  <p><strong>Address:</strong> {selectedClub.address || 'N/A'}</p>
                  <p><strong>Email Enabled:</strong> {selectedClub.emailEnabled ? 'Yes' : 'No'}</p>
                </div>

                <div className="detail-section">
                  <h4>Users ({selectedClub.users.length})</h4>
                  <div className="users-list">
                    {selectedClub.users.map(user => (
                      <div key={user.id} className="user-item">
                        <span>{user.firstName} {user.lastName}</span>
                        <span className="badge badge-secondary">{user.role}</span>
                        <span className="text-muted">({user._count.gymnasts} gymnasts)</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="detail-section">
                  <h4>Gymnasts ({selectedClub.gymnasts.length})</h4>
                  <div className="gymnasts-list">
                    {selectedClub.gymnasts.slice(0, 10).map(gymnast => (
                      <div key={gymnast.id} className="gymnast-item">
                        <span>{gymnast.firstName} {gymnast.lastName}</span>
                        <span className={`badge ${gymnast.archived ? 'badge-warning' : 'badge-success'}`}>
                          {gymnast.archived ? 'Archived' : 'Active'}
                        </span>
                      </div>
                    ))}
                    {selectedClub.gymnasts.length > 10 && (
                      <p className="text-muted">... and {selectedClub.gymnasts.length - 10} more</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Set Password Modal */}
      {setPasswordModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
          onClick={() => setSetPasswordModal(null)}>
          <div style={{ background: '#fff', borderRadius: 8, padding: '1.5rem', maxWidth: 400, width: '100%', boxShadow: '0 8px 40px rgba(0,0,0,0.18)' }}
            onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 0.5rem', fontSize: '1rem' }}>Set password for {setPasswordModal.userEmail}</h3>
            <p style={{ margin: '0 0 1rem', fontSize: '0.85rem', color: '#666' }}>Password must be at least 6 characters long.</p>
            <input
              type="password"
              className="form-control"
              placeholder="New password"
              value={setPasswordValue}
              onChange={e => setSetPasswordValue(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleSetPasswordConfirm(); if (e.key === 'Escape') setSetPasswordModal(null); }}
              autoFocus
              style={{ marginBottom: '1rem' }}
            />
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button className="btn btn-outline btn-sm" onClick={() => setSetPasswordModal(null)}>Cancel</button>
              <button className="btn btn-sm" style={{ background: '#2980b9', color: '#fff', border: 'none', padding: '0.4rem 0.8rem', borderRadius: 4, cursor: 'pointer' }} disabled={setPasswordWorking} onClick={handleSetPasswordConfirm}>
                {setPasswordWorking ? 'Saving...' : 'Set Password'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Temporary Password Modal */}
      {tempPasswordModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
          onClick={() => setTempPasswordModal(null)}>
          <div style={{ background: '#fff', borderRadius: 8, padding: '1.5rem', maxWidth: 400, width: '100%', boxShadow: '0 8px 40px rgba(0,0,0,0.18)' }}
            onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 0.75rem', fontSize: '1rem' }}>Temporary Password</h3>
            <p style={{ margin: '0 0 0.5rem', fontSize: '0.85rem' }}>Send this securely to the user:</p>
            <div style={{ background: '#f4f4f4', borderRadius: 4, padding: '0.6rem 0.9rem', fontFamily: 'monospace', fontSize: '1rem', marginBottom: '1rem', wordBreak: 'break-all' }}>
              {tempPasswordModal}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn btn-outline btn-sm" onClick={() => setTempPasswordModal(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {toast && <Toast message={toast.message} type={toast.type} onDismiss={dismissToast} />}
    </div>
  );
};

export default SuperAdmin;

