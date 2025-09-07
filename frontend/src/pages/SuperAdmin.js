import React, { useState, useEffect } from 'react';
import axios from 'axios';

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
      alert(`Temporary password: ${response.data.temporaryPassword}\n\nSend this securely to the user!`);
    } catch (error) {
      console.error('Failed to reset password:', error);
      setError('Failed to reset password');
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
          📊 Overview
        </button>
        <button
          className={`tab-btn ${activeTab === 'clubs' ? 'active' : ''}`}
          onClick={() => setActiveTab('clubs')}
        >
          🏢 Clubs
        </button>
        <button
          className={`tab-btn ${activeTab === 'users' ? 'active' : ''}`}
          onClick={() => setActiveTab('users')}
        >
          👥 Users
        </button>
        <button
          className={`tab-btn ${activeTab === 'gymnasts' ? 'active' : ''}`}
          onClick={() => setActiveTab('gymnasts')}
        >
          🤸 Gymnasts
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

          <div className="clubs-grid">
            {clubs && clubs.length > 0 ? clubs
              .filter(club => 
                club.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                club.email?.toLowerCase().includes(searchTerm.toLowerCase())
              )
              .map(club => (
                <div key={club.id} className="club-card">
                  <div className="club-header">
                    <h3>{club.name}</h3>
                    <button
                      className="btn btn-outline btn-sm"
                      onClick={() => handleClubSelect(club.id)}
                    >
                      View Details
                    </button>
                  </div>
                  
                  <div className="club-stats">
                    <div className="stat">
                      <span className="stat-number">{club._count.users}</span>
                      <span className="stat-label">Users</span>
                    </div>
                    <div className="stat">
                      <span className="stat-number">{club._count.gymnasts}</span>
                      <span className="stat-label">Gymnasts</span>
                    </div>
                    <div className="stat">
                      <span className="stat-number">{club._count.levels}</span>
                      <span className="stat-label">Levels</span>
                    </div>
                  </div>

                  <div className="club-info">
                    {club.email && <p><strong>Email:</strong> {club.email}</p>}
                    {club.phone && <p><strong>Phone:</strong> {club.phone}</p>}
                    <p><strong>Created:</strong> {new Date(club.createdAt).toLocaleDateString()}</p>
                  </div>

                  <div className="club-admins">
                    <h4>Club Admins:</h4>
                    {club.users && club.users.length > 0 ? club.users.map(admin => (
                      <div key={admin.id} className="admin-item">
                        <span>{admin.firstName} {admin.lastName}</span>
                        <span className="text-muted">({admin.email})</span>
                      </div>
                    )) : (
                      <p className="text-muted">No admins found</p>
                    )}
                  </div>
                </div>
              )) : (
                <div className="text-center">
                  <p>No clubs found</p>
                </div>
              )}
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
                        <option value="PARENT">Parent</option>
                        <option value="GYMNAST">Gymnast</option>
                        <option value="SYSTEM_ADMIN">System Admin</option>
                        <option value="SUPER_ADMIN">Super Admin</option>
                      </select>
                    </td>
                    <td>{user.club?.name || 'N/A'}</td>
                    <td>{user._count?.gymnasts || 0}</td>
                    <td>{user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleDateString() : 'Never'}</td>
                    <td>
                      <button
                        className="btn btn-outline btn-sm"
                        onClick={() => handleResetPassword(user.id)}
                        title="Reset Password"
                      >
                        🔑
                      </button>
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

      {/* Gymnasts Tab */}
      {activeTab === 'gymnasts' && (
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
                ✕
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
    </div>
  );
};

export default SuperAdmin;

