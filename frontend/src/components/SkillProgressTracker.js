import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';

const SkillProgressTracker = ({ gymnastId, levelId, onProgressUpdate }) => {
  const [levelData, setLevelData] = useState(null);
  const [progressData, setProgressData] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updating, setUpdating] = useState({});
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
        
        // Create a map of skill progress for quick lookup
        const progressMap = {};
        progressResponse.data.skillProgress.forEach(progress => {
          progressMap[progress.skillId] = progress;
        });
        setProgressData(progressMap);
      } catch (error) {
        console.error('Failed to fetch progress data:', error);
        setError('Failed to load progress data');
      } finally {
        setLoading(false);
      }
    };

    if (gymnastId && levelId) {
      fetchData();
    }
  }, [gymnastId, levelId]);

  const updateSkillProgress = async (skillId, status, notes = '') => {
    if (!canMarkProgress) return;

    setUpdating(prev => ({ ...prev, [skillId]: true }));
    
    try {
      const response = await axios.post('/api/progress/skill', {
        gymnastId,
        skillId,
        status,
        notes: notes || undefined,
        completedAt: status === 'COMPLETED' ? new Date().toISOString() : undefined
      });

      // Update local progress data
      setProgressData(prev => ({
        ...prev,
        [skillId]: response.data
      }));

      // Notify parent component of progress update
      if (onProgressUpdate) {
        onProgressUpdate(response.data);
      }

    } catch (error) {
      console.error('Failed to update skill progress:', error);
      setError(error.response?.data?.error || 'Failed to update progress');
    } finally {
      setUpdating(prev => ({ ...prev, [skillId]: false }));
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

  return (
    <div className="skill-progress-tracker">
      <div className="card">
        <div className="card-header">
          <h4 className="card-title">
            Level {levelData.identifier} - {levelData.name}
          </h4>
          {levelData.competitions && levelData.competitions.length > 0 && (
            <div className="competition-levels">
              <span className="competition-label">Competition eligibility:</span>
              {levelData.competitions.map((competition, index) => (
                <span key={index} className="competition-badge">
                  {competition.name}
                </span>
              ))}
            </div>
          )}
        </div>

        {!canMarkProgress && (
          <div className="alert alert-info">
            Only coaches can mark skill progress.
          </div>
        )}

        <div className="skills-section">
          <h5>Individual Skills</h5>
          <div className="skills-grid">
            {levelData.skills.map(skill => {
              const progress = progressData[skill.id];
              const currentStatus = progress?.status || 'NOT_STARTED';
              const isUpdating = updating[skill.id];

              return (
                <div key={skill.id} className={`skill-progress-card ${currentStatus.toLowerCase()}`}>
                  <div className="skill-header">
                    <h6 className="skill-name">{skill.name}</h6>
                    <span className={`badge badge-${getStatusColor(currentStatus)}`}>
                      {getStatusText(currentStatus)}
                    </span>
                  </div>

                  {canMarkProgress && (
                    <div className="progress-controls">
                      <div className="status-buttons">
                        <button
                          onClick={() => updateSkillProgress(skill.id, 'NOT_STARTED')}
                          disabled={isUpdating}
                          className={`btn btn-sm ${currentStatus === 'NOT_STARTED' ? 'btn-secondary' : 'btn-outline'}`}
                        >
                          Not Started
                        </button>
                        <button
                          onClick={() => updateSkillProgress(skill.id, 'IN_PROGRESS')}
                          disabled={isUpdating}
                          className={`btn btn-sm ${currentStatus === 'IN_PROGRESS' ? 'btn-warning' : 'btn-outline'}`}
                        >
                          In Progress
                        </button>
                        <button
                          onClick={() => updateSkillProgress(skill.id, 'COMPLETED')}
                          disabled={isUpdating}
                          className={`btn btn-sm ${currentStatus === 'COMPLETED' ? 'btn-success' : 'btn-outline'}`}
                        >
                          {isUpdating ? 'Updating...' : 'Completed'}
                        </button>
                      </div>
                    </div>
                  )}

                  {progress && (
                    <div className="progress-info">
                      {progress.completedAt && (
                        <div className="completion-date">
                          Completed: {new Date(progress.completedAt).toLocaleDateString()}
                        </div>
                      )}
                      {progress.user && (
                        <div className="marked-by">
                          Marked by: {progress.user.firstName} {progress.user.lastName}
                        </div>
                      )}
                      {progress.notes && (
                        <div className="progress-notes">
                          Notes: {progress.notes}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {levelData.routines && levelData.routines.length > 0 && (
          <div className="routines-section">
            <h5>Routines</h5>
            <div className="routines-list">
              {levelData.routines.map(routine => (
                <div key={routine.id} className="routine-card">
                  <h6>{routine.name || `Routine ${routine.order}`}</h6>
                  {routine.description && (
                    <p className="routine-description">{routine.description}</p>
                  )}
                  {routine.isAlternative && (
                    <span className="badge badge-info">Alternative</span>
                  )}
                  
                  <div className="routine-skills">
                    <h6>Required Skills:</h6>
                    <div className="routine-skills-grid">
                      {routine.routineSkills.map(routineSkill => {
                        const progress = progressData[routineSkill.skill.id];
                        const status = progress?.status || 'NOT_STARTED';
                        
                        return (
                          <div key={routineSkill.id} className={`routine-skill ${status.toLowerCase()}`}>
                            <span className="skill-name">{routineSkill.skill.name}</span>
                            <span className={`status badge-${getStatusColor(status)}`}>
                              {status === 'COMPLETED' ? '✓' : status === 'IN_PROGRESS' ? '◐' : '○'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SkillProgressTracker; 