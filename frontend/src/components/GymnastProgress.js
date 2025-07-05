import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import SkillProgressTracker from './SkillProgressTracker';
import ProgressHistory from './ProgressHistory';

const GymnastProgress = ({ gymnastId }) => {
  const [gymnast, setGymnast] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [levels, setLevels] = useState([]);
  const [coachingMode, setCoachingMode] = useState(false);
  const [selectedLevel, setSelectedLevel] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const { user } = useAuth();

  // Only coaches and club admins can use coaching tools
  const canCoach = user?.role === 'COACH' || user?.role === 'CLUB_ADMIN';

  // Helper function to sort levels by identifier
  const sortLevelsByIdentifier = (a, b) => {
    const aId = a.identifier || a.number?.toString();
    const bId = b.identifier || b.number?.toString();
    
    // Extract numeric part and letter part
    const aNum = parseFloat(aId);
    const bNum = parseFloat(bId);
    
    // If numbers are different, sort by number
    if (aNum !== bNum) {
      return aNum - bNum;
    }
    
    // If numbers are the same, sort by the full identifier (handles 3a, 3b, 3c)
    return aId.localeCompare(bId);
  };

  const handleProgressUpdate = async () => {
    try {
      const [gymnastResponse, levelsResponse] = await Promise.all([
        axios.get(`/api/gymnasts/${gymnastId}`),
        axios.get('/api/levels')
      ]);
      
      setGymnast(gymnastResponse.data);
      setLevels(levelsResponse.data);
    } catch (error) {
      console.error('Failed to refresh progress:', error);
    }
  };

  const handleSkillStatusChange = async (skillId, status) => {
    try {
      await axios.post(`/api/progress/skill`, {
        gymnastId,
        skillId,
        status
      });
      
      // Refresh data
      handleProgressUpdate();
    } catch (error) {
      console.error('Error updating skill status:', error);
    }
  };

  const handleRoutineStatusChange = async (routineId, status) => {
    try {
      await axios.put(`/api/progress/routine`, {
        gymnastId,
        routineId,
        status
      });
      
      // Refresh data
      handleProgressUpdate();
    } catch (error) {
      console.error('Error updating routine status:', error);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [gymnastResponse, levelsResponse] = await Promise.all([
          axios.get(`/api/gymnasts/${gymnastId}`),
          axios.get('/api/levels')
        ]);
        
        setGymnast(gymnastResponse.data);
        setLevels(levelsResponse.data);
      } catch (error) {
        console.error('Failed to fetch gymnast data:', error);
        setError('Failed to load gymnast progress');
      } finally {
        setLoading(false);
      }
    };

    if (gymnastId) {
      fetchData();
    }
  }, [gymnastId]);

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

  if (!gymnast) {
    return (
      <div className="alert alert-info">
        No gymnast data available.
      </div>
    );
  }

  // Process level progress data
  const levelProgress = levels.map(level => {
    const completedSkills = gymnast.skillProgress
      .filter(sp => sp.status === 'COMPLETED' && sp.skill.level.id === level.id)
      .map(sp => sp.skill);

    const totalSkills = level.skills ? level.skills.length : 0;
    const completedCount = completedSkills.length;
    const progressPercentage = totalSkills > 0 ? (completedCount / totalSkills) * 100 : 0;
    
    // Check if level is completed
    const isCompleted = gymnast.levelProgress
      .some(lp => lp.level.id === level.id && lp.status === 'COMPLETED');

    return {
      level,
      completedSkills,
      totalSkills,
      completedCount,
      isCompleted,
      progressPercentage
    };
  }).sort((a, b) => sortLevelsByIdentifier(a.level, b.level));

  // Get current and working levels
  const completedLevels = gymnast.levelProgress
    .filter(lp => lp.status === 'COMPLETED')
    .map(lp => lp.level)
    .sort(sortLevelsByIdentifier);

  // Current level should be the first level above the highest completed level
  const highestCompletedLevel = completedLevels.length > 0 ? completedLevels[completedLevels.length - 1] : null;
  
  // Find the next level in sequence after the highest completed level
  const allLevelsOrdered = levels.sort(sortLevelsByIdentifier);
  let currentLevel = null;
  
  if (highestCompletedLevel) {
    // Find the index of the highest completed level and get the next one
    const highestCompletedIndex = allLevelsOrdered.findIndex(level => level.id === highestCompletedLevel.id);
    if (highestCompletedIndex >= 0 && highestCompletedIndex < allLevelsOrdered.length - 1) {
      currentLevel = allLevelsOrdered[highestCompletedIndex + 1];
    }
  } else {
    // If no levels completed, start with the first level
    currentLevel = allLevelsOrdered[0] || null;
  }
  
  const workingLevel = gymnast.levelProgress
    .filter(lp => lp.status !== 'COMPLETED')
    .map(lp => lp.level)
    .sort(sortLevelsByIdentifier)[0];

  // Get completed skills across all levels
  const completedSkills = gymnast.skillProgress
    .filter(sp => sp.status === 'COMPLETED')
    .map(sp => sp.skill);

  return (
    <div className="gymnast-progress">
      <div className="progress-summary">
        <div className="progress-header">
          <h3>{gymnast.firstName} {gymnast.lastName}'s Progress</h3>
          {canCoach && (
            <div className="coaching-controls">
              <button
                onClick={() => setCoachingMode(!coachingMode)}
                className={`btn ${coachingMode ? 'btn-success' : 'btn-outline'}`}
              >
                {coachingMode ? 'Exit Coaching Mode' : 'Enter Coaching Mode'}
              </button>
            </div>
          )}
        </div>
        
        {/* Current Level Status */}
        <div className="current-level">
          {currentLevel ? (
            <div>
              <span className="level-badge">Current Level: {currentLevel.identifier}</span>
              <span style={{ marginLeft: '1rem', fontWeight: 'normal' }}>
                {currentLevel.name}
              </span>
            </div>
          ) : (
            <span className="badge badge-secondary">Not started</span>
          )}
          
          {workingLevel && (
            <div style={{ marginTop: '0.5rem' }}>
              <span className="badge badge-warning">
                Working on Level {workingLevel.identifier}: {workingLevel.name}
              </span>
            </div>
          )}
        </div>

        {/* Progress Statistics */}
        <div className="progress-stats">
          <div className="stat-item">
            <div className="stat-number">{completedSkills.length}</div>
            <div className="stat-label">Skills Completed</div>
          </div>
          <div className="stat-item">
            <div className="stat-number">{completedLevels.length}</div>
            <div className="stat-label">Levels Completed</div>
          </div>
          <div className="stat-item">
            <div className="stat-number">
              {gymnast.dateOfBirth 
                ? Math.floor((new Date() - new Date(gymnast.dateOfBirth)) / (365.25 * 24 * 60 * 60 * 1000))
                : 'N/A'
              }
            </div>
            <div className="stat-label">Age</div>
          </div>
        </div>
      </div>

      {/* Coaching Interface */}
      {coachingMode && canCoach && (
        <div className="coaching-interface">
          <div className="coaching-tabs">
            <button
              onClick={() => setActiveTab('overview')}
              className={`tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
            >
              Overview
            </button>
            <button
              onClick={() => setActiveTab('skill-tracking')}
              className={`tab-btn ${activeTab === 'skill-tracking' ? 'active' : ''}`}
            >
              Track Skills
            </button>
            <button
              onClick={() => setActiveTab('progress-history')}
              className={`tab-btn ${activeTab === 'progress-history' ? 'active' : ''}`}
            >
              Progress History
            </button>
          </div>

          <div className="coaching-content">
            {activeTab === 'skill-tracking' && (
              <div className="skill-tracking-section">
                <div className="level-selector">
                  <h4>Select Level for Skill Tracking</h4>
                  <div className="level-buttons">
                    {levels.map(level => (
                      <button
                        key={level.id}
                        onClick={() => setSelectedLevel(level.id)}
                        className={`btn btn-sm ${selectedLevel === level.id ? 'btn-primary' : 'btn-outline'}`}
                      >
                        Level {level.identifier}
                      </button>
                    ))}
                  </div>
                </div>
                
                {selectedLevel && (
                  <SkillProgressTracker
                    gymnastId={gymnastId}
                    levelId={selectedLevel}
                    onProgressUpdate={handleProgressUpdate}
                  />
                )}
              </div>
            )}

            {activeTab === 'progress-history' && (
              <div className="progress-history-section">
                <h4>Progress History</h4>
                <ProgressHistory gymnastId={gymnastId} />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Level Progress Overview */}
      {(!coachingMode || activeTab === 'overview') && (
        <div className="card">
          <div className="card-header">
            <h4 className="card-title">Level Progress</h4>
          </div>
          <div className="level-progress-list">
            {levelProgress.map(({ level, completedSkills, totalSkills, completedCount, isCompleted, progressPercentage }) => {
              // Get routine progress for this level
              const levelRoutines = level.routines || [];
              const routineProgress = gymnast.routineProgress?.filter(rp => 
                levelRoutines.some(lr => lr.id === rp.routine.id)
              ) || [];

              return (
                <div key={level.id} className={`level-progress-item ${isCompleted ? 'completed' : ''}`}>
                  <div className="level-header">
                    <div className="level-info">
                      <h5>Level {level.identifier}: {level.name}</h5>
                      <div className="level-stats">
                        <span className="progress-text">
                          {completedCount} of {totalSkills} skills completed
                        </span>
                        {isCompleted && (
                          <span className="badge badge-success">Level Completed</span>
                        )}
                      </div>
                    </div>
                    <div className="progress-bar-container">
                      <div className="progress-bar">
                        <div 
                          className="progress-fill" 
                          style={{ width: `${progressPercentage}%` }}
                        />
                      </div>
                      <span className="progress-percentage">{Math.round(progressPercentage)}%</span>
                    </div>
                  </div>
                  
                  {level.skills && level.skills.length > 0 && (
                    <div className="level-skills">
                      <h6>Skills:</h6>
                      <div className="skills-grid">
                        {level.skills.map(skill => {
                          const skillProgress = gymnast.skillProgress.find(sp => sp.skill.id === skill.id);
                          const currentStatus = skillProgress?.status || 'NOT_STARTED';
                          
                          return (
                            <div key={skill.id} className={`skill-card skill-${currentStatus.toLowerCase()}`}>
                              <div className="skill-name">{skill.name}</div>
                              {canCoach && coachingMode && (
                                <div className="skill-controls">
                                  <button
                                    onClick={() => handleSkillStatusChange(skill.id, 'NOT_STARTED')}
                                    className={`btn btn-xs ${currentStatus === 'NOT_STARTED' ? 'btn-secondary' : 'btn-outline'}`}
                                    title="Not Started"
                                  >
                                    ○
                                  </button>
                                  <button
                                    onClick={() => handleSkillStatusChange(skill.id, 'IN_PROGRESS')}
                                    className={`btn btn-xs ${currentStatus === 'IN_PROGRESS' ? 'btn-warning' : 'btn-outline'}`}
                                    title="In Progress"
                                  >
                                    ◐
                                  </button>
                                  <button
                                    onClick={() => handleSkillStatusChange(skill.id, 'COMPLETED')}
                                    className={`btn btn-xs ${currentStatus === 'COMPLETED' ? 'btn-success' : 'btn-outline'}`}
                                    title="Completed"
                                  >
                                    ✓
                                  </button>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Routine Section */}
                  {levelRoutines.length > 0 && (
                    <div className="level-routines">
                      <h6>Routine:</h6>
                      {levelRoutines.map(routine => {
                        const routineProgressData = routineProgress.find(rp => rp.routine.id === routine.id);
                        const routineStatus = routineProgressData?.status || 'NOT_STARTED';
                        const routineSkills = routine.routineSkills || [];
                        
                        return (
                          <div key={routine.id} className={`routine-card routine-${routineStatus.toLowerCase()}`}>
                            <div className="routine-header">
                              <div className="routine-info">
                                <div className="routine-name">
                                  {routine.name || `Level ${level.identifier} Routine`}
                                </div>
                                <div className="routine-status">
                                  {routineStatus === 'COMPLETED' && (
                                    <span className="badge badge-success">Routine Completed</span>
                                  )}
                                  {routineStatus === 'NOT_STARTED' && (
                                    <span className="badge badge-secondary">Not Started</span>
                                  )}
                                </div>
                              </div>
                              {canCoach && coachingMode && (
                                <div className="routine-controls">
                                  <button
                                    onClick={() => handleRoutineStatusChange(routine.id, 'NOT_STARTED')}
                                    className={`btn btn-sm ${routineStatus === 'NOT_STARTED' ? 'btn-secondary' : 'btn-outline'}`}
                                    title="Not Started"
                                  >
                                    Not Started
                                  </button>
                                  <button
                                    onClick={() => handleRoutineStatusChange(routine.id, 'COMPLETED')}
                                    className={`btn btn-sm ${routineStatus === 'COMPLETED' ? 'btn-success' : 'btn-outline'}`}
                                    title="Completed"
                                  >
                                    Completed
                                  </button>
                                </div>
                              )}
                            </div>
                            
                            {routineSkills.length > 0 && (
                              <div className="routine-skills">
                                <div className="routine-skills-header">Required Skills:</div>
                                <div className="routine-skills-list">
                                  {routineSkills.map(rs => (
                                    <span key={rs.id} className="routine-skill-item">
                                      {rs.skill.name}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Guardians */}
      {gymnast.guardians && gymnast.guardians.length > 0 && (
        <div className="card">
          <div className="card-header">
            <h4 className="card-title">Guardians</h4>
          </div>
          <div className="guardian-list">
            {gymnast.guardians.map(guardian => (
              <div key={guardian.id} className="guardian-item">
                <strong>{guardian.firstName} {guardian.lastName}</strong>
                <span className="text-muted">{guardian.email}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default GymnastProgress; 