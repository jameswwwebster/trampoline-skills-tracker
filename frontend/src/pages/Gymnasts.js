import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { bookingApi } from '../utils/bookingApi';


const Gymnasts = () => {
  const [gymnasts, setGymnasts] = useState([]);
  const [levels, setLevels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [archivingGymnast, setArchivingGymnast] = useState(null);
  const [archiveReason, setArchiveReason] = useState('');
  const [deletingGymnast, setDeletingGymnast] = useState(null);
  const [success, setSuccess] = useState(null);
  const [showQuickNav, setShowQuickNav] = useState(false);
  const [sessionGymnasts, setSessionGymnasts] = useState(new Set());
  const [showSessionOnly, setShowSessionOnly] = useState(false);
  const [todaySessions, setTodaySessions] = useState([]);
  const [selectedSessionId, setSelectedSessionId] = useState(null);
  const [sessionLoading, setSessionLoading] = useState(false);
  const [sortBy, setSortBy] = useState('name'); // 'name', 'level', 'recent', 'age'
  const [letterFilter, setLetterFilter] = useState('');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 25;
  const { isClubAdmin, canManageGymnasts } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Helper function to check if a level is a side-track
  const isSideTrack = (identifier) => {
    return /^\d+[a-z]$/.test(identifier);
  };

  // Load session and preferences from localStorage on component mount
  useEffect(() => {
    const savedSortBy = localStorage.getItem('gymnastSortBy');
    if (savedSortBy) setSortBy(savedSortBy);

    const savedShowArchived = localStorage.getItem('gymnastShowArchived');
    if (savedShowArchived) setShowArchived(savedShowArchived === 'true');

    const savedSearchTerm = localStorage.getItem('gymnastSearchTerm');
    if (savedSearchTerm) setSearchTerm(savedSearchTerm);
  }, []);

  // Save preferences to localStorage when they change
  useEffect(() => {
    localStorage.setItem('gymnastSortBy', sortBy);
  }, [sortBy]);

  useEffect(() => {
    localStorage.setItem('gymnastShowArchived', showArchived.toString());
  }, [showArchived]);

  useEffect(() => {
    localStorage.setItem('gymnastSearchTerm', searchTerm);
  }, [searchTerm]);

  useEffect(() => { setPage(1); }, [searchTerm, letterFilter, showSessionOnly]);

  useEffect(() => {
    if (!canManageGymnasts) return;
    const now = new Date();
    bookingApi.getSessions(now.getFullYear(), now.getMonth() + 1)
      .then(res => {
        const todayStr = now.toISOString().split('T')[0];
        const sessions = res.data.filter(s =>
          new Date(s.date).toISOString().split('T')[0] === todayStr
        );
        setTodaySessions(sessions);
      })
      .catch(() => {
        // Silently fail — dropdown renders as disabled
      });
  }, [canManageGymnasts]);

  const handleSessionSelect = async (sessionId) => {
    if (!sessionId) {
      setSelectedSessionId(null);
      setSessionGymnasts(new Set());
      return;
    }
    setSelectedSessionId(sessionId);
    setSessionLoading(true);
    try {
      const res = await bookingApi.getAttendance(sessionId);
      setSessionGymnasts(new Set(res.data.attendees.map(a => a.gymnastId)));
    } catch (err) {
      setError('Failed to load session attendees. Please try again.');
      setSelectedSessionId(null);
      // Per spec: keep the previous sessionGymnasts set unchanged on failure
    } finally {
      setSessionLoading(false);
    }
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

  // Handle ?session=<instanceId> deep link from "Track these gymnasts" button
  useEffect(() => {
    const sessionParam = searchParams.get('session');
    if (!sessionParam) return;

    // Strip param from URL so refresh returns to default unfiltered state
    const next = new URLSearchParams(searchParams);
    next.delete('session');
    setSearchParams(next, { replace: true });

    // Fetch attendees and activate the session filter
    setSelectedSessionId(sessionParam);
    setSessionLoading(true);
    bookingApi.getAttendance(sessionParam)
      .then(res => {
        setSessionGymnasts(new Set(res.data.attendees.map(a => a.gymnastId)));
        setShowSessionOnly(true);
      })
      .catch(() => {
        setError('Failed to load session attendees. Please try again.');
        setSelectedSessionId(null);
      })
      .finally(() => setSessionLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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

  const handleArchiveClick = (e, gymnast) => {
    if (e) e.stopPropagation();
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

  // Filter gymnasts based on search term, URL parameters, and session mode
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
    
    // Check competition filter (match gymnasts who have completed levels associated with this competition)
    const competitionFilter = searchParams.get('competition');
    const matchesCompetition = !competitionFilter || (() => {
      // Check if gymnast has completed any level associated with this competition
      const completedLevels = gymnast.levelProgress
        .filter(lp => lp.status === 'COMPLETED')
        .map(lp => lp.level);
      
      return completedLevels.some(level =>
        level.competitions && level.competitions.some(comp => comp.competition.name === competitionFilter)
      );
    })();
    
    // Check session filter
    const matchesSession = !showSessionOnly || sessionGymnasts.has(gymnast.id);
    
    return matchesSearch && matchesLevel && matchesCompetition && matchesSession;
  });

  // Sort gymnasts based on selected sort option
  const sortGymnasts = (gymnasts) => {
    return [...gymnasts].sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`);
        
        case 'level':
          const levelA = getCurrentLevel(a, levels);
          const levelB = getCurrentLevel(b, levels);
          if (!levelA && !levelB) return 0;
          if (!levelA) return 1;
          if (!levelB) return -1;
          return levelA.identifier.localeCompare(levelB.identifier);
        
        case 'recent':
          const dateA = new Date(a.updatedAt || a.createdAt);
          const dateB = new Date(b.updatedAt || b.createdAt);
          return dateB - dateA;
        
        case 'age':
          const ageA = a.dateOfBirth ? new Date().getFullYear() - new Date(a.dateOfBirth).getFullYear() : 0;
          const ageB = b.dateOfBirth ? new Date().getFullYear() - new Date(b.dateOfBirth).getFullYear() : 0;
          return ageA - ageB; // Youngest first
        
        default:
          return 0;
      }
    });
  };

  // Separate active and archived gymnasts, then sort them
  const activeGymnasts = sortGymnasts(filteredGymnasts.filter(g => !g.isArchived));
  const archivedGymnasts = sortGymnasts(filteredGymnasts.filter(g => g.isArchived));

  const letterFilteredActive = !letterFilter
    ? activeGymnasts
    : activeGymnasts.filter(g => (g.lastName || g.firstName || '').toUpperCase().startsWith(letterFilter));

  const totalPages = Math.max(1, Math.ceil(letterFilteredActive.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginatedActive = letterFilteredActive.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  if (loading) {
    return (
      <div className="loading mobile-loading">
        <div className="spinner"></div>
        <p className="loading-text">Loading gymnasts...</p>
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
      {success && (
        <div className="alert alert-success">
          {success}
          <button
            className="btn btn-xs btn-outline alert-dismiss-btn"
            onClick={() => setSuccess(null)}
          >
            ×
          </button>
        </div>
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
            <div className="alert alert-error">
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

      {/* Search + Filter Bar */}
      <div className="card" style={{ marginBottom: '1rem' }}>
        <div className="gymnasts-filter-bar">
          <input
            type="text"
            placeholder="Search gymnasts..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="form-control gymnasts-search-input"
          />

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="form-control gymnasts-filter-select"
          >
            <option value="name">Name (A–Z)</option>
            <option value="recent">Most Recent</option>
            <option value="level">Level</option>
            <option value="age">Age (Youngest First)</option>
          </select>

          <select
            value={searchParams.get('level') || ''}
            onChange={(e) => {
              const newParams = new URLSearchParams(searchParams);
              if (e.target.value) newParams.set('level', e.target.value);
              else newParams.delete('level');
              setSearchParams(newParams);
            }}
            className="form-control gymnasts-filter-select"
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

          <select
            value={searchParams.get('competition') || ''}
            onChange={(e) => {
              const newParams = new URLSearchParams(searchParams);
              if (e.target.value) newParams.set('competition', e.target.value);
              else newParams.delete('competition');
              setSearchParams(newParams);
            }}
            className="form-control gymnasts-filter-select"
          >
            <option value="">All Competitions</option>
            {[...new Set(
              levels
                .filter(l => l.competitions?.length > 0)
                .flatMap(l => l.competitions.map(c => c.name))
            )].sort().map(name => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>

          {isClubAdmin && (
            <label className="gymnasts-archive-label">
              <input
                type="checkbox"
                checked={showArchived}
                onChange={(e) => setShowArchived(e.target.checked)}
              />
              <span>Show Archived</span>
            </label>
          )}

          {canManageGymnasts && (
            <select
              className="form-control gymnasts-filter-select"
              value={selectedSessionId || ''}
              onChange={(e) => handleSessionSelect(e.target.value || null)}
              disabled={todaySessions.length === 0 || sessionLoading}
            >
              <option value="">
                {todaySessions.length === 0 ? 'No sessions today' : 'No session'}
              </option>
              {todaySessions.map(s => (
                <option key={s.id} value={s.id}>
                  {s.startTime}–{s.endTime} · {s.type.charAt(0) + s.type.slice(1).toLowerCase()}
                </option>
              ))}
            </select>
          )}

          {sessionGymnasts.size > 0 && (
            <button
              className={`btn btn-sm ${showSessionOnly ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setShowSessionOnly(!showSessionOnly)}
            >
              {showSessionOnly ? 'Show All' : `Session (${sessionGymnasts.size})`}
            </button>
          )}
        </div>

        {/* Active filter chips */}
        {(searchParams.get('level') || searchParams.get('competition')) && (
          <div className="gymnasts-active-filters">
            <span className="gymnasts-filter-label">Active filters:</span>
            {searchParams.get('level') && (
              <span className="badge badge-info gymnasts-filter-chip">
                Level {searchParams.get('level')}
                <button onClick={() => { const p = new URLSearchParams(searchParams); p.delete('level'); setSearchParams(p); }} className="gymnasts-filter-chip-remove">×</button>
              </span>
            )}
            {searchParams.get('competition') && (
              <span className="badge badge-success gymnasts-filter-chip">
                {searchParams.get('competition')}
                <button onClick={() => { const p = new URLSearchParams(searchParams); p.delete('competition'); setSearchParams(p); }} className="gymnasts-filter-chip-remove">×</button>
              </span>
            )}
            <button className="btn btn-xs btn-outline" onClick={() => setSearchParams(new URLSearchParams())}>Clear all</button>
          </div>
        )}
      </div>

      {/* A–Z filter */}
      <div className="gymnasts-az-filter">
        <button
          className={`gymnasts-az-btn${letterFilter === '' ? ' active' : ''}`}
          onClick={() => setLetterFilter('')}
        >All</button>
        {'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map(letter => (
          <button
            key={letter}
            className={`gymnasts-az-btn${letterFilter === letter ? ' active' : ''}`}
            onClick={() => setLetterFilter(l => l === letter ? '' : letter)}
          >{letter}</button>
        ))}
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
              </>
            ) : (
              <>
                <p>No active gymnasts match your search criteria.</p>
                {(searchTerm || searchParams.get('level') || searchParams.get('competition') || showSessionOnly) && (
                  <div style={{ marginTop: '1rem' }}>
                    <button
                      className="btn btn-outline btn-sm"
                      onClick={() => {
                        setSearchTerm('');
                        setShowSessionOnly(false);
                        setSelectedSessionId(null);
                        setSessionGymnasts(new Set());
                        setSearchParams(new URLSearchParams());
                      }}
                    >
                      Clear All Filters
                    </button>
                  </div>
                )}
              </>
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
                    <th>Session</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedActive.map(gymnast => (
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
                        {sessionGymnasts.has(gymnast.id) && (
                          <span className="badge badge-success" style={{ fontSize: '0.85rem' }}>✓</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Mobile Cards */}
              <div className="mobile-table-cards">
                {paginatedActive.map(gymnast => {
                  const isInSession = sessionGymnasts.has(gymnast.id);
                  return (
                    <div 
                      key={gymnast.id}
                      className={`mobile-table-card skill-tracker-card ${isInSession ? 'in-session' : ''}`}
                      onClick={() => handleRowClick(gymnast)}
                      style={{ cursor: 'pointer' }}
                      title="Tap to view progress"
                    >
                      <div className="mobile-card-header">
                        <div className="mobile-card-title">
                          {gymnast.firstName} {gymnast.lastName}
                        </div>
                        <div className="mobile-card-age">
                          {gymnast.dateOfBirth
                            ? `${new Date().getFullYear() - new Date(gymnast.dateOfBirth).getFullYear()}y`
                            : 'Age unknown'
                          }
                        </div>
                      </div>
                    
                    <div className="mobile-card-body">
                      <div className="mobile-card-main-info">
                        <div className="mobile-card-level">
                          {(() => {
                            const currentLevel = getCurrentLevel(gymnast, levels);
                            return currentLevel ? (
                              <div className="level-info">
                                <span className="level-number">Level {currentLevel.identifier}</span>
                                <span className="level-name">{currentLevel.name}</span>
                              </div>
                            ) : (
                              <div className="level-info">
                                <span className="level-number">Not started</span>
                              </div>
                            );
                          })()}
                        </div>
                        
                        <div className="mobile-card-competition">
                          {(() => {
                            const highestCompletedLevel = getHighestCompletedLevel(gymnast, levels);
                            return highestCompletedLevel && highestCompletedLevel.competitions && highestCompletedLevel.competitions.length > 0 ? (
                              <div className="competition-info">
                                <span className="competition-label">Competition:</span>
                                <div className="competition-badges">
                                  {highestCompletedLevel.competitions.map((competition, index) => (
                                    <span key={index} className="competition-badge">
                                      {competition.name}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            ) : null;
                          })()}
                        </div>
                      </div>
                      
                      <div className="mobile-card-actions">
                        <button 
                          className="btn btn-primary btn-sm mobile-quick-action"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRowClick(gymnast);
                          }}
                        >
                          Track Progress
                        </button>
                      </div>
                    </div>
                  </div>
                  );
                })}
              </div>
              
              {/* Quick Navigation for Mobile */}
              {activeGymnasts.length > 1 && (
                <div className="mobile-quick-nav">
                  <button 
                    className="mobile-quick-nav-toggle"
                    onClick={() => setShowQuickNav(!showQuickNav)}
                  >
                    <span>Quick Jump</span>
                    <span className={`quick-nav-arrow ${showQuickNav ? 'open' : ''}`}>▼</span>
                  </button>
                  
                  {showQuickNav && (
                    <div className="mobile-quick-nav-list">
                      {activeGymnasts.map((gymnast, index) => (
                        <button
                          key={gymnast.id}
                          className="mobile-quick-nav-item"
                          onClick={() => {
                            handleRowClick(gymnast);
                            setShowQuickNav(false);
                          }}
                        >
                          <span className="quick-nav-name">
                            {gymnast.firstName} {gymnast.lastName}
                          </span>
                          <span className="quick-nav-level">
                            {(() => {
                              const currentLevel = getCurrentLevel(gymnast, levels);
                              return currentLevel ? `Level ${currentLevel.identifier}` : 'Not started';
                            })()}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            {totalPages > 1 && (
              <div className="gymnasts-pagination">
                <button
                  className="btn btn-sm btn-outline"
                  disabled={safePage <= 1}
                  onClick={() => setPage(p => p - 1)}
                >← Prev</button>
                <span className="gymnasts-pagination-info">Page {safePage} of {totalPages}</span>
                <button
                  className="btn btn-sm btn-outline"
                  disabled={safePage >= totalPages}
                  onClick={() => setPage(p => p + 1)}
                >Next →</button>
              </div>
            )}
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
                                  to={`/adults?highlight=${guardian.id}`}
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
                                    to={`/adults?highlight=${guardian.id}`}
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
                {(searchTerm || searchParams.get('level') || searchParams.get('competition') || showSessionOnly) && (
                  <div style={{ marginTop: '1rem' }}>
                    <button
                      className="btn btn-outline btn-sm"
                      onClick={() => {
                        setSearchTerm('');
                        setShowSessionOnly(false);
                        setSelectedSessionId(null);
                        setSessionGymnasts(new Set());
                        setSearchParams(new URLSearchParams());
                      }}
                    >
                      Clear All Filters
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default Gymnasts; 