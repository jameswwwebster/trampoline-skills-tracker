import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';

const LevelProgressTracker = ({ gymnastId, levelId, onLevelProgressUpdate }) => {
  const [levelData, setLevelData] = useState(null);
  const [levelProgress, setLevelProgress] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updating, setUpdating] = useState(false);
  const [selectedRoutine, setSelectedRoutine] = useState('');
  const [notes, setNotes] = useState('');
  const { user } = useAuth();

  // Only coaches and club admins can use this component
  const canMarkProgress = user?.role === 'COACH' || user?.role === 'CLUB_ADMIN';

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [levelResponse, progressResponse] = await Promise.all([
          axios.get(`/api/progress/level/${levelId}/skills`),
          axios.get(`/api/progress/gymnast/${gymnastId}`)
        ]);

        setLevelData(levelResponse.data);
        
        // Find existing level progress
        const existingProgress = progressResponse.data.levelProgress.find(
          lp => lp.levelId === levelId
        );
        setLevelProgress(existingProgress);
        
        if (existingProgress) {
          setSelectedRoutine(existingProgress.routineId || '');
          setNotes(existingProgress.notes || '');
        }
      } catch (error) {
        console.error('Failed to fetch level data:', error);
        setError('Failed to load level data');
      } finally {
        setLoading(false);
      }
    };

    if (gymnastId && levelId) {
      fetchData();
    }
  }, [gymnastId, levelId]);

  const updateLevelProgress = async (status) => {
    if (!canMarkProgress) return;

    setUpdating(true);
    
    try {
      const response = await axios.post('/api/progress/level', {
        gymnastId,
        levelId,
        routineId: selectedRoutine || undefined,
        status,
        notes: notes.trim() || undefined,
        completedAt: status === 'COMPLETED' ? new Date().toISOString() : undefined
      });

      setLevelProgress(response.data);

      // Notify parent component of progress update
      if (onLevelProgressUpdate) {
        onLevelProgressUpdate(response.data);
      }

    } catch (error) {
      console.error('Failed to update level progress:', error);
      setError(error.response?.data?.error || 'Failed to update progress');
    } finally {
      setUpdating(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'COMPLETED': return 'success';
      case 'IN_PROGRESS': return 'warning';
      case 'NOT_STARTED': return 'secondary';
      default: return 'secondary';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'COMPLETED': return 'Completed';
      case 'IN_PROGRESS': return 'In Progress';
      case 'NOT_STARTED': return 'Not Started';
      default: return 'Not Started';
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

  if (!levelData) {
    return (
      <div className="alert alert-info">
        No level data available.
      </div>
    );
  }

  const currentStatus = levelProgress?.status || 'NOT_STARTED';

  return (
    <div className="level-progress-tracker">
      <div className="card">
        <div className="card-header">
          <h4 className="card-title">
            Level {levelData.identifier} Progress - {levelData.name}
          </h4>
          <span className={`badge badge-${getStatusColor(currentStatus)}`}>
            {getStatusText(currentStatus)}
          </span>
        </div>

        {!canMarkProgress && (
          <div className="alert alert-info">
            Only coaches can mark level progress.
          </div>
        )}

        <div className="level-progress-content">
          {/* Current Progress Info */}
          {levelProgress && (
            <div className="current-progress">
              <h5>Current Status</h5>
              <div className="progress-details">
                {levelProgress.completedAt && (
                  <div className="completion-date">
                    <strong>Completed:</strong> {new Date(levelProgress.completedAt).toLocaleDateString()}
                  </div>
                )}
                {levelProgress.user && (
                  <div className="marked-by">
                    <strong>Marked by:</strong> {levelProgress.user.firstName} {levelProgress.user.lastName}
                  </div>
                )}
                {levelProgress.routine && (
                  <div className="routine-used">
                    <strong>Routine:</strong> {levelProgress.routine.name || `Routine ${levelProgress.routine.order}`}
                  </div>
                )}
                {levelProgress.notes && (
                  <div className="progress-notes">
                    <strong>Notes:</strong> {levelProgress.notes}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Routine Selection (for coaches) */}
          {canMarkProgress && levelData.routines && levelData.routines.length > 0 && (
            <div className="routine-selection">
              <h5>Select Routine</h5>
              <div className="form-group">
                <label htmlFor="routine">Routine Completed:</label>
                <select
                  id="routine"
                  value={selectedRoutine}
                  onChange={(e) => setSelectedRoutine(e.target.value)}
                  className="form-control"
                  disabled={updating}
                >
                  <option value="">No specific routine</option>
                  {levelData.routines.map(routine => (
                    <option key={routine.id} value={routine.id}>
                      {routine.name || `Routine ${routine.order}`}
                      {routine.isAlternative ? ' (Alternative)' : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Notes Section (for coaches) */}
          {canMarkProgress && (
            <div className="notes-section">
              <h5>Notes</h5>
              <div className="form-group">
                <label htmlFor="notes">Coach Notes:</label>
                <textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="form-control"
                  rows={3}
                  placeholder="Add notes about the gymnast's progress, areas for improvement, etc."
                  disabled={updating}
                />
              </div>
            </div>
          )}

          {/* Progress Controls (for coaches) */}
          {canMarkProgress && (
            <div className="progress-controls">
              <h5>Level Completion</h5>
              <div className="alert alert-info">
                <strong>Note:</strong> Levels are automatically completed when all skills and routines are finished. 
                You cannot manually complete levels.
              </div>
              <div className="status-buttons">
                <button
                  onClick={() => updateLevelProgress('NOT_STARTED')}
                  disabled={updating}
                  className={`btn ${currentStatus === 'NOT_STARTED' ? 'btn-secondary' : 'btn-outline'}`}
                >
                  Reset to Not Started
                </button>
                <button
                  onClick={() => updateLevelProgress('IN_PROGRESS')}
                  disabled={updating}
                  className={`btn ${currentStatus === 'IN_PROGRESS' ? 'btn-warning' : 'btn-outline'}`}
                >
                  Mark as In Progress
                </button>
              </div>
            </div>
          )}

          {/* Routines Display */}
          {levelData.routines && levelData.routines.length > 0 && (
            <div className="routines-display">
              <h5>Available Routines</h5>
              <div className="routines-list">
                {levelData.routines.map(routine => (
                  <div key={routine.id} className="routine-card">
                    <div className="routine-header">
                      <h6>{routine.name || `Routine ${routine.order}`}</h6>
                      {routine.isAlternative && (
                        <span className="badge badge-info">Alternative</span>
                      )}
                      {selectedRoutine === routine.id && (
                        <span className="badge badge-primary">Selected</span>
                      )}
                    </div>
                    {routine.description && (
                      <p className="routine-description">{routine.description}</p>
                    )}
                    
                    {routine.routineSkills && routine.routineSkills.length > 0 && (
                      <div className="routine-skills">
                        <h6>Required Skills:</h6>
                        <ul className="skills-list">
                          {routine.routineSkills
                            .sort((a, b) => a.order - b.order)
                            .map(routineSkill => (
                              <li key={routineSkill.id} className="skill-item">
                                {routineSkill.skill.name}
                              </li>
                            ))
                          }
                        </ul>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LevelProgressTracker; 