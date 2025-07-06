import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import AddGymnastForm from '../components/AddGymnastForm';
import EditGymnastForm from '../components/EditGymnastForm';

const Gymnasts = () => {
  const [gymnasts, setGymnasts] = useState([]);
  const [levels, setLevels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingGymnast, setEditingGymnast] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [archivingGymnast, setArchivingGymnast] = useState(null);
  const [archiveReason, setArchiveReason] = useState('');
  const [deletingGymnast, setDeletingGymnast] = useState(null);
  const [success, setSuccess] = useState(null);
  const { canManageGymnasts, isClubAdmin } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Helper function to check if a level is a side-track
  const isSideTrack = (identifier) => {
    return /^\d+[a-z]$/.test(identifier);
  };

  // Helper function to determine the gymnast's current working level number
  const getCurrentLevel = (gymnast, levels) => {
    if (!gymnast || !levels.length) return null;

    // Get all completed main track levels (ignore side tracks)
    const completedMainTrackLevels = gymnast.levelProgress
      .filter(lp => lp.status === 'COMPLETED')
      .map(lp => lp.level)
      .filter(level => !isSideTrack(level.identifier)) // Only main track levels
      .map(level => parseInt(level.identifier))
      .sort((a, b) => a - b);

    // Find the next main track level to work on
    let nextLevelNumber = 1;
    if (completedMainTrackLevels.length > 0) {
      const highestCompleted = Math.max(...completedMainTrackLevels);
      nextLevelNumber = highestCompleted + 1;
    }

    // Find the actual level object
    return levels.find(level => 
      !isSideTrack(level.identifier) && parseInt(level.identifier) === nextLevelNumber
    ) || null;
  };

  // Remove unused function getHighestCompletedLevelForDashboard

  // Helper function to get the highest completed level for competition eligibility
  const getHighestCompletedLevel = (gymnast, levels) => {
    if (!gymnast || !levels.length) return null;

    // Get all completed levels (including side tracks)
    const completedLevels = gymnast.levelProgress
      .filter(lp => lp.status === 'COMPLETED')
      .map(lp => lp.level)
      .sort((a, b) => {
        // Sort by number, handling side paths (e.g., 3a, 3b)
        const aNum = parseFloat(a.identifier);
        const bNum = parseFloat(b.identifier);
        return aNum - bNum;
      });

    if (completedLevels.length === 0) return null;

    // Get the highest completed level identifier
    const highestCompletedLevel = completedLevels[completedLevels.length - 1];
    
    // Find the full level object with competition info
    return levels.find(level => level.id === highestCompletedLevel.id) || null;
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [gymnastsResponse, levelsResponse] = await Promise.all([
          axios.get(`/api/gymnasts${showArchived ? '?includeArchived=true' : ''}`),
          axios.get('/api/levels')
        ]);
        setGymnasts(gymnastsResponse.data);
        setLevels(levelsResponse.data);
      } catch (error) {
        console.error('Failed to fetch data:', error);
        setError('Failed to load data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [showArchived]);

  // Check for URL parameters to highlight specific gymnast or apply filters
  useEffect(() => {
    const highlightId = searchParams.get('highlight');
    if (highlightId && gymnasts.length > 0) {
      const targetGymnast = gymnasts.find(g => g.id === highlightId);
      if (targetGymnast) {
        setSearchTerm(`${targetGymnast.firstName} ${targetGymnast.lastName}`);
      }
    }
  }, [searchParams, gymnasts]);

  const handleAddSuccess = (newGymnast) => {
    setGymnasts(prev => [...prev, newGymnast]);
    setShowAddForm(false);
  };

  const handleCancelAdd = () => {
    setShowAddForm(false);
  };

  // Remove unused function handleEditClick

  const handleEditSuccess = (updatedGymnast) => {
    setGymnasts(prev => prev.map(g => 
      g.id === updatedGymnast.id ? updatedGymnast : g
    ));
    setEditingGymnast(null);
  };

  const handleCancelEdit = () => {
    setEditingGymnast(null);
  };

  const handleArchiveClick = (e, gymnast) => {
    e.stopPropagation();
    setArchivingGymnast(gymnast);
    setArchiveReason('');
  };

  const handleArchiveSubmit = async () => {
    try {
      await axios.patch(`/api/gymnasts/${archivingGymnast.id}/archive`, {
        reason: archiveReason
      });
      
      setSuccess(`${archivingGymnast.firstName} ${archivingGymnast.lastName} has been archived`);
      setArchivingGymnast(null);
      setArchiveReason('');
      
      // Refresh gymnasts list
      const response = await axios.get(`/api/gymnasts${showArchived ? '?includeArchived=true' : ''}`);
      setGymnasts(response.data);
    } catch (error) {
      console.error('Archive gymnast error:', error);
      setError(error.response?.data?.error || 'Failed to archive gymnast');
    }
  };

  const handleRestoreClick = async (e, gymnast) => {
    e.stopPropagation();
    try {
      await axios.patch(`/api/gymnasts/${gymnast.id}/restore`);
      
      setSuccess(`${gymnast.firstName} ${gymnast.lastName} has been restored`);
      
      // Refresh gymnasts list
      const response = await axios.get(`/api/gymnasts${showArchived ? '?includeArchived=true' : ''}`);
      setGymnasts(response.data);
    } catch (error) {
      console.error('Restore gymnast error:', error);
      setError(error.response?.data?.error || 'Failed to restore gymnast');
    }
  };

  const handleDeleteClick = (e, gymnast) => {
    e.stopPropagation();
    setDeletingGymnast(gymnast);
  };

  const handleDeleteConfirm = async () => {
    try {
      await axios.delete(`/api/gymnasts/${deletingGymnast.id}`, {
        data: { confirmDelete: true }
      });
      
      setSuccess(`${deletingGymnast.firstName} ${deletingGymnast.lastName} has been deleted permanently`);
      setDeletingGymnast(null);
      
      // Refresh gymnasts list
      const response = await axios.get(`/api/gymnasts${showArchived ? '?includeArchived=true' : ''}`);
      setGymnasts(response.data);
    } catch (error) {
      console.error('Delete gymnast error:', error);
      setError(error.response?.data?.error || 'Failed to delete gymnast');
      setDeletingGymnast(null);
    }
  };

  const handleRowClick = (gymnast) => {
    const currentLevel = getCurrentLevel(gymnast, levels);
    if (currentLevel) {
      navigate(`/progress/${gymnast.id}#level-${currentLevel.id}`);
    } else {
      navigate(`/progress/${gymnast.id}`);
    }
  };

  // Filter gymnasts based on search term and URL parameters
  const filteredGymnasts = gymnasts.filter(gymnast => {
    const search = searchTerm.toLowerCase();
    const fullName = `${gymnast.firstName} ${gymnast.lastName}`.toLowerCase();
    const guardianNames = gymnast.guardians.map(g => `${g.firstName} ${g.lastName}`.toLowerCase()).join(' ');
    
    // Check search term
    const matchesSearch = !search || fullName.includes(search) || guardianNames.includes(search);
    
    // Check level filter (match what's displayed as "Current Level")
    const levelFilter = searchParams.get('level');
    const matchesLevel = !levelFilter || (() => {
      const currentLevel = getCurrentLevel(gymnast, levels);
      return currentLevel && currentLevel.identifier === levelFilter;
    })();
    
    // Check competition filter (match what's displayed as "Competition Level")
    const competitionFilter = searchParams.get('competition');
    const matchesCompetition = !competitionFilter || (() => {
      const highestCompletedLevel = getHighestCompletedLevel(gymnast, levels);
      return highestCompletedLevel && highestCompletedLevel.competitions && 
             highestCompletedLevel.competitions.some(comp => comp.name === competitionFilter);
    })();
    
    return matchesSearch && matchesLevel && matchesCompetition;
  });

  // Separate active and archived gymnasts
  const activeGymnasts = filteredGymnasts.filter(g => !g.isArchived);
  const archivedGymnasts = filteredGymnasts.filter(g => g.isArchived);

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="alert alert-error">
        {error}
      </div>
    );
  }

  return (
    <div>
      <div className="flex-between">
        <h1>Gymnasts</h1>
        {canManageGymnasts && (
          <button 
            className="btn btn-primary"
            onClick={() => setShowAddForm(!showAddForm)}
          >
            {showAddForm ? 'Cancel' : 'Add New Gymnast'}
          </button>
        )}
      </div>

      {!canManageGymnasts && (
        <div className="info-message">
          <p>You can view gymnast information but don't have permission to add or edit gymnasts.</p>
        </div>
      )}

      {success && (
        <div className="alert alert-success">
          {success}
          <button 
            className="btn btn-xs btn-outline"
            onClick={() => setSuccess(null)}
            style={{ marginLeft: '10px' }}
          >
            ×
          </button>
        </div>
      )}

      {showAddForm && (
        <AddGymnastForm
          onSuccess={handleAddSuccess}
          onCancel={handleCancelAdd}
        />
      )}

      {editingGymnast && (
        <EditGymnastForm
          gymnast={editingGymnast}
          onSuccess={handleEditSuccess}
          onCancel={handleCancelEdit}
        />
      )}

      {/* Archive Modal */}
      {archivingGymnast && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>Archive Gymnast</h3>
            <p>Are you sure you want to archive <strong>{archivingGymnast.firstName} {archivingGymnast.lastName}</strong>?</p>
            <p>Archived gymnasts will be hidden from the main list but their progress data will be preserved.</p>
            
            <div className="form-group">
              <label>Reason for archiving (optional):</label>
              <textarea
                value={archiveReason}
                onChange={(e) => setArchiveReason(e.target.value)}
                placeholder="e.g., Left club, moved away, etc."
                className="form-control"
                rows="3"
              />
            </div>
            
            <div className="modal-actions">
              <button 
                onClick={() => setArchivingGymnast(null)}
                className="btn btn-outline"
              >
                Cancel
              </button>
              <button 
                onClick={handleArchiveSubmit}
                className="btn btn-warning"
              >
                Archive Gymnast
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {deletingGymnast && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>Delete Gymnast</h3>
            <p>Are you sure you want to <strong>permanently delete</strong> <strong>{deletingGymnast.firstName} {deletingGymnast.lastName}</strong>?</p>
            <div className="alert alert-warning">
              <strong>Warning:</strong> This action cannot be undone. All progress data will be lost.
              <br />
              Consider archiving instead to preserve historical data.
            </div>
            
            <div className="modal-actions">
              <button 
                onClick={() => setDeletingGymnast(null)}
                className="btn btn-outline"
              >
                Cancel
              </button>
              <button 
                onClick={() => {
                  setDeletingGymnast(null);
                  handleArchiveClick(null, deletingGymnast);
                }}
                className="btn btn-warning"
              >
                Archive Instead
              </button>
              <button 
                onClick={handleDeleteConfirm}
                className="btn btn-danger"
              >
                Delete Permanently
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Search Input */}
      <div className="card" style={{ marginBottom: '1rem' }}>
        <div className="card-header">
          <input
            type="text"
            placeholder="Search by gymnast name or guardian name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="form-control"
            style={{ margin: 0 }}
          />
          
          {/* Filter Controls */}
          <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <div style={{ minWidth: '120px' }}>
              <select
                value={searchParams.get('level') || ''}
                onChange={(e) => {
                  const newParams = new URLSearchParams(searchParams);
                  if (e.target.value) {
                    newParams.set('level', e.target.value);
                  } else {
                    newParams.delete('level');
                  }
                  setSearchParams(newParams);
                }}
                className="form-control"
                style={{ fontSize: '0.875rem', padding: '0.25rem 0.5rem' }}
              >
                <option value="">All Levels</option>
                {levels
                  .filter(level => !isSideTrack(level.identifier))
                  .sort((a, b) => parseInt(a.identifier) - parseInt(b.identifier))
                  .map(level => (
                    <option key={level.id} value={level.identifier}>
                      Level {level.identifier}
                    </option>
                  ))}
              </select>
            </div>
            
            <div style={{ minWidth: '140px' }}>
              <select
                value={searchParams.get('competition') || ''}
                onChange={(e) => {
                  const newParams = new URLSearchParams(searchParams);
                  if (e.target.value) {
                    newParams.set('competition', e.target.value);
                  } else {
                    newParams.delete('competition');
                  }
                  setSearchParams(newParams);
                }}
                className="form-control"
                style={{ fontSize: '0.875rem', padding: '0.25rem 0.5rem' }}
              >
                <option value="">All Competitions</option>
                {(() => {
                  // Get all unique competitions from levels
                  const allCompetitions = levels
                    .filter(level => level.competitions && level.competitions.length > 0)
                    .flatMap(level => level.competitions)
                    .map(comp => comp.name);
                  
                  // Remove duplicates and sort
                  const uniqueCompetitions = [...new Set(allCompetitions)].sort();
                  
                  return uniqueCompetitions.map(competitionName => (
                    <option key={competitionName} value={competitionName}>
                      {competitionName}
                    </option>
                  ));
                })()}
              </select>
            </div>

            {/* Archive Toggle */}
            {isClubAdmin && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <label style={{ fontSize: '0.875rem', margin: 0 }}>
                  <input
                    type="checkbox"
                    checked={showArchived}
                    onChange={(e) => setShowArchived(e.target.checked)}
                    style={{ marginRight: '0.25rem' }}
                  />
                  Show Archived
                </label>
              </div>
            )}
          </div>
          
          {/* Active Filters */}
          {(searchParams.get('level') || searchParams.get('competition')) && (
            <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontSize: '0.875rem', color: '#666' }}>Active filters:</span>
              
              {searchParams.get('level') && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <span className="badge badge-info">Level {searchParams.get('level')}</span>
                  <button 
                    onClick={() => {
                      const newParams = new URLSearchParams(searchParams);
                      newParams.delete('level');
                      setSearchParams(newParams);
                    }}
                    className="btn btn-xs btn-outline"
                    style={{ padding: '0.125rem 0.25rem', fontSize: '0.75rem' }}
                  >
                    ×
                  </button>
                </div>
              )}
              
              {searchParams.get('competition') && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <span className="badge badge-success">{searchParams.get('competition')}</span>
                  <button 
                    onClick={() => {
                      const newParams = new URLSearchParams(searchParams);
                      newParams.delete('competition');
                      setSearchParams(newParams);
                    }}
                    className="btn btn-xs btn-outline"
                    style={{ padding: '0.125rem 0.25rem', fontSize: '0.75rem' }}
                  >
                    ×
                  </button>
                </div>
              )}
              
              <button 
                onClick={() => setSearchParams(new URLSearchParams())}
                className="btn btn-xs btn-outline"
                style={{ fontSize: '0.75rem' }}
              >
                Clear all filters
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Active Gymnasts */}
      {activeGymnasts.length === 0 && !showArchived ? (
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">No Active Gymnasts Found</h3>
          </div>
          <div>
            {gymnasts.length === 0 ? (
              <>
                <p>No gymnasts have been added to your club yet.</p>
                <p>Click "Add New Gymnast" to get started.</p>
              </>
            ) : (
              <p>No active gymnasts match your search criteria.</p>
            )}
          </div>
        </div>
      ) : (
        <>
          {/* Active Gymnasts Table */}
          {activeGymnasts.length > 0 && (
            <div className="card">
              <div className="card-header">
                <h3 className="card-title">
                  Active Gymnasts ({activeGymnasts.length})
                </h3>
              </div>
              
              {/* Desktop Table */}
              <table className="table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Date of Birth</th>
                    <th>Current Level</th>
                    <th>Competition Level</th>
                    <th>Guardians</th>
                  </tr>
                </thead>
                <tbody>
                  {activeGymnasts.map(gymnast => (
                    <tr 
                      key={gymnast.id} 
                      onClick={() => handleRowClick(gymnast)}
                      style={{ cursor: 'pointer' }}
                      title="Click to view progress"
                    >
                      <td>
                        <strong>{gymnast.firstName} {gymnast.lastName}</strong>
                      </td>
                      <td>
                        {gymnast.dateOfBirth 
                          ? new Date(gymnast.dateOfBirth).toLocaleDateString()
                          : 'Not specified'
                        }
                      </td>
                      <td>
                        {(() => {
                          const currentLevel = getCurrentLevel(gymnast, levels);
                          return currentLevel ? (
                            <span className="level-badge">
                              Level {currentLevel.identifier}: {currentLevel.name}
                            </span>
                          ) : (
                            <span className="badge badge-secondary">
                              Not started
                            </span>
                          );
                        })()}
                      </td>
                      <td>
                        {(() => {
                          const highestCompletedLevel = getHighestCompletedLevel(gymnast, levels);
                          return highestCompletedLevel && highestCompletedLevel.competitions && highestCompletedLevel.competitions.length > 0 ? (
                            <div className="competition-levels">
                              {highestCompletedLevel.competitions.map((competition, index) => (
                                <span key={index} className="competition-badge">
                                  {competition.name}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-muted">No competitions</span>
                          );
                        })()}
                      </td>
                      <td>
                        {gymnast.guardians.length > 0 ? (
                          <div>
                            {gymnast.guardians.map(guardian => (
                              <div key={guardian.id}>
                                <Link 
                                  to={`/parents?highlight=${guardian.id}`}
                                  className="text-link"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <small>{guardian.firstName} {guardian.lastName}</small>
                                </Link>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="text-muted">No guardians</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Mobile Cards */}
              <div className="mobile-table-cards">
                {activeGymnasts.map(gymnast => (
                  <div 
                    key={gymnast.id}
                    className="mobile-table-card"
                    onClick={() => handleRowClick(gymnast)}
                    style={{ cursor: 'pointer' }}
                    title="Tap to view progress"
                  >
                    <div className="mobile-card-header">
                      <div className="mobile-card-title">
                        {gymnast.firstName} {gymnast.lastName}
                      </div>
                    </div>
                    
                    <div className="mobile-card-body">
                      <div className="mobile-card-row">
                        <span className="mobile-card-label">Date of Birth:</span>
                        <span className="mobile-card-value">
                          {gymnast.dateOfBirth 
                            ? new Date(gymnast.dateOfBirth).toLocaleDateString()
                            : 'Not specified'
                          }
                        </span>
                      </div>
                      
                      <div className="mobile-card-row">
                        <span className="mobile-card-label">Current Level:</span>
                        <span className="mobile-card-value">
                          {(() => {
                            const currentLevel = getCurrentLevel(gymnast, levels);
                            return currentLevel ? (
                              <span className="level-badge">
                                Level {currentLevel.identifier}: {currentLevel.name}
                              </span>
                            ) : (
                              <span className="badge badge-secondary">
                                Not started
                              </span>
                            );
                          })()}
                        </span>
                      </div>
                      
                      <div className="mobile-card-row">
                        <span className="mobile-card-label">Competition Level:</span>
                        <span className="mobile-card-value">
                          {(() => {
                            const highestCompletedLevel = getHighestCompletedLevel(gymnast, levels);
                            return highestCompletedLevel && highestCompletedLevel.competitions && highestCompletedLevel.competitions.length > 0 ? (
                              <div className="competition-levels">
                                {highestCompletedLevel.competitions.map((competition, index) => (
                                  <span key={index} className="competition-badge">
                                    {competition.name}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="text-muted">No competitions</span>
                            );
                          })()}
                        </span>
                      </div>
                      
                      <div className="mobile-card-row">
                        <span className="mobile-card-label">Guardians:</span>
                        <span className="mobile-card-value">
                          {gymnast.guardians.length > 0 ? (
                            <div>
                              {gymnast.guardians.map(guardian => (
                                <div key={guardian.id}>
                                  <Link 
                                    to={`/parents?highlight=${guardian.id}`}
                                    className="text-link"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <small>{guardian.firstName} {guardian.lastName}</small>
                                  </Link>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span className="text-muted">No guardians</span>
                          )}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Archived Gymnasts Table */}
          {showArchived && archivedGymnasts.length > 0 && (
            <div className="card" style={{ marginTop: '1rem' }}>
              <div className="card-header">
                <h3 className="card-title">
                  Archived Gymnasts ({archivedGymnasts.length})
                </h3>
              </div>
              
              {/* Desktop Table */}
              <table className="table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Date of Birth</th>
                    <th>Archived Date</th>
                    <th>Reason</th>
                    <th>Guardians</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {archivedGymnasts.map(gymnast => (
                    <tr 
                      key={gymnast.id} 
                      onClick={() => handleRowClick(gymnast)}
                      style={{ cursor: 'pointer', opacity: 0.7 }}
                      title="Click to view progress"
                    >
                      <td>
                        <strong>{gymnast.firstName} {gymnast.lastName}</strong>
                        <span className="badge badge-secondary" style={{ marginLeft: '0.5rem' }}>
                          Archived
                        </span>
                      </td>
                      <td>
                        {gymnast.dateOfBirth 
                          ? new Date(gymnast.dateOfBirth).toLocaleDateString()
                          : 'Not specified'
                        }
                      </td>
                      <td>
                        {gymnast.archivedAt 
                          ? new Date(gymnast.archivedAt).toLocaleDateString()
                          : 'Unknown'
                        }
                      </td>
                      <td>
                        {gymnast.archivedReason || 'No reason specified'}
                      </td>
                      <td>
                        {gymnast.guardians.length > 0 ? (
                          <div>
                            {gymnast.guardians.map(guardian => (
                              <div key={guardian.id}>
                                <Link 
                                  to={`/parents?highlight=${guardian.id}`}
                                  className="text-link"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <small>{guardian.firstName} {guardian.lastName}</small>
                                </Link>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="text-muted">No guardians</span>
                        )}
                      </td>
                      <td>
                        {isClubAdmin && (
                          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                            <button 
                              onClick={(e) => handleRestoreClick(e, gymnast)}
                              className="btn btn-sm btn-success"
                              title="Restore gymnast"
                            >
                              Restore
                            </button>
                            <button 
                              onClick={(e) => handleDeleteClick(e, gymnast)}
                              className="btn btn-sm btn-danger"
                              title="Delete gymnast permanently"
                            >
                              Delete
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Mobile Cards */}
              <div className="mobile-table-cards">
                {archivedGymnasts.map(gymnast => (
                  <div 
                    key={gymnast.id}
                    className="mobile-table-card"
                    onClick={() => handleRowClick(gymnast)}
                    style={{ cursor: 'pointer', opacity: 0.7 }}
                    title="Tap to view progress"
                  >
                    <div className="mobile-card-header">
                      <div className="mobile-card-title">
                        {gymnast.firstName} {gymnast.lastName}
                        <span className="badge badge-secondary" style={{ marginLeft: '0.5rem' }}>
                          Archived
                        </span>
                      </div>
                    </div>
                    
                    <div className="mobile-card-body">
                      <div className="mobile-card-row">
                        <span className="mobile-card-label">Date of Birth:</span>
                        <span className="mobile-card-value">
                          {gymnast.dateOfBirth 
                            ? new Date(gymnast.dateOfBirth).toLocaleDateString()
                            : 'Not specified'
                          }
                        </span>
                      </div>
                      
                      <div className="mobile-card-row">
                        <span className="mobile-card-label">Archived Date:</span>
                        <span className="mobile-card-value">
                          {gymnast.archivedAt 
                            ? new Date(gymnast.archivedAt).toLocaleDateString()
                            : 'Unknown'
                          }
                        </span>
                      </div>
                      
                      <div className="mobile-card-row">
                        <span className="mobile-card-label">Reason:</span>
                        <span className="mobile-card-value">
                          {gymnast.archivedReason || 'No reason specified'}
                        </span>
                      </div>
                      
                      <div className="mobile-card-row">
                        <span className="mobile-card-label">Guardians:</span>
                        <span className="mobile-card-value">
                          {gymnast.guardians.length > 0 ? (
                            <div>
                              {gymnast.guardians.map(guardian => (
                                <div key={guardian.id}>
                                  <Link 
                                    to={`/parents?highlight=${guardian.id}`}
                                    className="text-link"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <small>{guardian.firstName} {guardian.lastName}</small>
                                  </Link>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span className="text-muted">No guardians</span>
                          )}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Show message if no gymnasts found */}
          {activeGymnasts.length === 0 && (!showArchived || archivedGymnasts.length === 0) && (
            <div className="card">
              <div className="card-header">
                <h3 className="card-title">No Gymnasts Found</h3>
              </div>
              <div>
                <p>No gymnasts match your search criteria.</p>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default Gymnasts; 