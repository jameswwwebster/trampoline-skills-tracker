import React, { useState, useEffect } from 'react';
import axios from 'axios';

const Levels = () => {
  const [levels, setLevels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchLevels = async () => {
      try {
        const response = await axios.get('/api/levels');
        setLevels(response.data);
      } catch (error) {
        console.error('Failed to fetch levels:', error);
        setError('Failed to load levels');
      } finally {
        setLoading(false);
      }
    };

    fetchLevels();
  }, []);

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

  const sequentialLevels = levels.filter(level => level.type === 'SEQUENTIAL');
  const sidePaths = levels.filter(level => level.type === 'SIDE_PATH');

  return (
    <div>
      <h1>Trampoline Levels</h1>
      
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
              <div className="grid">
                {sequentialLevels.map(level => (
                  <div key={level.id} className="card">
                    <div className="card-header">
                      <h4 className="card-title">Level {level.identifier || level.number}: {level.name}</h4>
                    </div>
                    <div>
                      {level.description && (
                        <p className="text-muted">{level.description}</p>
                      )}
                      
                      <div>
                        <strong>Skills ({level.skills.length}):</strong>
                        {level.skills.length > 0 ? (
                          <ul>
                            {level.skills.map(skill => (
                              <li key={skill.id}>
                                {skill.name}
                                {skill.description && (
                                  <span className="text-muted"> - {skill.description}</span>
                                )}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-muted">No skills defined</p>
                        )}
                      </div>

                      {level.routines.length > 0 && (
                        <div>
                          <strong>Routines ({level.routines.length}):</strong>
                          <ul>
                            {level.routines.map(routine => (
                              <li key={routine.id}>
                                {routine.name}
                                {routine.isAlternative && (
                                  <span className="text-muted"> (Alternative Option)</span>
                                )}
                                {routine.description && (
                                  <div className="text-muted">{routine.description}</div>
                                )}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
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
                <div className="grid">
                  {sidePaths.map(level => (
                    <div key={level.id} className="card">
                      <div className="card-header">
                        <h4 className="card-title">{level.identifier || level.number}: {level.name}</h4>
                      </div>
                      <div>
                        {level.description && (
                          <p className="text-muted">{level.description}</p>
                        )}
                        
                        <div>
                          <strong>Skills ({level.skills.length}):</strong>
                          {level.skills.length > 0 ? (
                            <ul>
                              {level.skills.map(skill => (
                                <li key={skill.id}>
                                  {skill.name}
                                  {skill.description && (
                                    <span className="text-muted"> - {skill.description}</span>
                                  )}
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="text-muted">No skills defined</p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Levels; 