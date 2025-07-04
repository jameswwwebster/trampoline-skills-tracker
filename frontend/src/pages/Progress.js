import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';

const Progress = () => {
  const { gymnastId } = useParams();
  const [progress, setProgress] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchProgress = async () => {
      try {
        const response = await axios.get(`/api/progress/gymnast/${gymnastId}`);
        setProgress(response.data);
      } catch (error) {
        console.error('Failed to fetch progress:', error);
        setError('Failed to load progress data');
      } finally {
        setLoading(false);
      }
    };

    fetchProgress();
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

  const getStatusBadge = (status) => {
    const badges = {
      'NOT_STARTED': 'badge-secondary',
      'IN_PROGRESS': 'badge-warning',
      'COMPLETED': 'badge-success'
    };
    return badges[status] || 'badge-secondary';
  };

  const groupSkillsByLevel = (skillProgress) => {
    const grouped = {};
    skillProgress.forEach(progress => {
      const levelNumber = progress.skill.level.number;
      if (!grouped[levelNumber]) {
        grouped[levelNumber] = [];
      }
      grouped[levelNumber].push(progress);
    });
    return grouped;
  };

  const groupedSkills = progress ? groupSkillsByLevel(progress.skillProgress) : {};

  return (
    <div>
      <h1>Gymnast Progress</h1>
      
      {!progress ? (
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">No Progress Data</h3>
          </div>
          <div>
            <p>No progress data found for this gymnast.</p>
          </div>
        </div>
      ) : (
        <div>
          {/* Level Progress */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Level Progress</h3>
            </div>
            <div>
              {progress.levelProgress.length === 0 ? (
                <p>No level progress recorded yet.</p>
              ) : (
                <div className="grid">
                  {progress.levelProgress.map(levelProg => (
                    <div key={levelProg.id} className="card">
                      <div className="card-header">
                                                 <h4 className="card-title">
                           Level {levelProg.level.identifier || levelProg.level.number}: {levelProg.level.name}
                           <span className={`badge ${getStatusBadge(levelProg.status)}`}>
                             {levelProg.status.replace('_', ' ')}
                           </span>
                         </h4>
                      </div>
                      <div>
                        {levelProg.routine && (
                          <p><strong>Routine:</strong> {levelProg.routine.name}</p>
                        )}
                        {levelProg.completedAt && (
                          <p><strong>Completed:</strong> {new Date(levelProg.completedAt).toLocaleDateString()}</p>
                        )}
                        {levelProg.notes && (
                          <p><strong>Notes:</strong> {levelProg.notes}</p>
                        )}
                        <p><strong>Assessed by:</strong> {levelProg.user.firstName} {levelProg.user.lastName}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Skill Progress */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Skill Progress</h3>
            </div>
            <div>
              {progress.skillProgress.length === 0 ? (
                <p>No skill progress recorded yet.</p>
              ) : (
                <div>
                  {Object.keys(groupedSkills).sort((a, b) => parseInt(a) - parseInt(b)).map(levelNumber => (
                                         <div key={levelNumber} className="card">
                       <div className="card-header">
                         <h4 className="card-title">Level {groupedSkills[levelNumber][0]?.skill?.level?.identifier || levelNumber} Skills</h4>
                       </div>
                      <table className="table">
                        <thead>
                          <tr>
                            <th>Skill</th>
                            <th>Status</th>
                            <th>Completed</th>
                            <th>Assessed By</th>
                            <th>Notes</th>
                          </tr>
                        </thead>
                        <tbody>
                          {groupedSkills[levelNumber].map(skillProg => (
                            <tr key={skillProg.id}>
                              <td>
                                <strong>{skillProg.skill.name}</strong>
                                {skillProg.skill.description && (
                                  <div className="text-muted">{skillProg.skill.description}</div>
                                )}
                              </td>
                              <td>
                                <span className={`badge ${getStatusBadge(skillProg.status)}`}>
                                  {skillProg.status.replace('_', ' ')}
                                </span>
                              </td>
                              <td>
                                {skillProg.completedAt 
                                  ? new Date(skillProg.completedAt).toLocaleDateString()
                                  : '-'
                                }
                              </td>
                              <td>
                                {skillProg.user.firstName} {skillProg.user.lastName}
                              </td>
                              <td>
                                {skillProg.notes || '-'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Progress; 