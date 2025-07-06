import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';

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
      
      // Expand all levels by default
      const levelIds = response.data.map(level => level.id);
      setExpandedLevels(new Set(levelIds));
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

  const handleAddSkillToRoutine = async (levelId, routineId, skillId) => {
    try {
      const response = await axios.post(`/api/levels/${levelId}/routines/${routineId}/skills`, {
        skillId
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
              {editMode ? '🔒 Exit Edit Mode' : '✏️ Edit Mode'}
            </button>
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
        <EditSkillModal
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
        <AddSkillModal
          levelId={showAddSkillForm}
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
          onSave={(skillId) => handleAddSkillToRoutine(showAddSkillToRoutineForm.levelId, showAddSkillToRoutineForm.routineId, skillId)}
          onCancel={() => setShowAddSkillToRoutineForm(null)}
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
            <button 
              onClick={onEditLevel}
              className="btn btn-sm btn-outline"
            >
              Edit Level
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
              {canEdit && (
                <button 
                  onClick={onAddSkill}
                  className="btn btn-sm btn-primary"
                >
                  + Add Skill
                </button>
              )}
            </div>
            
            {level.skills.length > 0 ? (
              <div className="skills-grid">
                {level.skills.map(skill => (
                  <div key={skill.id} className="skill-item">
                    <div className="skill-content">
                      <div className="skill-name">{skill.name}</div>
                      {skill.description && (
                        <div className="skill-description">{skill.description}</div>
                      )}
                    </div>
                    {canEdit && (
                      <div className="skill-actions">
                        <button 
                          onClick={() => onEditSkill(skill)}
                          className="btn btn-xs btn-outline"
                        >
                          Edit
                        </button>
                        <button 
                          onClick={() => onDeleteSkill(level.id, skill.id)}
                          className="btn btn-xs btn-danger"
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted">No skills defined</p>
            )}
          </div>

          {/* Routines Section */}
          <div className="routines-section">
            <div className="section-header">
              <h5>Routines ({level.routines.length})</h5>
              {canEdit && (
                <button 
                  onClick={onAddRoutine}
                  className="btn btn-sm btn-primary"
                >
                  + Add Routine
                </button>
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
            <div className="routine-actions">
              <button 
                onClick={onEditRoutine}
                className="btn btn-xs btn-outline"
              >
                Edit
              </button>
              <button 
                onClick={onDeleteRoutine}
                className="btn btn-xs btn-danger"
              >
                Delete
              </button>
            </div>
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
                <button 
                  onClick={onAddSkillToRoutine}
                  className="btn btn-xs btn-primary"
                >
                  + Add Skill
                </button>
              )}
            </div>
            
            {routine.skills.length > 0 ? (
              <div className="routine-skills-list">
                {routine.skills.map(skill => (
                  <div key={skill.id} className="routine-skill-item">
                    <span className="skill-name">{skill.name}</span>
                    {canEdit && (
                      <button 
                        onClick={() => onRemoveSkillFromRoutine(levelId, routine.id, skill.id)}
                        className="btn btn-xs btn-danger"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                ))}
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
const EditSkillModal = ({ skill, onSave, onCancel }) => {
  const [formData, setFormData] = useState({
    name: skill.name || '',
    description: skill.description || '',
    order: skill.order || 1
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-header">
          <h3>Edit Skill</h3>
          <button onClick={onCancel} className="close-button">×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Skill Name</label>
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
            <label>Order</label>
            <input
              type="number"
              value={formData.order}
              onChange={(e) => setFormData({ ...formData, order: parseInt(e.target.value) })}
              min="1"
            />
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
const AddSkillModal = ({ levelId, onSave, onCancel }) => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
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
          <h3>Add New Skill</h3>
          <button onClick={onCancel} className="close-button">×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Skill Name</label>
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
            <label>Order (leave blank to add to end)</label>
            <input
              type="number"
              value={formData.order}
              onChange={(e) => setFormData({ ...formData, order: parseInt(e.target.value) || 1 })}
              min="1"
            />
          </div>
          <div className="modal-actions">
            <button type="button" onClick={onCancel} className="btn btn-secondary">
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              Add Skill
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

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
const AddSkillToRoutineModal = ({ levelId, routineId, availableSkills, onSave, onCancel }) => {
  const [selectedSkillId, setSelectedSkillId] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (selectedSkillId) {
      onSave(selectedSkillId);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-header">
          <h3>Add Skill to Routine</h3>
          <button onClick={onCancel} className="close-button">×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Select Skill</label>
            <select
              value={selectedSkillId}
              onChange={(e) => setSelectedSkillId(e.target.value)}
              required
            >
              <option value="">Choose a skill...</option>
              {availableSkills.map(skill => (
                <option key={skill.id} value={skill.id}>
                  {skill.name} (Level {skill.level.identifier})
                </option>
              ))}
            </select>
          </div>
          <div className="modal-actions">
            <button type="button" onClick={onCancel} className="btn btn-secondary">
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              Add Skill
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Levels; 