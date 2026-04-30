import React, { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { computeFigDifficulty } from '../utils/figDifficulty';

// Encode/decode the halfTwistsPerSom array to the FIG digit string convention.
//   [0, 1]  ⇄ '-1'
//   [0, 0]  ⇄ '--'
//   [4]     ⇄ '4'
//   []      ⇄ ''
function encodeHalfTwists(arr) {
  if (!arr || arr.length === 0) return '';
  return arr.map(t => (t === 0 || t == null) ? '-' : String(t)).join('');
}
function decodeHalfTwists(str) {
  if (!str) return [];
  return str.split('').map(c => (c === '-' ? 0 : Number(c) || 0));
}

const Levels = () => {
  const [levels, setLevels] = useState([]);
  const [availableSkills, setAvailableSkills] = useState([]);
  const [competitions, setCompetitions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editingLevel, setEditingLevel] = useState(null);
  const [editingSkill, setEditingSkill] = useState(null);
  const [editingRoutine, setEditingRoutine] = useState(null);
  const [showAddSkillForm, setShowAddSkillForm] = useState(null);
  const [showAddRoutineForm, setShowAddRoutineForm] = useState(null);
  const [showAddSkillToRoutineForm, setShowAddSkillToRoutineForm] = useState(null);
  const [showAddLevelForm, setShowAddLevelForm] = useState(false);
  const [expandedLevels, setExpandedLevels] = useState(new Set());
  const [expandedRoutines, setExpandedRoutines] = useState(new Set());
  const [editMode, setEditMode] = useState(false);
  const { canEditLevels } = useAuth();

  // Close any open modals when edit mode is turned off
  const toggleEditMode = () => {
    if (editMode) {
      // Close all open modals when exiting edit mode
      setEditingLevel(null);
      setEditingSkill(null);
      setEditingRoutine(null);
      setShowAddSkillForm(null);
      setShowAddRoutineForm(null);
      setShowAddSkillToRoutineForm(null);
      setShowAddLevelForm(false);
    }
    setEditMode(!editMode);
  };

  useEffect(() => {
    if (canEditLevels) {
      fetchLevels();
      fetchCompetitions();
    }
  }, [canEditLevels]);

  const fetchAvailableSkills = useCallback(async () => {
    try {
      // Use the first level ID to get available skills (endpoint works with any level)
      const response = await axios.get(`/api/levels/${levels[0].id}/available-skills`);
      setAvailableSkills(response.data);
    } catch (error) {
      console.error('Failed to fetch available skills:', error);
    }
  }, [levels]);

  useEffect(() => {
    if (canEditLevels && levels.length > 0) {
      fetchAvailableSkills();
    }
  }, [canEditLevels, levels, fetchAvailableSkills]);

  // Only club admins can access this page
  if (!canEditLevels) {
    return (
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Access Denied</h3>
        </div>
        <div>
          <p>You don't have permission to access the levels management page.</p>
          <p>Only club administrators can view and manage trampoline levels.</p>
        </div>
      </div>
    );
  }

  const fetchLevels = async () => {
    try {
      const response = await axios.get('/api/levels');
      setLevels(response.data);
      // Collapsed by default
      setExpandedLevels(new Set());
    } catch (error) {
      console.error('Failed to fetch levels:', error);
      setError('Failed to load levels');
    } finally {
      setLoading(false);
    }
  };

  const fetchCompetitions = async () => {
    try {
      const response = await axios.get('/api/competitions');
      setCompetitions(response.data.filter(comp => comp.isActive));
    } catch (error) {
      console.error('Failed to fetch competitions:', error);
    }
  };

  // Remove duplicate function declaration - using useCallback version above

  const toggleLevelExpansion = (levelId) => {
    const newExpanded = new Set(expandedLevels);
    if (newExpanded.has(levelId)) {
      newExpanded.delete(levelId);
    } else {
      newExpanded.add(levelId);
    }
    setExpandedLevels(newExpanded);
  };

  const toggleRoutineExpansion = (routineId) => {
    const newExpanded = new Set(expandedRoutines);
    if (newExpanded.has(routineId)) {
      newExpanded.delete(routineId);
    } else {
      newExpanded.add(routineId);
    }
    setExpandedRoutines(newExpanded);
  };

  const handleUpdateLevel = async (levelId, levelData) => {
    try {
      const response = await axios.put(`/api/levels/${levelId}`, levelData);
      setLevels(levels.map(level => 
        level.id === levelId ? response.data : level
      ));
      setEditingLevel(null);
    } catch (error) {
      console.error('Failed to update level:', error);
      setError(error.response?.data?.error || 'Failed to update level');
    }
  };

  const handleCreateLevel = async (levelData) => {
    try {
      const response = await axios.post('/api/levels', levelData);
      setLevels([...levels, response.data]);
      setShowAddLevelForm(false);
      // Expand the new level automatically
      setExpandedLevels(prev => new Set([...prev, response.data.id]));
    } catch (error) {
      console.error('Failed to create level:', error);
      setError(error.response?.data?.error || 'Failed to create level');
    }
  };

  const handleCreateSkill = async (levelId, skillData) => {
    try {
      const response = await axios.post(`/api/levels/${levelId}/skills`, skillData);
      setLevels(levels.map(level => {
        if (level.id === levelId) {
          return {
            ...level,
            skills: [...level.skills, response.data]
          };
        }
        return level;
      }));
      setShowAddSkillForm(null);
    } catch (error) {
      console.error('Failed to create skill:', error);
      setError(error.response?.data?.error || 'Failed to create skill');
    }
  };

  const handleUpdateSkill = async (levelId, skillId, skillData) => {
    try {
      const response = await axios.put(`/api/levels/${levelId}/skills/${skillId}`, skillData);
      setLevels(levels.map(level => {
        if (level.id === levelId) {
          return {
            ...level,
            skills: level.skills.map(skill => 
              skill.id === skillId ? response.data : skill
            )
          };
        }
        return level;
      }));
      setEditingSkill(null);
    } catch (error) {
      console.error('Failed to update skill:', error);
      setError(error.response?.data?.error || 'Failed to update skill');
    }
  };

  const handleDeleteSkill = async (levelId, skillId) => {
    if (!window.confirm('Are you sure you want to delete this skill? This action cannot be undone.')) {
      return;
    }

    try {
      await axios.delete(`/api/levels/${levelId}/skills/${skillId}`);
      setLevels(levels.map(level => {
        if (level.id === levelId) {
          return {
            ...level,
            skills: level.skills.filter(skill => skill.id !== skillId)
          };
        }
        return level;
      }));
    } catch (error) {
      console.error('Failed to delete skill:', error);
      setError(error.response?.data?.error || 'Failed to delete skill');
    }
  };

  const handleCreateRoutine = async (levelId, routineData) => {
    try {
      const response = await axios.post(`/api/levels/${levelId}/routines`, routineData);
      setLevels(levels.map(level => {
        if (level.id === levelId) {
          return {
            ...level,
            routines: [...level.routines, response.data]
          };
        }
        return level;
      }));
      setShowAddRoutineForm(null);
    } catch (error) {
      console.error('Failed to create routine:', error);
      setError(error.response?.data?.error || 'Failed to create routine');
    }
  };

  const handleUpdateRoutine = async (levelId, routineId, routineData) => {
    try {
      const response = await axios.put(`/api/levels/${levelId}/routines/${routineId}`, routineData);
      setLevels(levels.map(level => {
        if (level.id === levelId) {
          return {
            ...level,
            routines: level.routines.map(routine => 
              routine.id === routineId ? response.data : routine
            )
          };
        }
        return level;
      }));
      setEditingRoutine(null);
    } catch (error) {
      console.error('Failed to update routine:', error);
      setError(error.response?.data?.error || 'Failed to update routine');
    }
  };

  const handleDeleteRoutine = async (levelId, routineId) => {
    if (!window.confirm('Are you sure you want to delete this routine? This action cannot be undone.')) {
      return;
    }

    try {
      await axios.delete(`/api/levels/${levelId}/routines/${routineId}`);
      setLevels(levels.map(level => {
        if (level.id === levelId) {
          return {
            ...level,
            routines: level.routines.filter(routine => routine.id !== routineId)
          };
        }
        return level;
      }));
    } catch (error) {
      console.error('Failed to delete routine:', error);
      setError(error.response?.data?.error || 'Failed to delete routine');
    }
  };

  const handleAddSkillToRoutine = async (levelId, routineId, skillId, customSkillName = null) => {
    try {
      const response = await axios.post(`/api/levels/${levelId}/routines/${routineId}/skills`, {
        skillId,
        customSkillName
      });
      
      setLevels(levels.map(level => {
        if (level.id === levelId) {
          return {
            ...level,
            routines: level.routines.map(routine => {
              if (routine.id === routineId) {
                return {
                  ...routine,
                  skills: [...routine.skills, response.data.skill]
                };
              }
              return routine;
            })
          };
        }
        return level;
      }));
      setShowAddSkillToRoutineForm(null);
    } catch (error) {
      console.error('Failed to add skill to routine:', error);
      setError(error.response?.data?.error || 'Failed to add skill to routine');
    }
  };

  const handleRemoveSkillFromRoutine = async (levelId, routineId, skillId) => {
    if (!window.confirm('Are you sure you want to remove this skill from the routine?')) {
      return;
    }

    try {
      await axios.delete(`/api/levels/${levelId}/routines/${routineId}/skills/${skillId}`);
      setLevels(levels.map(level => {
        if (level.id === levelId) {
          return {
            ...level,
            routines: level.routines.map(routine => {
              if (routine.id === routineId) {
                return {
                  ...routine,
                  skills: routine.skills.filter(skill => skill.id !== skillId)
                };
              }
              return routine;
            })
          };
        }
        return level;
      }));
    } catch (error) {
      console.error('Failed to remove skill from routine:', error);
      setError(error.response?.data?.error || 'Failed to remove skill from routine');
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
        <button 
          onClick={() => setError(null)}
          className="btn btn-sm btn-outline"
          style={{ marginLeft: '10px' }}
        >
          Dismiss
        </button>
      </div>
    );
  }

  const sequentialLevels = levels.filter(level => level.type === 'SEQUENTIAL');
  const sidePaths = levels.filter(level => level.type === 'SIDE_PATH');

  return (
    <div>
      <div className="flex-between">
        <h1>Trampoline Levels</h1>
        {canEditLevels && (
          <div className="flex-end">
            <button
              onClick={toggleEditMode}
              className={`btn ${editMode ? 'btn-danger' : 'btn-outline'}`}
            >
              {editMode ? 'Exit Edit Mode' : 'Edit Mode'}
            </button>
            {editMode && (
              <button
                onClick={() => setShowAddLevelForm(true)}
                className="btn btn-primary"
                style={{ marginLeft: '10px' }}
              >
                + Add New Level
              </button>
            )}
            {editMode && (
              <div className="level-management-info">
                <span className="text-muted">
                  Click items to edit, use + buttons to add new content
                </span>
              </div>
            )}
          </div>
        )}
      </div>
      
      {levels.length === 0 ? (
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">No Levels Found</h3>
          </div>
          <div>
            <p>No trampoline levels have been configured yet.</p>
            <p>Please contact your club administrator to set up the skill levels.</p>
          </div>
        </div>
      ) : (
        <div>
          {/* Sequential Levels */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Sequential Levels (1-10)</h3>
            </div>
            <div>
              <p>These levels must be completed in order from Level 1 to Level 10.</p>
              <div className="levels-container">
                {sequentialLevels.map(level => (
                  <LevelCard
                    key={level.id}
                    level={level}
                    canEdit={canEditLevels && editMode}
                    isExpanded={expandedLevels.has(level.id)}
                    onToggleExpansion={() => toggleLevelExpansion(level.id)}
                    onEditLevel={() => setEditingLevel(level)}
                    onUpdateLevel={handleUpdateLevel}
                    onAddSkill={() => setShowAddSkillForm(level.id)}
                    onEditSkill={setEditingSkill}
                    onUpdateSkill={handleUpdateSkill}
                    onDeleteSkill={handleDeleteSkill}
                    onAddRoutine={() => setShowAddRoutineForm(level.id)}
                    onEditRoutine={setEditingRoutine}
                    onUpdateRoutine={handleUpdateRoutine}
                    onDeleteRoutine={handleDeleteRoutine}
                    onAddSkillToRoutine={(routineId) => setShowAddSkillToRoutineForm({ levelId: level.id, routineId })}
                    onRemoveSkillFromRoutine={handleRemoveSkillFromRoutine}
                    expandedRoutines={expandedRoutines}
                    onToggleRoutineExpansion={toggleRoutineExpansion}
                    availableSkills={availableSkills}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Side Paths */}
          {sidePaths.length > 0 && (
            <div className="card">
              <div className="card-header">
                <h3 className="card-title">Side Paths</h3>
              </div>
              <div>
                <p>These specialized skill paths can be completed alongside the sequential levels.</p>
                <div className="levels-container">
                  {sidePaths.map(level => (
                    <LevelCard
                      key={level.id}
                      level={level}
                      canEdit={canEditLevels && editMode}
                      isExpanded={expandedLevels.has(level.id)}
                      onToggleExpansion={() => toggleLevelExpansion(level.id)}
                      onEditLevel={() => setEditingLevel(level)}
                      onUpdateLevel={handleUpdateLevel}
                      onAddSkill={() => setShowAddSkillForm(level.id)}
                      onEditSkill={setEditingSkill}
                      onUpdateSkill={handleUpdateSkill}
                      onDeleteSkill={handleDeleteSkill}
                      onAddRoutine={() => setShowAddRoutineForm(level.id)}
                      onEditRoutine={setEditingRoutine}
                      onUpdateRoutine={handleUpdateRoutine}
                      onDeleteRoutine={handleDeleteRoutine}
                      onAddSkillToRoutine={(routineId) => setShowAddSkillToRoutineForm({ levelId: level.id, routineId })}
                      onRemoveSkillFromRoutine={handleRemoveSkillFromRoutine}
                      expandedRoutines={expandedRoutines}
                      onToggleRoutineExpansion={toggleRoutineExpansion}
                      availableSkills={availableSkills}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Edit Level Modal */}
      {editingLevel && editMode && (
        <EditLevelModal
          level={editingLevel}
          competitions={competitions}
          onSave={(levelData) => handleUpdateLevel(editingLevel.id, levelData)}
          onCancel={() => setEditingLevel(null)}
        />
      )}

      {/* Edit Skill Modal */}
      {editingSkill && editMode && (
        <SkillFormModal
          mode="edit"
          skill={editingSkill}
          onSave={(skillData) => handleUpdateSkill(editingSkill.levelId, editingSkill.id, skillData)}
          onCancel={() => setEditingSkill(null)}
        />
      )}

      {/* Edit Routine Modal */}
      {editingRoutine && editMode && (
        <EditRoutineModal
          routine={editingRoutine}
          onSave={(routineData) => handleUpdateRoutine(editingRoutine.levelId, editingRoutine.id, routineData)}
          onCancel={() => setEditingRoutine(null)}
        />
      )}

      {/* Add Skill Modal */}
      {showAddSkillForm && editMode && (
        <SkillFormModal
          mode="add"
          onSave={(skillData) => handleCreateSkill(showAddSkillForm, skillData)}
          onCancel={() => setShowAddSkillForm(null)}
        />
      )}

      {/* Add Routine Modal */}
      {showAddRoutineForm && editMode && (
        <AddRoutineModal
          levelId={showAddRoutineForm}
          onSave={(routineData) => handleCreateRoutine(showAddRoutineForm, routineData)}
          onCancel={() => setShowAddRoutineForm(null)}
        />
      )}

      {/* Add Skill to Routine Modal */}
      {showAddSkillToRoutineForm && editMode && (
        <AddSkillToRoutineModal
          levelId={showAddSkillToRoutineForm.levelId}
          routineId={showAddSkillToRoutineForm.routineId}
          availableSkills={availableSkills}
          onSave={(skillId, customSkillName) => handleAddSkillToRoutine(showAddSkillToRoutineForm.levelId, showAddSkillToRoutineForm.routineId, skillId, customSkillName)}
          onCancel={() => setShowAddSkillToRoutineForm(null)}
        />
      )}

      {/* Add Level Modal */}
      {showAddLevelForm && editMode && (
        <AddLevelModal
          competitions={competitions}
          onSave={handleCreateLevel}
          onCancel={() => setShowAddLevelForm(false)}
        />
      )}
    </div>
  );
};

// LevelCard Component
const LevelCard = ({ 
  level, 
  canEdit, 
  isExpanded, 
  onToggleExpansion, 
  onEditLevel, 
  onUpdateLevel, 
  onAddSkill, 
  onEditSkill, 
  onUpdateSkill, 
  onDeleteSkill,
  onAddRoutine,
  onEditRoutine,
  onUpdateRoutine,
  onDeleteRoutine,
  onAddSkillToRoutine,
  onRemoveSkillFromRoutine,
  expandedRoutines,
  onToggleRoutineExpansion,
  availableSkills
}) => {
  return (
    <div className="level-card">
      <div className="level-header">
        <div className="level-title-section">
          <button 
            onClick={onToggleExpansion}
            className="expand-button"
          >
            {isExpanded ? '▼' : '▶'}
          </button>
          <h4 className="level-title">
            Level {level.identifier || level.number}: {level.name}
          </h4>
          {canEdit && (
            <button onClick={onEditLevel} className="edit-mode-btn" title="Edit level">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
          )}
        </div>
        
        {/* Competition Levels */}
        {level.competitions && level.competitions.length > 0 && (
          <div className="competition-levels">
            <span className="competition-label">Competitions:</span>
            {level.competitions.map((competition, index) => (
              <span 
                key={index} 
                className={`competition-badge ${competition.category ? competition.category.toLowerCase() : ''}`}
              >
                {competition.name}
              </span>
            ))}
          </div>
        )}
      </div>

      {isExpanded && (
        <div className="level-content">
          {level.description && (
            <p className="level-description">{level.description}</p>
          )}
          
          {/* Skills Section */}
          <div className="skills-section">
            <div className="section-header">
              <h5>Skills ({level.skills.length})</h5>
              {/* Add Skill moved below list for better flow */}
            </div>
            
            {level.skills.length > 0 ? (
              <div className="skills-grid">
                {level.skills.map(skill => (
                  <div key={skill.id}>
                    <div className="routine-skill-item">
                      <span className="skill-name">{skill.name}</span>
                      {canEdit && (
                        <span className="edit-mode-btn-group">
                          <button onClick={() => onEditSkill(skill)} className="edit-mode-btn" title="Edit skill">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                          </button>
                          <button onClick={() => onDeleteSkill(level.id, skill.id)} className="edit-mode-btn edit-mode-btn--delete" title="Delete skill">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                          </button>
                        </span>
                      )}
                    </div>
                    {skill.description && (
                      <div className="skill-description" style={{ marginTop: '0.25rem' }}>{skill.description}</div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted">No skills defined</p>
            )}
            {canEdit && (
              <div style={{ marginTop: '0.5rem' }}>
                <button onClick={onAddSkill} className="edit-mode-add-btn">+ Add Skill</button>
              </div>
            )}
          </div>

          {/* Routines Section */}
          <div className="routines-section">
            <div className="section-header">
              <h5>Routines ({level.routines.length})</h5>
              {canEdit && (
                <button onClick={onAddRoutine} className="edit-mode-add-btn">+ Add Routine</button>
              )}
            </div>
            
            {level.routines.length > 0 ? (
              <div className="routines-list">
                {level.routines.map(routine => (
                  <RoutineCard
                    key={routine.id}
                    routine={routine}
                    levelId={level.id}
                    canEdit={canEdit}
                    isExpanded={expandedRoutines.has(routine.id)}
                    onToggleExpansion={() => onToggleRoutineExpansion(routine.id)}
                    onEditRoutine={() => onEditRoutine(routine)}
                    onDeleteRoutine={() => onDeleteRoutine(level.id, routine.id)}
                    onAddSkillToRoutine={() => onAddSkillToRoutine(routine.id)}
                    onRemoveSkillFromRoutine={onRemoveSkillFromRoutine}
                  />
                ))}
              </div>
            ) : (
              <p className="text-muted">No routines defined</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// RoutineCard Component
const RoutineCard = ({ 
  routine, 
  levelId, 
  canEdit, 
  isExpanded, 
  onToggleExpansion, 
  onEditRoutine, 
  onDeleteRoutine,
  onAddSkillToRoutine,
  onRemoveSkillFromRoutine
}) => {
  return (
    <div className="routine-card">
      <div className="routine-header">
        <div className="routine-title-section">
          <button 
            onClick={onToggleExpansion}
            className="expand-button"
          >
            {isExpanded ? '▼' : '▶'}
          </button>
          <h6 className="routine-title">
            {routine.name || `Routine ${routine.order}`}
          </h6>
          {routine.isAlternative && (
            <span className="badge badge-info">Alternative</span>
          )}
          {canEdit && (
            <span className="edit-mode-btn-group">
              <button onClick={onEditRoutine} className="edit-mode-btn" title="Edit routine">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              </button>
              <button onClick={onDeleteRoutine} className="edit-mode-btn edit-mode-btn--delete" title="Delete routine">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
              </button>
            </span>
          )}
        </div>
      </div>

      {isExpanded && (
        <div className="routine-content">
          {routine.description && (
            <p className="routine-description">{routine.description}</p>
          )}
          
          <div className="routine-skills-section">
            <div className="section-header">
              <h6>Required Skills ({routine.skills.length})</h6>
              {canEdit && (
                <button onClick={onAddSkillToRoutine} className="edit-mode-add-btn">+ Add Skill</button>
              )}
            </div>

            {routine.skills.length > 0 ? (
              <div className="routine-skills-list">
                {routine.skills.map(skill => {
                  const dd = skill.difficulty != null ? Number(skill.difficulty) : null;
                  return (
                    <div key={skill.id} className="routine-skill-item">
                      <span className="skill-name" style={{
                        fontStyle: skill.isImplicit ? 'italic' : 'normal',
                        color: skill.isImplicit ? '#666' : 'inherit'
                      }}>
                        {skill.name}
                        {skill.isImplicit && <span className="badge badge-info" style={{ marginLeft: '0.5rem', fontSize: '0.7rem' }}>Implicit</span>}
                      </span>
                      <span className="skill-dd-info" style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        {skill.figNotation && (
                          <code style={{ fontSize: '0.75rem', color: '#555', background: '#f0f0f0', padding: '1px 4px', borderRadius: '3px' }}>
                            {skill.figNotation}
                          </code>
                        )}
                        {dd != null && (
                          <span style={{ fontSize: '0.75rem', color: '#555', minWidth: '2.5rem', textAlign: 'right' }}>
                            {dd.toFixed(1)}
                          </span>
                        )}
                      </span>
                      {canEdit && (
                        <button onClick={() => onRemoveSkillFromRoutine(levelId, routine.id, skill.id)} className="edit-mode-btn edit-mode-btn--delete" title="Remove from routine">
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                        </button>
                      )}
                    </div>
                  );
                })}
                {(() => {
                  const totalDD = routine.skills.reduce((sum, skill) => {
                    return sum + (skill.difficulty != null ? Number(skill.difficulty) : 0);
                  }, 0);
                  return totalDD > 0 ? (
                    <div className="routine-skill-item" style={{ borderTop: '1px solid #ddd', marginTop: '0.25rem', paddingTop: '0.25rem', fontWeight: 600 }}>
                      <span>Total DD</span>
                      <span style={{ marginLeft: 'auto', fontSize: '0.85rem' }}>{totalDD.toFixed(1)}</span>
                    </div>
                  ) : null;
                })()}
              </div>
            ) : (
              <p className="text-muted">No skills in this routine</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// Edit Level Modal Component
const EditLevelModal = ({ level, competitions, onSave, onCancel }) => {
  const [formData, setFormData] = useState({
    name: level.name || '',
    description: level.description || '',
    competitionIds: level.competitions ? level.competitions.map(comp => comp.id) : []
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(formData);
  };

  const handleCompetitionToggle = (competitionId) => {
    const updatedCompetitionIds = formData.competitionIds.includes(competitionId)
      ? formData.competitionIds.filter(id => id !== competitionId)
      : [...formData.competitionIds, competitionId];
    
    setFormData({ ...formData, competitionIds: updatedCompetitionIds });
  };

  // Group competitions by category
  const groupedCompetitions = competitions.reduce((acc, competition) => {
    if (!acc[competition.category]) {
      acc[competition.category] = [];
    }
    acc[competition.category].push(competition);
    return acc;
  }, {});

  // Sort categories
  const categoryOrder = ['CLUB', 'REGIONAL', 'LEAGUE', 'NATIONAL', 'INTERNATIONAL'];
  const sortedCategories = Object.keys(groupedCompetitions).sort((a, b) => {
    return categoryOrder.indexOf(a) - categoryOrder.indexOf(b);
  });

  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-header">
          <h3>Edit Level</h3>
          <button onClick={onCancel} className="close-button">×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Level Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>
          <div className="form-group">
            <label>Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows="3"
            />
          </div>
          <div className="form-group">
            <label>Competition Levels</label>
            <div className="competition-selection">
              {sortedCategories.length === 0 ? (
                <p className="no-competitions">No competitions available</p>
              ) : (
                sortedCategories.map(category => (
                  <div key={category} className="competition-category">
                    <h4 className="category-title">{category.toLowerCase().replace('_', ' ')}</h4>
                    <div className="competition-checkboxes">
                      {groupedCompetitions[category].map(competition => (
                        <label key={competition.id} className="competition-checkbox">
                          <input
                            type="checkbox"
                            checked={formData.competitionIds.includes(competition.id)}
                            onChange={() => handleCompetitionToggle(competition.id)}
                          />
                          <span className="checkbox-custom"></span>
                          <span className="competition-name">{competition.name}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
          <div className="modal-actions">
            <button type="button" onClick={onCancel} className="btn btn-secondary">
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Edit Skill Modal Component
// Unified Add/Edit Skill modal. Structured fields drive the FIG calculator;
// difficulty / FIG / suggested name auto-populate but stay editable for overrides.
const SkillFormModal = ({ mode, skill = null, onSave, onCancel }) => {
  const isEdit = mode === 'edit';
  const [name, setName] = useState(skill?.name ?? '');
  const [description, setDescription] = useState(skill?.description ?? '');
  const [order, setOrder] = useState(skill?.order ?? 1);

  // Structured params
  const [quarterSoms, setQuarterSoms] = useState(skill?.quarterSoms ?? 0);
  const [twistsArr, setTwistsArr] = useState(decodeHalfTwists(skill?.halfTwistsPerSom ?? ''));
  const [shape, setShape] = useState(skill?.shape ?? '');
  const [landing, setLanding] = useState(skill?.landing ?? 'feet');
  const [direction, setDirection] = useState(skill?.direction ?? 'backward');

  // Derived (editable)
  const [difficulty, setDifficulty] = useState(skill?.difficulty != null ? String(skill.difficulty) : '');
  const [figNotation, setFigNotation] = useState(skill?.figNotation ?? '');
  // Track whether user has manually edited difficulty/fig since last structured change
  const [diffOverridden, setDiffOverridden] = useState(isEdit && skill?.difficulty != null);
  const [figOverridden, setFigOverridden] = useState(isEdit && !!skill?.figNotation);

  // Keep twistsArr length in sync with quarterSoms.
  // 0 quarters with no twist intent → 0 entries; otherwise at least 1.
  const expectedTwistEntries = Math.max(quarterSoms > 0 || twistsArr.some(t => t > 0) ? 1 : 0, Math.ceil(quarterSoms / 4));
  useEffect(() => {
    setTwistsArr(prev => {
      const next = prev.slice(0, expectedTwistEntries);
      while (next.length < expectedTwistEntries) next.push(0);
      return next;
    });
  }, [expectedTwistEntries]);

  const calc = useMemo(() => computeFigDifficulty({
    quarterSoms,
    halfTwistsPerSom: twistsArr,
    shape: shape || null,
    landing,
    direction,
  }), [quarterSoms, twistsArr, shape, landing, direction]);

  // Auto-populate difficulty/fig from calculator unless overridden
  useEffect(() => {
    if (!diffOverridden) setDifficulty(String(calc.difficulty));
  }, [calc.difficulty, diffOverridden]);
  useEffect(() => {
    if (!figOverridden) setFigNotation(calc.figNotation);
  }, [calc.figNotation, figOverridden]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({
      name,
      description,
      order: parseInt(order) || 1,
      quarterSoms: Number(quarterSoms) || 0,
      halfTwistsPerSom: encodeHalfTwists(twistsArr),
      shape: shape || null,
      landing: landing || null,
      direction: direction || null,
      difficulty: difficulty === '' ? null : Number(difficulty),
      figNotation: figNotation || null,
    });
  };

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth: 600 }}>
        <div className="modal-header">
          <h3>{isEdit ? 'Edit Skill' : 'Add New Skill'}</h3>
          <button onClick={onCancel} className="close-button">×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Skill Name</label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                style={{ flex: 1 }}
              />
              <button
                type="button"
                className="btn btn-secondary"
                style={{ whiteSpace: 'nowrap' }}
                onClick={() => setName(calc.suggestedName)}
                title="Use the calculator's suggested name"
              >
                Use suggested
              </button>
            </div>
            {calc.suggestedName && calc.suggestedName !== name && (
              <small className="text-muted">Suggested: {calc.suggestedName}</small>
            )}
          </div>

          <div className="form-group">
            <label>Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows="2"
            />
          </div>

          <fieldset style={{ border: '1px solid #ddd', borderRadius: 6, padding: '0.75rem 1rem', marginBottom: '1rem' }}>
            <legend style={{ padding: '0 0.5rem', fontSize: '0.85rem', fontWeight: 700 }}>Structured parameters (FIG §17.1)</legend>

            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              <div className="form-group" style={{ flex: '1 1 120px' }}>
                <label>¼ somersaults</label>
                <input
                  type="number"
                  value={quarterSoms}
                  min="0" max="16"
                  onChange={(e) => { setQuarterSoms(parseInt(e.target.value) || 0); setDiffOverridden(false); setFigOverridden(false); }}
                />
              </div>
              <div className="form-group" style={{ flex: '1 1 140px' }}>
                <label>Direction</label>
                <select value={direction} onChange={e => { setDirection(e.target.value); setDiffOverridden(false); setFigOverridden(false); }}>
                  <option value="backward">Backward</option>
                  <option value="forward">Forward</option>
                </select>
              </div>
              <div className="form-group" style={{ flex: '1 1 140px' }}>
                <label>Shape</label>
                <select value={shape} onChange={e => { setShape(e.target.value); setDiffOverridden(false); setFigOverridden(false); }}>
                  <option value="">— none —</option>
                  <option value="tuck">Tuck</option>
                  <option value="pike">Pike</option>
                  <option value="straight">Straight</option>
                  <option value="straddle">Straddle</option>
                </select>
              </div>
              <div className="form-group" style={{ flex: '1 1 140px' }}>
                <label>Landing</label>
                <select value={landing} onChange={e => { setLanding(e.target.value); setDiffOverridden(false); setFigOverridden(false); }}>
                  <option value="feet">Feet</option>
                  <option value="seat">Seat</option>
                  <option value="front">Front</option>
                  <option value="back">Back</option>
                  <option value="hands">Hands</option>
                </select>
              </div>
            </div>

            {expectedTwistEntries > 0 && (
              <div className="form-group" style={{ marginTop: '0.5rem' }}>
                <label>½ twists per somersault</label>
                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                  {twistsArr.map((t, i) => (
                    <input
                      key={i}
                      type="number"
                      min="0"
                      max="9"
                      value={t}
                      onChange={(e) => {
                        const v = Math.max(0, Math.min(9, parseInt(e.target.value) || 0));
                        setTwistsArr(arr => arr.map((x, j) => j === i ? v : x));
                        setDiffOverridden(false);
                        setFigOverridden(false);
                      }}
                      style={{ width: 56, textAlign: 'center' }}
                    />
                  ))}
                </div>
              </div>
            )}

            <div style={{ background: '#f6f6f8', padding: '0.5rem 0.75rem', borderRadius: 4, marginTop: '0.5rem', fontSize: '0.85rem' }}>
              {calc.breakdown.map((b, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>{b.label}</span>
                  <span>{b.points >= 0 ? '+' : ''}{b.points.toFixed(1)}</span>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #ddd', paddingTop: 4, marginTop: 4, fontWeight: 700 }}>
                <span>Computed difficulty</span>
                <span>{calc.difficulty.toFixed(1)}</span>
              </div>
            </div>
          </fieldset>

          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <div className="form-group" style={{ flex: '1 1 120px' }}>
              <label>Difficulty {diffOverridden && <small style={{ color: '#c0392b' }}>(override)</small>}</label>
              <input
                type="number"
                step="0.1"
                value={difficulty}
                onChange={e => { setDifficulty(e.target.value); setDiffOverridden(true); }}
              />
              {diffOverridden && (
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => { setDifficulty(String(calc.difficulty)); setDiffOverridden(false); }} style={{ marginTop: 4, fontSize: '0.75rem' }}>Reset to calculated</button>
              )}
            </div>
            <div className="form-group" style={{ flex: '1 1 160px' }}>
              <label>FIG notation {figOverridden && <small style={{ color: '#c0392b' }}>(override)</small>}</label>
              <input
                type="text"
                value={figNotation}
                onChange={e => { setFigNotation(e.target.value); setFigOverridden(true); }}
              />
              {figOverridden && (
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => { setFigNotation(calc.figNotation); setFigOverridden(false); }} style={{ marginTop: 4, fontSize: '0.75rem' }}>Reset to calculated</button>
              )}
            </div>
            <div className="form-group" style={{ flex: '0 1 100px' }}>
              <label>Order</label>
              <input
                type="number"
                value={order}
                onChange={(e) => setOrder(e.target.value)}
                min="1"
              />
            </div>
          </div>

          <div className="modal-actions">
            <button type="button" onClick={onCancel} className="btn btn-secondary">Cancel</button>
            <button type="submit" className="btn btn-primary">{isEdit ? 'Save Changes' : 'Add Skill'}</button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Edit Routine Modal Component
const EditRoutineModal = ({ routine, onSave, onCancel }) => {
  const [formData, setFormData] = useState({
    name: routine.name || '',
    description: routine.description || '',
    isAlternative: routine.isAlternative || false,
    order: routine.order || 1
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-header">
          <h3>Edit Routine</h3>
          <button onClick={onCancel} className="close-button">×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Routine Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label>Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows="3"
            />
          </div>
          <div className="form-group">
            <label>Order</label>
            <input
              type="number"
              value={formData.order}
              onChange={(e) => setFormData({ ...formData, order: parseInt(e.target.value) })}
              min="1"
            />
          </div>
          <div className="form-group">
            <label>
              <input
                type="checkbox"
                checked={formData.isAlternative}
                onChange={(e) => setFormData({ ...formData, isAlternative: e.target.checked })}
              />
              Alternative Routine
            </label>
          </div>
          <div className="modal-actions">
            <button type="button" onClick={onCancel} className="btn btn-secondary">
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Add Skill Modal Component
// Add Routine Modal Component
const AddRoutineModal = ({ levelId, onSave, onCancel }) => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    isAlternative: false,
    order: 1
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-header">
          <h3>Add New Routine</h3>
          <button onClick={onCancel} className="close-button">×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Routine Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label>Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows="3"
            />
          </div>
          <div className="form-group">
            <label>Order (leave blank to add to end)</label>
            <input
              type="number"
              value={formData.order}
              onChange={(e) => setFormData({ ...formData, order: parseInt(e.target.value) || 1 })}
              min="1"
            />
          </div>
          <div className="form-group">
            <label>
              <input
                type="checkbox"
                checked={formData.isAlternative}
                onChange={(e) => setFormData({ ...formData, isAlternative: e.target.checked })}
              />
              Alternative Routine
            </label>
          </div>
          <div className="modal-actions">
            <button type="button" onClick={onCancel} className="btn btn-secondary">
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              Add Routine
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Add Skill to Routine Modal Component
// Search-driven add-skill flow. Type a name or FIG notation; click a tracked skill
// to attach it, or hit "Add as implicit" to use the typed text as a free-text skill.
const AddSkillToRoutineModal = ({ levelId, routineId, availableSkills, onSave, onCancel }) => {
  const [query, setQuery] = useState('');

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return availableSkills.slice(0, 30);
    return availableSkills.filter(s => {
      const name = (s.name || '').toLowerCase();
      const fig = (s.figNotation || '').toLowerCase();
      return name.includes(q) || fig.includes(q);
    }).slice(0, 30);
  }, [query, availableSkills]);

  const handleAddImplicit = () => {
    const text = query.trim();
    if (!text) return;
    onSave(null, text);
  };

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth: 520 }}>
        <div className="modal-header">
          <h3>Add Skill to Routine</h3>
          <button onClick={onCancel} className="close-button">×</button>
        </div>
        <div style={{ padding: '0.5rem 0' }}>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name or FIG notation, or type a new implicit skill…"
            autoFocus
            style={{ width: '100%', padding: '0.6rem', border: '1px solid #ccc', borderRadius: 4, fontSize: '1rem' }}
          />

          <div style={{ maxHeight: 320, overflowY: 'auto', marginTop: '0.5rem', border: '1px solid #eee', borderRadius: 4 }}>
            {matches.length === 0 ? (
              <p style={{ margin: 0, padding: '1rem', color: '#888', textAlign: 'center' }}>No matches</p>
            ) : matches.map(skill => (
              <button
                key={skill.id}
                type="button"
                onClick={() => onSave(skill.id)}
                style={{
                  display: 'flex',
                  width: '100%',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '0.5rem 0.75rem',
                  border: 'none',
                  borderBottom: '1px solid #f3f3f3',
                  background: 'transparent',
                  textAlign: 'left',
                  cursor: 'pointer',
                  fontSize: '0.9rem',
                }}
                onMouseEnter={e => e.currentTarget.style.background = '#f6f6f8'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <span>
                  <strong>{skill.name}</strong>
                  <span style={{ marginLeft: 8, color: '#888' }}>L{skill.level.identifier}</span>
                </span>
                <span style={{ fontFamily: 'monospace', fontSize: '0.85rem', color: '#555' }}>
                  {skill.figNotation || '—'} · {skill.difficulty != null ? Number(skill.difficulty).toFixed(1) : '—'}
                </span>
              </button>
            ))}
          </div>

          <div className="modal-actions" style={{ marginTop: '1rem' }}>
            <button type="button" onClick={onCancel} className="btn btn-secondary">Cancel</button>
            <button
              type="button"
              onClick={handleAddImplicit}
              disabled={!query.trim()}
              className="btn btn-primary"
              title="Add the typed text as a free-text 'implicit' skill"
            >
              Add as implicit
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Add Level Modal Component
const AddLevelModal = ({ competitions, onSave, onCancel }) => {
  const [formData, setFormData] = useState({
    identifier: '',
    name: '',
    description: '',
    type: 'SEQUENTIAL',
    competitionIds: []
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(formData);
  };

  const handleCompetitionToggle = (competitionId) => {
    const updatedCompetitionIds = formData.competitionIds.includes(competitionId)
      ? formData.competitionIds.filter(id => id !== competitionId)
      : [...formData.competitionIds, competitionId];
    
    setFormData({ ...formData, competitionIds: updatedCompetitionIds });
  };

  // Group competitions by category
  const groupedCompetitions = competitions.reduce((acc, competition) => {
    if (!acc[competition.category]) {
      acc[competition.category] = [];
    }
    acc[competition.category].push(competition);
    return acc;
  }, {});

  // Sort categories
  const categoryOrder = ['CLUB', 'REGIONAL', 'LEAGUE', 'NATIONAL', 'INTERNATIONAL'];
  const sortedCategories = Object.keys(groupedCompetitions).sort((a, b) => {
    return categoryOrder.indexOf(a) - categoryOrder.indexOf(b);
  });

  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-header">
          <h3>Add New Level</h3>
          <button onClick={onCancel} className="close-button">×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Level Identifier (e.g., "11", "3a", "POWER")</label>
            <input
              type="text"
              value={formData.identifier}
              onChange={(e) => setFormData({ ...formData, identifier: e.target.value })}
              required
              placeholder="e.g., 11 or 3a or POWER"
            />
            <small>
              Use numbers for sequential levels (11, 12, etc.) or letters for side paths (3a, 3b, etc.)
            </small>
          </div>
          <div className="form-group">
            <label>Level Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              placeholder="e.g., Advanced Landings"
            />
          </div>
          <div className="form-group">
            <label>Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows="3"
              placeholder="Describe what this level covers..."
            />
          </div>
          <div className="form-group">
            <label>Level Type</label>
            <select
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value })}
              required
            >
              <option value="SEQUENTIAL">Sequential Level (must be completed in order)</option>
              <option value="SIDE_PATH">Side Path (can be completed alongside main levels)</option>
            </select>
          </div>
          <div className="form-group">
            <label>Competition Levels</label>
            <div className="competition-selection">
              {sortedCategories.length === 0 ? (
                <p className="no-competitions">No competitions available</p>
              ) : (
                sortedCategories.map(category => (
                  <div key={category} className="competition-category">
                    <h4 className="category-title">{category.toLowerCase().replace('_', ' ')}</h4>
                    <div className="competition-checkboxes">
                      {groupedCompetitions[category].map(competition => (
                        <label key={competition.id} className="competition-checkbox">
                          <input
                            type="checkbox"
                            checked={formData.competitionIds.includes(competition.id)}
                            onChange={() => handleCompetitionToggle(competition.id)}
                          />
                          <span className="checkbox-custom"></span>
                          <span className="competition-name">{competition.name}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
          <div className="modal-actions">
            <button type="button" onClick={onCancel} className="btn btn-secondary">
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              Create Level
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Levels; 