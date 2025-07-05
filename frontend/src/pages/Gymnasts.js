import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
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
  const { canManageGymnasts } = useAuth();
  const navigate = useNavigate();

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
          axios.get('/api/gymnasts'),
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
  }, []);

  const handleAddSuccess = (newGymnast) => {
    setGymnasts(prev => [...prev, newGymnast]);
    setShowAddForm(false);
  };

  const handleCancelAdd = () => {
    setShowAddForm(false);
  };

  const handleEditClick = (e, gymnast) => {
    e.stopPropagation(); // Prevent row click
    setEditingGymnast(gymnast);
    setShowAddForm(false); // Hide add form if it's open
  };

  const handleEditSuccess = (updatedGymnast) => {
    setGymnasts(prev => prev.map(g => 
      g.id === updatedGymnast.id ? updatedGymnast : g
    ));
    setEditingGymnast(null);
  };

  const handleCancelEdit = () => {
    setEditingGymnast(null);
  };

  const handleRowClick = (gymnast) => {
    const currentLevel = getCurrentLevel(gymnast, levels);
    if (currentLevel) {
      navigate(`/progress/${gymnast.id}#level-${currentLevel.id}`);
    } else {
      navigate(`/progress/${gymnast.id}`);
    }
  };

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

      {gymnasts.length === 0 ? (
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">No Gymnasts Found</h3>
          </div>
          <div>
            <p>No gymnasts have been added to your club yet.</p>
            <p>Click "Add New Gymnast" to get started.</p>
          </div>
        </div>
      ) : (
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Club Gymnasts</h3>
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
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {gymnasts.map(gymnast => (
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
                            <small>{guardian.firstName} {guardian.lastName}</small>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span className="text-muted">No guardians</span>
                    )}
                  </td>
                  <td>
                    {canManageGymnasts && (
                      <button 
                        onClick={(e) => handleEditClick(e, gymnast)}
                        className="btn btn-sm btn-outline"
                      >
                        Edit
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Mobile Cards */}
          <div className="mobile-table-cards">
            {gymnasts.map(gymnast => (
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
                  <div className="mobile-card-actions">
                    {canManageGymnasts && (
                      <button 
                        onClick={(e) => handleEditClick(e, gymnast)}
                        className="btn btn-xs btn-outline"
                      >
                        Edit
                      </button>
                    )}
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
                              <small>{guardian.firstName} {guardian.lastName}</small>
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
    </div>
  );
};

export default Gymnasts; 