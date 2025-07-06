import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import SkillProgressTracker from './SkillProgressTracker';
import LevelProgressTracker from './LevelProgressTracker';
import ProgressHistory from './ProgressHistory';
import CoachNotes from './CoachNotes';
import EditGymnastForm from './EditGymnastForm';
import CertificateDisplay from './CertificateDisplay';

const GymnastProgress = ({ gymnastId }) => {
  const [gymnast, setGymnast] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [levels, setLevels] = useState([]);
  const [coachingMode, setCoachingMode] = useState(false);

  const [activeTab, setActiveTab] = useState('overview');
  const [collapsedLevels, setCollapsedLevels] = useState(new Set());
  const { user } = useAuth();

  // Only coaches and club admins can use coaching tools
  const canCoach = user?.role === 'COACH' || user?.role === 'CLUB_ADMIN';

  // Set coaching mode to true by default for coaches and club admins
  useEffect(() => {
    if (canCoach) {
      setCoachingMode(true);
    }
  }, [canCoach]);

  // Helper function to extract base level number from identifier
  const getBaseLevelNumber = useCallback((identifier) => {
    const match = identifier.match(/^(\d+)/);
    return match ? parseInt(match[1], 10) : 0;
  }, []);

  // Helper function to check if a level is a side-track
  const isSideTrack = useCallback((identifier) => {
    return /^\d+[a-z]$/.test(identifier);
  }, []);

  // Helper function to determine the gymnast's current working level number
  const getCurrentLevelNumber = useCallback((gymnast, levels) => {
    if (!gymnast || !levels.length) return 1;

    // Get all completed main track levels (ignore side tracks)
    const completedMainTrackLevels = gymnast.levelProgress
      .filter(lp => lp.status === 'COMPLETED')
      .map(lp => lp.level)
      .filter(level => !isSideTrack(level.identifier)) // Only main track levels
      .map(level => parseInt(level.identifier))
      .sort((a, b) => a - b);

    // Find the next main track level to work on
    if (completedMainTrackLevels.length === 0) {
      return 1; // Start with level 1
    }

    // Find the highest completed main track level
    const highestCompleted = Math.max(...completedMainTrackLevels);
    
    // Return the next level in sequence
    return highestCompleted + 1;
  }, [isSideTrack]);

  // Helper function to check if a side-track should be available
  const isSideTrackAvailable = useCallback((level, currentLevelNumber) => {
    if (!isSideTrack(level.identifier)) {
      return true; // Regular levels are always available
    }

    const baseLevelNumber = getBaseLevelNumber(level.identifier);
    return currentLevelNumber >= baseLevelNumber;
  }, [isSideTrack, getBaseLevelNumber]);

  // Helper function to toggle level collapse
  const toggleLevelCollapse = (levelId) => {
    setCollapsedLevels(prev => {
      const newSet = new Set(prev);
      if (newSet.has(levelId)) {
        newSet.delete(levelId);
      } else {
        newSet.add(levelId);
      }
      return newSet;
    });
  };

  // Helper function to determine which levels should be auto-collapsed
  const getAutoCollapsedLevels = useCallback((levelProgressData, currentLevelNumber) => {
    const autoCollapsed = new Set();
    levelProgressData.forEach(({ level, progressPercentage }) => {
      // Never collapse the current main track level
      const isCurrentMainTrackLevel = !isSideTrack(level.identifier) && 
                                     parseInt(level.identifier) === currentLevelNumber;
      
      // Collapse levels that are 0% or 100% complete, except the current level
      if (!isCurrentMainTrackLevel && (progressPercentage === 0 || progressPercentage === 100)) {
        autoCollapsed.add(level.id);
      }
    });
    return autoCollapsed;
  }, [isSideTrack]);

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

  // Helper function to scroll to and expand a specific level
  const scrollToLevel = (levelId) => {
    // Expand the level if it's collapsed
    setCollapsedLevels(prev => {
      const newSet = new Set(prev);
      newSet.delete(levelId); // Remove from collapsed set to expand it
      return newSet;
    });

    // Scroll to the level after a brief delay to ensure it's expanded
    setTimeout(() => {
      const levelElement = document.getElementById(`level-${levelId}`);
      if (levelElement) {
        levelElement.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'start',
          inline: 'nearest'
        });
      }
    }, 100);
  };

  const handleProgressUpdate = async () => {
    try {
      const [gymnastResponse, levelsResponse] = await Promise.all([
        axios.get(`/api/gymnasts/${gymnastId}`),
        axios.get('/api/levels')
      ]);
      
      setGymnast(gymnastResponse.data);
      setLevels(levelsResponse.data);
      
      // Auto-collapse levels after data update
      if (gymnastResponse.data && levelsResponse.data.length > 0) {
        const currentLevelNum = getCurrentLevelNumber(gymnastResponse.data, levelsResponse.data);
        const availableLvls = levelsResponse.data.filter(level => 
          isSideTrackAvailable(level, currentLevelNum)
        );

        const levelProgressData = availableLvls.map(level => {
          const completedSkills = gymnastResponse.data.skillProgress
            .filter(sp => sp.status === 'COMPLETED' && sp.skill.level.id === level.id)
            .map(sp => sp.skill);

          const totalSkills = level.skills ? level.skills.length : 0;
          const completedCount = completedSkills.length;
          const progressPercentage = totalSkills > 0 ? (completedCount / totalSkills) * 100 : 0;
          
          return {
            level,
            progressPercentage
          };
        });

        const autoCollapsed = getAutoCollapsedLevels(levelProgressData, currentLevelNum);
        setCollapsedLevels(autoCollapsed);
      }
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

  const handleEditGymnastSuccess = (updatedGymnast) => {
    setGymnast(updatedGymnast);
    setActiveTab('overview');
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const [gymnastResponse, levelsResponse] = await Promise.all([
          axios.get(`/api/gymnasts/${gymnastId}`),
          axios.get('/api/levels')
        ]);
        
        setGymnast(gymnastResponse.data);
        setLevels(levelsResponse.data);
        
        // Auto-collapse levels on initial load
        if (gymnastResponse.data && levelsResponse.data.length > 0) {
          const currentLevelNum = getCurrentLevelNumber(gymnastResponse.data, levelsResponse.data);
          const availableLvls = levelsResponse.data.filter(level => 
            isSideTrackAvailable(level, currentLevelNum)
          );

          const levelProgressData = availableLvls.map(level => {
            const completedSkills = gymnastResponse.data.skillProgress
              .filter(sp => sp.status === 'COMPLETED' && sp.skill.level.id === level.id)
              .map(sp => sp.skill);

            const totalSkills = level.skills ? level.skills.length : 0;
            const completedCount = completedSkills.length;
            const progressPercentage = totalSkills > 0 ? (completedCount / totalSkills) * 100 : 0;
            
            return {
              level,
              progressPercentage
            };
          });

          const autoCollapsed = getAutoCollapsedLevels(levelProgressData, currentLevelNum);
          setCollapsedLevels(autoCollapsed);
        }
      } catch (error) {
        console.error('Failed to fetch data:', error);
        setError('Failed to load gymnast data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [gymnastId, getAutoCollapsedLevels, getCurrentLevelNumber, isSideTrackAvailable]);

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
  const nextMainLevelNumber = getCurrentLevelNumber(gymnast, levels);
  
  // Filter levels based on side-track availability
  const availableLevels = levels.filter(level => 
    isSideTrackAvailable(level, nextMainLevelNumber)
  );

  const levelProgress = availableLevels.map(level => {
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

  // Current level should be the next main track level to work on
  const nextMainTrackLevelNumber = getCurrentLevelNumber(gymnast, levels);
  const currentLevel = levels.find(level => 
    !isSideTrack(level.identifier) && parseInt(level.identifier) === nextMainTrackLevelNumber
  ) || null;
  
  // Remove unused variables - highestCompletedLevel and completedSkills
  
  const workingLevel = gymnast.levelProgress
    .filter(lp => lp.status !== 'COMPLETED')
    .map(lp => lp.level)
    .sort(sortLevelsByIdentifier)[0];

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
            <div 
              onClick={() => scrollToLevel(currentLevel.id)}
              style={{ cursor: 'pointer' }}
              title="Click to scroll to this level"
            >
              <span className="coaching-label">Current Level:</span>
              <span className="level-badge clickable">{currentLevel.name}</span>
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
              onClick={() => setActiveTab('progress-history')}
              className={`tab-btn ${activeTab === 'progress-history' ? 'active' : ''}`}
            >
              Progress History
            </button>
            <button
              onClick={() => setActiveTab('coach-notes')}
              className={`tab-btn ${activeTab === 'coach-notes' ? 'active' : ''}`}
            >
              Coach Notes
            </button>
            <button
              onClick={() => setActiveTab('edit-gymnast')}
              className={`tab-btn ${activeTab === 'edit-gymnast' ? 'active' : ''}`}
            >
              Edit Gymnast
            </button>
            <button
              onClick={() => setActiveTab('certificates')}
              className={`tab-btn ${activeTab === 'certificates' ? 'active' : ''}`}
            >
              🏆 Certificates
            </button>
          </div>

          <div className="coaching-content">
            {activeTab === 'progress-history' && (
              <div className="progress-history-section">
                <h4>Progress History</h4>
                <ProgressHistory gymnastId={gymnastId} />
              </div>
            )}

            {activeTab === 'coach-notes' && (
              <div className="coach-notes-section">
                <CoachNotes 
                  gymnast={gymnast} 
                  onNotesUpdate={(updatedGymnast) => {
                    setGymnast(updatedGymnast);
                  }}
                />
              </div>
            )}

            {activeTab === 'edit-gymnast' && (
              <div className="edit-gymnast-section">
                <EditGymnastForm
                  gymnast={gymnast}
                  onSuccess={handleEditGymnastSuccess}
                  onCancel={() => setActiveTab('overview')}
                />
              </div>
            )}

            {activeTab === 'certificates' && (
              <div className="certificates-section">
                <CertificateDisplay 
                  gymnastId={gymnastId} 
                  showActions={canCoach}
                />
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
            <div className="collapse-info">
              <small className="text-muted">
                💡 Levels with 0% or 100% progress are collapsed by default. Click ▼/▲ to expand/collapse.
              </small>
            </div>
          </div>
          <div className="level-progress-list">
            {levelProgress.map(({ level, completedSkills, totalSkills, completedCount, isCompleted, progressPercentage }) => {
              // Get routine progress for this level
              const levelRoutines = level.routines || [];
              const routineProgress = gymnast.routineProgress?.filter(rp => 
                levelRoutines.some(lr => lr.id === rp.routine.id)
              ) || [];

              const isCollapsed = collapsedLevels.has(level.id);
              const levelClass = `level-progress-item ${isCompleted ? 'completed' : ''} ${isSideTrack(level.identifier) ? 'side-track-level' : ''}`;

              return (
                <div key={level.id} id={`level-${level.id}`} className={levelClass}>
                  <div className="level-header">
                    <div className="level-info">
                      <div className="level-title-row">
                        <h5>
                          {level.identifier} - {level.name}
                          {isSideTrack(level.identifier) && (
                            <span className="side-track-badge">Side-track</span>
                          )}
                        </h5>
                      </div>
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

                      <button
                          onClick={() => toggleLevelCollapse(level.id)}
                          className="btn btn-xs btn-outline collapse-toggle"
                          title={isCollapsed ? 'Expand level' : 'Collapse level'}
                        >
                          {isCollapsed ? '▼' : '▲'}
                        </button>
                    </div>
                  </div>
                  
                  {!isCollapsed && (
                    <div className="level-content">
                      {level.competitions && level.competitions.length > 0 && (
                        <div className="competition-levels">
                          {level.competitions.map((competition, index) => (
                            <span key={index} className="competition-badge">
                              {competition.name}
                            </span>
                          ))}
                        </div>
                      )}
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
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Certificates Section */}
      <div className="card">
        <CertificateDisplay 
          gymnastId={gymnastId} 
          showActions={false}
        />
      </div>

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