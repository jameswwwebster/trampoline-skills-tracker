import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import apiClient from '../utils/apiInterceptor';
import { useAuth } from '../contexts/AuthContext';

const Users = () => {
  const [users, setUsers] = useState([]);
  const [gymnasts, setGymnasts] = useState([]);
  const [customFields, setCustomFields] = useState([]);
  const [userCustomFieldValues, setUserCustomFieldValues] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [editingRole, setEditingRole] = useState(null);
  const [editingProfile, setEditingProfile] = useState(null);
  const [editingCustomFields, setEditingCustomFields] = useState(null);
  const [addingEmail, setAddingEmail] = useState(null);
  const [newRole, setNewRole] = useState('');
  const [profileForm, setProfileForm] = useState({ firstName: '', lastName: '', email: '' });
  const [customFieldForm, setCustomFieldForm] = useState({});
  const [emailForm, setEmailForm] = useState('');
  const [archivingUser, setArchivingUser] = useState(null);
  const [archiveReason, setArchiveReason] = useState('');
  const [deletingUser, setDeletingUser] = useState(null);
  const [showArchived, setShowArchived] = useState(false);

  const { user, isClubAdmin } = useAuth();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [usersResponse, gymnastsResponse, customFieldsResponse] = await Promise.all([
          apiClient.get(`/api/users?includeArchived=${showArchived}`),
          apiClient.get('/api/gymnasts?includeArchived=true'),
          apiClient.get('/api/user-custom-fields')
        ]);
        setUsers(usersResponse.data);
        setGymnasts(gymnastsResponse.data);
        setCustomFields(customFieldsResponse.data);
        
        // Extract custom field values from the user objects (now included in the response)
        const customFieldValuesMap = {};
        usersResponse.data.forEach(userData => {
          customFieldValuesMap[userData.id] = userData.customFieldValues || [];
        });
        
        setUserCustomFieldValues(customFieldValuesMap);
        
      } catch (error) {
        console.error('Failed to fetch data:', error);
        setError('Failed to load data');
      } finally {
        setLoading(false);
      }
    };

    if (isClubAdmin) {
      fetchData();
    } else {
      setError('Access denied. This page is only available for club administrators.');
      setLoading(false);
    }
  }, [isClubAdmin, showArchived]);

  // Handle URL parameters for filtering
  useEffect(() => {
    const roleParam = searchParams.get('role');
    const searchParam = searchParams.get('search');
    
    if (roleParam) {
      setRoleFilter(roleParam);
    }
    if (searchParam) {
      setSearchTerm(searchParam);
    }
  }, [searchParams]);

  const handleRoleChange = async (userId, role) => {
    try {
      setError(null);
      setSuccess(null);
      
      const response = await apiClient.put(`/api/users/${userId}/role`, { role });
      
      // Update the users list with the updated user
      setUsers(prev => prev.map(u => 
        u.id === userId ? response.data.user : u
      ));
      
      setSuccess(`User role updated to ${getRoleDisplay(role)} successfully!`);
      setEditingRole(null);
      setNewRole('');
    } catch (error) {
      setError(error.response?.data?.error || 'Failed to update user role');
    }
  };

  const startRoleEditing = (userData) => {
    setEditingRole(userData.id);
    setNewRole(userData.role);
    setError(null);
    setSuccess(null);
  };

  const cancelRoleEditing = () => {
    setEditingRole(null);
    setNewRole('');
    setError(null);
    setSuccess(null);
  };

  const startProfileEditing = (userData) => {
    setEditingProfile(userData.id);
    setProfileForm({
      firstName: userData.firstName,
      lastName: userData.lastName,
      email: userData.email || ''
    });
    setError(null);
    setSuccess(null);
  };

  const cancelProfileEditing = () => {
    setEditingProfile(null);
    setProfileForm({ firstName: '', lastName: '', email: '' });
    setError(null);
    setSuccess(null);
  };

  const handleProfileUpdate = async (userId) => {
    try {
      setError(null);
      setSuccess(null);
      
      // Find the user/gymnast to determine the correct endpoint
      const targetUser = users.find(u => u.id === userId);
      let response;
      
      if (targetUser?.isGymnast) {
        // For gymnasts, only update firstName and lastName
        response = await apiClient.put(`/api/users/gymnast/${userId}/profile`, {
          firstName: profileForm.firstName,
          lastName: profileForm.lastName
        });
      } else {
        // For regular users, update all fields
        response = await apiClient.put(`/api/users/${userId}/profile`, profileForm);
      }
      
      // Update the users list with the updated user
      setUsers(prev => prev.map(u => 
        u.id === userId ? response.data.user : u
      ));
      
      setSuccess(`${targetUser?.isGymnast ? 'Gymnast' : 'User'} profile updated successfully!`);
      setEditingProfile(null);
      setProfileForm({ firstName: '', lastName: '', email: '' });
    } catch (error) {
      setError(error.response?.data?.error || 'Failed to update profile');
    }
  };

  const handlePasswordReset = async (userData) => {
    try {
      setError(null);
      setSuccess(null);
      
      const response = await apiClient.post(`/api/users/${userData.id}/reset-password`);
      
      // Show success message with email information
      setSuccess(`Password reset email sent to ${response.data.email}. ${response.data.name} will receive instructions to reset their password.`);

      // If in development mode, show additional information
      if (response.data.devInfo) {
        console.log('🔗 Password Reset URL (DEV MODE):', response.data.devInfo.resetUrl);
        setSuccess(`DEV MODE: Password reset email logged to console. Check server logs for the reset link. Email would be sent to: ${response.data.email}`);
      }
    } catch (error) {
      setError(error.response?.data?.error || 'Failed to send password reset email');
    }
  };

  const startEmailAdding = (userData) => {
    setAddingEmail(userData.id);
    setEmailForm('');
    setError(null);
    setSuccess(null);
  };

  const cancelEmailAdding = () => {
    setAddingEmail(null);
    setEmailForm('');
    setError(null);
    setSuccess(null);
  };

  const handleAddEmail = async (userId) => {
    try {
      setError(null);
      setSuccess(null);
      
      if (!emailForm || !emailForm.includes('@')) {
        setError('Please enter a valid email address');
        return;
      }

      // Find the user/gymnast to determine the correct endpoint
      const targetUser = users.find(u => u.id === userId);
      let response;
      
      if (targetUser?.isGymnast) {
        // For gymnasts, use the gymnast email endpoint
        response = await apiClient.put(`/api/users/gymnast/${userId}/email`, {
          email: emailForm
        });
      } else {
        // For regular users, use the user email endpoint
        response = await apiClient.put(`/api/users/${userId}/email`, {
          email: emailForm
        });
      }
      
      // Update the users list with the updated user
      setUsers(prev => prev.map(u => 
        u.id === userId ? { ...u, email: response.data.user.email } : u
      ));
      
      let successMessage = response.data.message;
      if (response.data.defaultPassword) {
        successMessage += ` Default password: ${response.data.defaultPassword} (must be changed on first login)`;
      }
      
      setSuccess(successMessage);
      setAddingEmail(null);
      setEmailForm('');
    } catch (error) {
      setError(error.response?.data?.error || 'Failed to add email address');
    }
  };

  const getRoleDisplay = (role) => {
    switch (role) {
      case 'CLUB_ADMIN':
        return 'Club Admin';
      case 'COACH':
        return 'Coach';
      case 'PARENT':
        return 'Parent';
      case 'GYMNAST':
        return 'Gymnast';
      default:
        return role;
    }
  };

  const getRoleBadgeClass = (role) => {
    switch (role) {
      case 'CLUB_ADMIN':
        return 'badge badge-primary';
      case 'COACH':
        return 'badge badge-secondary';
      case 'PARENT':
        return 'badge badge-success';
      case 'GYMNAST':
        return 'badge badge-info';
      default:
        return 'badge';
    }
  };

  const handleArchiveClick = (userData) => {
    setArchivingUser(userData);
    setArchiveReason('');
    setError(null);
    setSuccess(null);
  };

  const handleArchiveSubmit = async () => {
    try {
      setError(null);
      setSuccess(null);
      
      await apiClient.patch(`/api/users/${archivingUser.id}/archive`, {
        reason: archiveReason
      });
      
      setSuccess(`${archivingUser.firstName} ${archivingUser.lastName} has been archived`);
      setArchivingUser(null);
      setArchiveReason('');
      
      // Refresh users list
      const response = await apiClient.get('/api/users');
      setUsers(response.data);
    } catch (error) {
      console.error('Archive user error:', error);
      setError(error.response?.data?.error || 'Failed to archive user');
    }
  };

  const handleRestoreClick = async (userData) => {
    try {
      setError(null);
      setSuccess(null);
      
      await apiClient.patch(`/api/users/${userData.id}/restore`);
      
      setSuccess(`${userData.firstName} ${userData.lastName} has been restored`);
      
      // Refresh users list
      const response = await apiClient.get('/api/users');
      setUsers(response.data);
    } catch (error) {
      console.error('Restore user error:', error);
      setError(error.response?.data?.error || 'Failed to restore user');
    }
  };

  const handleDeleteClick = (userData) => {
    setDeletingUser(userData);
    setError(null);
    setSuccess(null);
  };

  const handleDeleteConfirm = async () => {
    try {
      setError(null);
      setSuccess(null);
      
      await apiClient.delete(`/api/users/${deletingUser.id}`, {
        data: { confirmDelete: true }
      });
      
      setSuccess(`${deletingUser.firstName} ${deletingUser.lastName} has been deleted permanently`);
      setDeletingUser(null);
      
      // Refresh users list
      const response = await apiClient.get('/api/users');
      setUsers(response.data);
    } catch (error) {
      console.error('Delete user error:', error);
      setError(error.response?.data?.error || 'Failed to delete user');
      setDeletingUser(null);
    }
  };

  // Add children information to users
  const usersWithChildren = users.map(userData => {
    if (userData.role === 'PARENT') {
      const children = gymnasts.filter(gymnast => 
        gymnast.guardians && gymnast.guardians.some(guardian => guardian.id === userData.id)
      );
      return { ...userData, children };
    }
    return userData;
  });

  // Filter users based on search term and role
  const filteredUsers = usersWithChildren.filter(userData => {
    const search = searchTerm.toLowerCase();
    const fullName = `${userData.firstName} ${userData.lastName}`.toLowerCase();
    const email = (userData.email || '').toLowerCase();
    const role = getRoleDisplay(userData.role).toLowerCase();
    
    // Role filter
    const matchesRole = !roleFilter || userData.role === roleFilter;
    
    // Search filter
    let matchesSearch = fullName.includes(search) || 
                       email.includes(search) || 
                       role.includes(search);
    
    // For parents, also search children names
    if (userData.role === 'PARENT' && userData.children) {
      const childrenNames = userData.children.map(child => 
        `${child.firstName} ${child.lastName}`.toLowerCase()
      ).join(' ');
      matchesSearch = matchesSearch || childrenNames.includes(search);
    }
    
    return matchesRole && (!search || matchesSearch);
  });

  const startCustomFieldEditing = (userData) => {
    setEditingCustomFields(userData.id);
    
    // Initialize form with existing values
    const existingValues = userCustomFieldValues[userData.id] || [];
    const initialForm = {};
    customFields.forEach(field => {
      const existingValue = existingValues.find(v => v.customFieldId === field.id);
      initialForm[field.id] = existingValue ? existingValue.value : '';
    });
    setCustomFieldForm(initialForm);
    setError(null);
    setSuccess(null);
  };

  const cancelCustomFieldEditing = () => {
    setEditingCustomFields(null);
    setCustomFieldForm({});
    setError(null);
    setSuccess(null);
  };

  const handleCustomFieldUpdate = async (userId) => {
    try {
      setError(null);
      setSuccess(null);
      
      // Prepare values object for bulk update
      const values = {};
      customFields.forEach(field => {
        const value = customFieldForm[field.id] || '';
        if (value !== '') {
          values[field.id] = value;
        }
      });
      
      // Update all custom field values at once
      const response = await apiClient.post(`/api/user-custom-fields/values/${userId}`, { values });
      
      // Update custom field values with the response data
      setUserCustomFieldValues(prev => ({
        ...prev,
        [userId]: response.data
      }));
      
      setSuccess('Custom fields updated successfully!');
      setEditingCustomFields(null);
      setCustomFieldForm({});
    } catch (error) {
      setError(error.response?.data?.error || 'Failed to update custom fields');
    }
  };

  const renderCustomFieldValue = (field, value) => {
    if (!value) return '-';
    
    switch (field.fieldType) {
      case 'BOOLEAN':
        return value === 'true' ? 'Yes' : 'No';
      case 'DATE':
        return new Date(value).toLocaleDateString();
      case 'MULTI_SELECT':
        return Array.isArray(value) ? value.join(', ') : value;
      default:
        return value;
    }
  };

  const renderCustomFieldInput = (field, value, onChange) => {
    switch (field.fieldType) {
      case 'TEXTAREA':
        return (
          <textarea
            value={value || ''}
            onChange={(e) => onChange(field.id, e.target.value)}
            className="form-control"
            style={{ fontSize: '0.875rem', minHeight: '60px' }}
            placeholder={field.name}
          />
        );
      case 'NUMBER':
        return (
          <input
            type="number"
            value={value || ''}
            onChange={(e) => onChange(field.id, e.target.value)}
            className="form-control"
            style={{ fontSize: '0.875rem' }}
            placeholder={field.name}
          />
        );
      case 'EMAIL':
        return (
          <input
            type="email"
            value={value || ''}
            onChange={(e) => onChange(field.id, e.target.value)}
            className="form-control"
            style={{ fontSize: '0.875rem' }}
            placeholder={field.name}
          />
        );
      case 'PHONE':
        return (
          <input
            type="tel"
            value={value || ''}
            onChange={(e) => onChange(field.id, e.target.value)}
            className="form-control"
            style={{ fontSize: '0.875rem' }}
            placeholder={field.name}
          />
        );
      case 'DATE':
        return (
          <input
            type="date"
            value={value || ''}
            onChange={(e) => onChange(field.id, e.target.value)}
            className="form-control"
            style={{ fontSize: '0.875rem' }}
          />
        );
      case 'BOOLEAN':
        return (
          <select
            value={value || ''}
            onChange={(e) => onChange(field.id, e.target.value)}
            className="form-control"
            style={{ fontSize: '0.875rem' }}
          >
            <option value="">Select...</option>
            <option value="true">Yes</option>
            <option value="false">No</option>
          </select>
        );
      case 'DROPDOWN':
        return (
          <select
            value={value || ''}
            onChange={(e) => onChange(field.id, e.target.value)}
            className="form-control"
            style={{ fontSize: '0.875rem' }}
          >
            <option value="">Select...</option>
            {field.options?.map(option => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        );
      default:
        return (
          <input
            type="text"
            value={value || ''}
            onChange={(e) => onChange(field.id, e.target.value)}
            className="form-control"
            style={{ fontSize: '0.875rem' }}
            placeholder={field.name}
          />
        );
    }
  };

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner"></div>
      </div>
    );
  }

  if (error && !isClubAdmin) {
    return (
      <div className="alert alert-error">
        {error}
      </div>
    );
  }

  return (
    <div>
      <div className="flex-between">
        <h1>Club Members</h1>
      </div>

      <div className="info-message">
        <p>Manage roles for all members in your club: <strong>{user?.club?.name}</strong></p>
        <p><small>Note: You cannot change your own role.</small></p>
      </div>

      {error && (
        <div className="alert alert-error">
          {error}
        </div>
      )}

      {success && (
        <div className="alert alert-success">
          {success}
        </div>
      )}

      {/* Search and Filter Controls */}
      <div className="card" style={{ marginBottom: '1rem' }}>
        <div className="card-header">
          <input
            type="text"
            placeholder="Search by name, email, role, or children's names..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="form-control"
            style={{ margin: 0 }}
          />
          
          {/* Filter Controls */}
          <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ minWidth: '140px' }}>
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="form-control"
                style={{ fontSize: '0.875rem', padding: '0.25rem 0.5rem' }}
              >
                <option value="">All Roles</option>
                <option value="PARENT">Parents Only</option>
                <option value="COACH">Coaches Only</option>
                <option value="CLUB_ADMIN">Club Admins Only</option>
                <option value="GYMNAST">Gymnasts Only</option>
              </select>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input
                type="checkbox"
                id="showArchived"
                checked={showArchived}
                onChange={(e) => setShowArchived(e.target.checked)}
                style={{ margin: 0 }}
              />
              <label htmlFor="showArchived" style={{ fontSize: '0.875rem', margin: 0 }}>
                Show archived users
              </label>
            </div>
            
            {(searchTerm || roleFilter) && (
              <button 
                onClick={() => {
                  setSearchTerm('');
                  setRoleFilter('');
                }}
                className="btn btn-xs btn-outline"
                style={{ fontSize: '0.75rem' }}
              >
                Clear filters
              </button>
            )}
          </div>
        </div>
      </div>

      {filteredUsers.length === 0 ? (
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">No Users Found</h3>
          </div>
          <div>
            {users.length === 0 ? (
              <>
                <p>No users have been registered in your club yet.</p>
                <p>Users can join by accepting invitations or registering directly.</p>
              </>
            ) : (
              <p>No users match your search criteria.</p>
            )}
          </div>
        </div>
      ) : (
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Club Members ({filteredUsers.length})</h3>
          </div>
          
          {/* Desktop Table */}
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Children</th>
                <th>Joined Date</th>
                {customFields.length > 0 && <th>Custom Fields</th>}
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map(userData => (
                <tr key={userData.id}>
                  <td>
                    {editingProfile === userData.id ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                        <input
                          type="text"
                          value={profileForm.firstName}
                          onChange={(e) => setProfileForm(prev => ({ ...prev, firstName: e.target.value }))}
                          className="form-control"
                          placeholder="First Name"
                          style={{ fontSize: '0.875rem' }}
                        />
                        <input
                          type="text"
                          value={profileForm.lastName}
                          onChange={(e) => setProfileForm(prev => ({ ...prev, lastName: e.target.value }))}
                          className="form-control"
                          placeholder="Last Name"
                          style={{ fontSize: '0.875rem' }}
                        />
                      </div>
                    ) : (
                      <div>
                        <strong style={{ opacity: userData.isArchived ? 0.6 : 1 }}>
                          {userData.firstName} {userData.lastName}
                        </strong>
                        {userData.id === user?.id && (
                          <span className="text-muted"> (You)</span>
                        )}
                        {userData.isArchived && (
                          <span className="badge badge-secondary" style={{ marginLeft: '0.5rem', fontSize: '0.7rem' }}>
                            Archived
                          </span>
                        )}
                      </div>
                    )}
                  </td>
                  <td>
                    {editingProfile === userData.id ? (
                      userData.isGymnast ? (
                        <span className="text-muted">No email</span>
                      ) : (
                        <input
                          type="email"
                          value={profileForm.email}
                          onChange={(e) => setProfileForm(prev => ({ ...prev, email: e.target.value }))}
                          className="form-control"
                          placeholder="Email"
                          style={{ fontSize: '0.875rem' }}
                        />
                      )
                    ) : addingEmail === userData.id ? (
                      <input
                        type="email"
                        value={emailForm}
                        onChange={(e) => setEmailForm(e.target.value)}
                        className="form-control"
                        placeholder="Enter email address"
                        style={{ fontSize: '0.875rem' }}
                      />
                    ) : (
                      userData.email || (userData.isGymnast ? <span className="text-muted">No email</span> : '-')
                    )}
                  </td>
                  <td>
                    {editingRole === userData.id ? (
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <select
                          value={newRole}
                          onChange={(e) => setNewRole(e.target.value)}
                          className="form-control"
                          style={{ width: 'auto', minWidth: '120px' }}
                        >
                          <option value="PARENT">Parent</option>
                          <option value="COACH">Coach</option>
                          <option value="CLUB_ADMIN">Club Admin</option>
                          <option value="GYMNAST">Gymnast</option>
                        </select>
                        <button
                          onClick={() => handleRoleChange(userData.id, newRole)}
                          className="btn btn-sm btn-primary"
                          disabled={newRole === userData.role}
                        >
                          Save
                        </button>
                        <button
                          onClick={cancelRoleEditing}
                          className="btn btn-sm btn-secondary"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <span className={getRoleBadgeClass(userData.role)}>
                        {getRoleDisplay(userData.role)}
                      </span>
                    )}
                  </td>
                  <td>
                    {userData.role === 'PARENT' && userData.children ? (
                      userData.children.length > 0 ? (
                        <div>
                          {userData.children.map(child => (
                            <div key={child.id}>
                              <Link 
                                to={`/gymnasts?highlight=${child.id}`}
                                className="text-link"
                              >
                                <small>{child.firstName} {child.lastName}</small>
                              </Link>
                              {child.isArchived && (
                                <span className="badge badge-secondary" style={{ marginLeft: '0.25rem', fontSize: '0.6rem' }}>
                                  Archived
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-muted">No children</span>
                      )
                    ) : (
                      <span className="text-muted">-</span>
                    )}
                  </td>
                  <td>
                    {new Date(userData.createdAt).toLocaleDateString()}
                  </td>
                  {customFields.length > 0 && (
                    <td>
                      {editingCustomFields === userData.id ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', minWidth: '200px' }}>
                          {customFields.map(field => {
                            const currentValue = customFieldForm[field.id] || '';
                            return (
                              <div key={field.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <label style={{ fontSize: '0.75rem', minWidth: '80px', margin: 0 }}>
                                  {field.name}:
                                </label>
                                {renderCustomFieldInput(field, currentValue, (fieldId, value) => {
                                  setCustomFieldForm(prev => ({ ...prev, [fieldId]: value }));
                                })}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div style={{ fontSize: '0.875rem' }}>
                          {customFields.map(field => {
                            const userValues = userCustomFieldValues[userData.id] || [];
                            const fieldValue = userValues.find(v => v.customFieldId === field.id)?.value;
                            return (
                              <div key={field.id} style={{ marginBottom: '0.25rem' }}>
                                <small style={{ fontWeight: 'bold' }}>{field.name}:</small>{' '}
                                <small>{renderCustomFieldValue(field, fieldValue)}</small>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </td>
                  )}
                  <td>
                    {userData.id !== user?.id && (
                      <div style={{ display: 'flex', gap: '0.125rem', flexWrap: 'wrap' }}>
                        {editingProfile === userData.id ? (
                          <>
                            <button
                              onClick={() => handleProfileUpdate(userData.id)}
                              className="btn-link-subtle btn-link-primary"
                              style={{ fontSize: '0.75rem', padding: '0.125rem 0.25rem' }}
                            >
                              Save
                            </button>
                            <button
                              onClick={cancelProfileEditing}
                              className="btn-link-subtle"
                              style={{ fontSize: '0.75rem', padding: '0.125rem 0.25rem' }}
                            >
                              Cancel
                            </button>
                          </>
                        ) : editingCustomFields === userData.id ? (
                          <>
                            <button
                              onClick={() => handleCustomFieldUpdate(userData.id)}
                              className="btn-link-subtle btn-link-primary"
                              style={{ fontSize: '0.75rem', padding: '0.125rem 0.25rem' }}
                            >
                              Save
                            </button>
                            <button
                              onClick={cancelCustomFieldEditing}
                              className="btn-link-subtle"
                              style={{ fontSize: '0.75rem', padding: '0.125rem 0.25rem' }}
                            >
                              Cancel
                            </button>
                          </>
                        ) : addingEmail === userData.id ? (
                          <>
                            <button
                              onClick={() => handleAddEmail(userData.id)}
                              className="btn-link-subtle btn-link-primary"
                              style={{ fontSize: '0.75rem', padding: '0.125rem 0.25rem' }}
                            >
                              Save
                            </button>
                            <button
                              onClick={cancelEmailAdding}
                              className="btn-link-subtle"
                              style={{ fontSize: '0.75rem', padding: '0.125rem 0.25rem' }}
                            >
                              Cancel
                            </button>
                          </>
                        ) : editingRole === userData.id ? (
                          <span className="text-muted" style={{ fontSize: '0.75rem' }}>Editing role...</span>
                        ) : (
                          <>
                            {!userData.isArchived && (
                              <>
                                <button
                                  onClick={() => startProfileEditing(userData)}
                                  className="btn-link-subtle"
                                  style={{ fontSize: '0.75rem', padding: '0.125rem 0.25rem' }}
                                  title="Edit Profile"
                                >
                                  Edit
                                </button>
                                {customFields.length > 0 && (
                                  <button
                                    onClick={() => startCustomFieldEditing(userData)}
                                    className="btn-link-subtle"
                                    style={{ fontSize: '0.75rem', padding: '0.125rem 0.25rem' }}
                                    title="Edit Custom Fields"
                                  >
                                    Fields
                                  </button>
                                )}
                                {!userData.email && (
                                  <button
                                    onClick={() => startEmailAdding(userData)}
                                    className="btn-link-subtle btn-link-success"
                                    style={{ fontSize: '0.75rem', padding: '0.125rem 0.25rem' }}
                                    title="Add Email"
                                  >
                                    + Email
                                  </button>
                                )}
                                {!userData.isGymnast && (
                                  <>
                                    <button
                                      onClick={() => startRoleEditing(userData)}
                                      className="btn-link-subtle"
                                      style={{ fontSize: '0.75rem', padding: '0.125rem 0.25rem' }}
                                      title="Change Role"
                                    >
                                      Role
                                    </button>
                                    <button
                                      onClick={() => handlePasswordReset(userData)}
                                      className="btn-link-subtle btn-link-danger"
                                      style={{ fontSize: '0.75rem', padding: '0.125rem 0.25rem' }}
                                      title="Reset Password"
                                    >
                                      Reset
                                    </button>
                                  </>
                                )}
                              </>
                            )}
                            {userData.isArchived ? (
                              <button
                                onClick={() => handleRestoreClick(userData)}
                                className="btn-link-subtle btn-link-success"
                                style={{ fontSize: '0.75rem', padding: '0.125rem 0.25rem' }}
                                title="Restore User"
                              >
                                Restore
                              </button>
                            ) : (
                              <button
                                onClick={() => handleArchiveClick(userData)}
                                className="btn-link-subtle btn-link-danger"
                                style={{ fontSize: '0.75rem', padding: '0.125rem 0.25rem' }}
                                title="Archive User"
                              >
                                Archive
                              </button>
                            )}
                            <button
                              onClick={() => handleDeleteClick(userData)}
                              className="btn-link-subtle btn-link-danger"
                              style={{ fontSize: '0.75rem', padding: '0.125rem 0.25rem' }}
                              title="Delete User"
                            >
                              Delete
                            </button>
                          </>
                        )}
                      </div>
                    )}
                    {userData.id === user?.id && (
                      <span className="text-muted">-</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Mobile Cards */}
          <div className="mobile-table-cards">
            {filteredUsers.map(userData => (
              <div key={userData.id} className="mobile-table-card">
                <div className="mobile-card-header">
                  <div className="mobile-card-title">
                    {editingProfile === userData.id ? (
                      <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '0.5rem' }}>
                        <input
                          type="text"
                          value={profileForm.firstName}
                          onChange={(e) => setProfileForm(prev => ({ ...prev, firstName: e.target.value }))}
                          className="form-control"
                          placeholder="First Name"
                          style={{ fontSize: '0.875rem' }}
                        />
                        <input
                          type="text"
                          value={profileForm.lastName}
                          onChange={(e) => setProfileForm(prev => ({ ...prev, lastName: e.target.value }))}
                          className="form-control"
                          placeholder="Last Name"
                          style={{ fontSize: '0.875rem' }}
                        />
                      </div>
                    ) : (
                      <div>
                        <span style={{ opacity: userData.isArchived ? 0.6 : 1 }}>
                          {userData.firstName} {userData.lastName}
                        </span>
                        {userData.id === user?.id && (
                          <span className="text-muted"> (You)</span>
                        )}
                        {userData.isArchived && (
                          <span className="badge badge-secondary" style={{ marginLeft: '0.5rem', fontSize: '0.7rem' }}>
                            Archived
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="mobile-card-actions">
                    {editingProfile === userData.id ? (
                      <div style={{ display: 'flex', gap: '0.125rem' }}>
                        <button
                          onClick={() => handleProfileUpdate(userData.id)}
                          className="btn-link-subtle btn-link-primary"
                          style={{ fontSize: '0.75rem', padding: '0.125rem 0.25rem' }}
                        >
                          Save
                        </button>
                        <button
                          onClick={cancelProfileEditing}
                          className="btn-link-subtle"
                          style={{ fontSize: '0.75rem', padding: '0.125rem 0.25rem' }}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : editingRole === userData.id ? (
                      <div style={{ display: 'flex', gap: '0.125rem' }}>
                        <button
                          onClick={() => handleRoleChange(userData.id, newRole)}
                          className="btn-link-subtle btn-link-primary"
                          style={{ fontSize: '0.75rem', padding: '0.125rem 0.25rem' }}
                          disabled={newRole === userData.role}
                        >
                          Save
                        </button>
                        <button
                          onClick={cancelRoleEditing}
                          className="btn-link-subtle"
                          style={{ fontSize: '0.75rem', padding: '0.125rem 0.25rem' }}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : addingEmail === userData.id ? (
                      <div style={{ display: 'flex', gap: '0.125rem' }}>
                        <button
                          onClick={() => handleAddEmail(userData.id)}
                          className="btn-link-subtle btn-link-primary"
                          style={{ fontSize: '0.75rem', padding: '0.125rem 0.25rem' }}
                        >
                          Save
                        </button>
                        <button
                          onClick={cancelEmailAdding}
                          className="btn-link-subtle"
                          style={{ fontSize: '0.75rem', padding: '0.125rem 0.25rem' }}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : userData.id !== user?.id ? (
                      <div style={{ display: 'flex', gap: '0.125rem', flexWrap: 'wrap' }}>
                        {!userData.isArchived && (
                          <>
                            <button
                              onClick={() => startProfileEditing(userData)}
                              className="btn-link-subtle"
                              style={{ fontSize: '0.75rem', padding: '0.125rem 0.25rem' }}
                            >
                              Edit
                            </button>
                            {customFields.length > 0 && (
                              <button
                                onClick={() => startCustomFieldEditing(userData)}
                                className="btn-link-subtle"
                                style={{ fontSize: '0.75rem', padding: '0.125rem 0.25rem' }}
                              >
                                Fields
                              </button>
                            )}
                            {!userData.email && (
                              <button
                                onClick={() => startEmailAdding(userData)}
                                className="btn-link-subtle btn-link-success"
                                style={{ fontSize: '0.75rem', padding: '0.125rem 0.25rem' }}
                              >
                                + Email
                              </button>
                            )}
                            {!userData.isGymnast && (
                              <>
                                <button
                                  onClick={() => startRoleEditing(userData)}
                                  className="btn-link-subtle"
                                  style={{ fontSize: '0.75rem', padding: '0.125rem 0.25rem' }}
                                >
                                  Role
                                </button>
                                <button
                                  onClick={() => handlePasswordReset(userData)}
                                  className="btn-link-subtle btn-link-danger"
                                  style={{ fontSize: '0.75rem', padding: '0.125rem 0.25rem' }}
                                >
                                  Reset
                                </button>
                              </>
                            )}
                          </>
                        )}
                        {userData.isArchived ? (
                          <button
                            onClick={() => handleRestoreClick(userData)}
                            className="btn-link-subtle btn-link-success"
                            style={{ fontSize: '0.75rem', padding: '0.125rem 0.25rem' }}
                          >
                            Restore
                          </button>
                        ) : (
                          <button
                            onClick={() => handleArchiveClick(userData)}
                            className="btn-link-subtle btn-link-danger"
                            style={{ fontSize: '0.75rem', padding: '0.125rem 0.25rem' }}
                          >
                            Archive
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteClick(userData)}
                          className="btn-link-subtle btn-link-danger"
                          style={{ fontSize: '0.75rem', padding: '0.125rem 0.25rem' }}
                        >
                          Delete
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>
                
                <div className="mobile-card-body">
                  <div className="mobile-card-row">
                    <span className="mobile-card-label">Email:</span>
                    <span className="mobile-card-value">
                      {editingProfile === userData.id ? (
                        userData.isGymnast ? (
                          <span className="text-muted">No email</span>
                        ) : (
                          <input
                            type="email"
                            value={profileForm.email}
                            onChange={(e) => setProfileForm(prev => ({ ...prev, email: e.target.value }))}
                            className="form-control"
                            placeholder="Email"
                            style={{ fontSize: '0.875rem' }}
                          />
                        )
                      ) : addingEmail === userData.id ? (
                        <input
                          type="email"
                          value={emailForm}
                          onChange={(e) => setEmailForm(e.target.value)}
                          className="form-control"
                          placeholder="Enter email address"
                          style={{ fontSize: '0.875rem' }}
                        />
                      ) : (
                        userData.email || (userData.isGymnast ? <span className="text-muted">No email</span> : '-')
                      )}
                    </span>
                  </div>
                  
                  <div className="mobile-card-row">
                    <span className="mobile-card-label">Role:</span>
                    <span className="mobile-card-value">
                      {editingRole === userData.id ? (
                        <select
                          value={newRole}
                          onChange={(e) => setNewRole(e.target.value)}
                          className="form-control"
                          style={{ width: '100%', maxWidth: '150px' }}
                        >
                          <option value="PARENT">Parent</option>
                          <option value="COACH">Coach</option>
                          <option value="CLUB_ADMIN">Club Admin</option>
                          <option value="GYMNAST">Gymnast</option>
                        </select>
                      ) : (
                        <span className={getRoleBadgeClass(userData.role)}>
                          {getRoleDisplay(userData.role)}
                        </span>
                      )}
                    </span>
                  </div>
                  
                  {userData.role === 'PARENT' && (
                    <div className="mobile-card-row">
                      <span className="mobile-card-label">Children:</span>
                      <span className="mobile-card-value">
                        {userData.children && userData.children.length > 0 ? (
                          <div>
                            {userData.children.map(child => (
                              <div key={child.id} style={{ fontSize: '0.9rem' }}>
                                <Link 
                                  to={`/gymnasts?highlight=${child.id}`}
                                  className="text-link"
                                >
                                  {child.firstName} {child.lastName}
                                </Link>
                                {child.isArchived && (
                                  <span className="badge badge-secondary" style={{ marginLeft: '0.25rem', fontSize: '0.6rem' }}>
                                    Archived
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="text-muted">No children</span>
                        )}
                      </span>
                    </div>
                  )}

                  <div className="mobile-card-row">
                    <span className="mobile-card-label">{userData.isGymnast ? 'Created' : 'Joined'}:</span>
                    <span className="mobile-card-value">
                      {new Date(userData.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  
                  {userData.isGymnast && userData.dateOfBirth && (
                    <div className="mobile-card-row">
                      <span className="mobile-card-label">Born:</span>
                      <span className="mobile-card-value">
                        {new Date(userData.dateOfBirth).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                  
                  {customFields.length > 0 && (
                    <div className="mobile-card-row">
                      <span className="mobile-card-label">Custom Fields:</span>
                      <span className="mobile-card-value">
                        {editingCustomFields === userData.id ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
                            {customFields.map(field => {
                              const currentValue = customFieldForm[field.id] || '';
                              return (
                                <div key={field.id}>
                                  <label style={{ fontSize: '0.875rem', fontWeight: 'bold', display: 'block' }}>
                                    {field.name}:
                                  </label>
                                  {renderCustomFieldInput(field, currentValue, (fieldId, value) => {
                                    setCustomFieldForm(prev => ({ ...prev, [fieldId]: value }));
                                  })}
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div style={{ fontSize: '0.875rem' }}>
                            {customFields.map(field => {
                              const userValues = userCustomFieldValues[userData.id] || [];
                              const fieldValue = userValues.find(v => v.customFieldId === field.id)?.value;
                              return (
                                <div key={field.id} style={{ marginBottom: '0.25rem' }}>
                                  <strong>{field.name}:</strong>{' '}
                                  {renderCustomFieldValue(field, fieldValue)}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Archive Modal */}
      {archivingUser && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>Archive User</h3>
            <p>Are you sure you want to archive <strong>{archivingUser.firstName} {archivingUser.lastName}</strong>?</p>
            <p>Archived users will be hidden from the main list but can be restored later.</p>
            
            <div className="form-group">
              <label>Reason for archiving (optional):</label>
              <input
                type="text"
                value={archiveReason}
                onChange={(e) => setArchiveReason(e.target.value)}
                className="form-control"
                placeholder="e.g., Left club, moved away, etc."
              />
            </div>
            
            <div className="modal-actions">
              <button onClick={handleArchiveSubmit} className="btn btn-warning">
                Archive User
              </button>
              <button onClick={() => setArchivingUser(null)} className="btn btn-secondary">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {deletingUser && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>Delete User</h3>
            <p>Are you sure you want to permanently delete <strong>{deletingUser.firstName} {deletingUser.lastName}</strong>?</p>
            <p className="text-danger">
              <strong>Warning:</strong> This action cannot be undone. Consider archiving instead.
            </p>
            
            <div className="modal-actions">
              <button onClick={handleDeleteConfirm} className="btn btn-danger">
                Delete Permanently
              </button>
              <button onClick={() => handleArchiveClick(deletingUser)} className="btn btn-warning">
                Archive Instead
              </button>
              <button onClick={() => setDeletingUser(null)} className="btn btn-secondary">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default Users; 