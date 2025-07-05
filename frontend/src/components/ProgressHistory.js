import React, { useState, useEffect } from 'react';
import axios from 'axios';

const ProgressHistory = ({ gymnastId }) => {
  const [historyData, setHistoryData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [viewMode, setViewMode] = useState('timeline'); // 'timeline' or 'detailed'

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const response = await axios.get(`/api/progress/gymnast/${gymnastId}/history`);
        setHistoryData(response.data);
      } catch (error) {
        console.error('Failed to fetch progress history:', error);
        setError('Failed to load progress history');
      } finally {
        setLoading(false);
      }
    };

    if (gymnastId) {
      fetchHistory();
    }
  }, [gymnastId]);

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatTime = (dateString) => {
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatMonth = (monthString) => {
    const [year, month] = monthString.split('-');
    return new Date(year, month - 1).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long'
    });
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

  if (!historyData || historyData.history.length === 0) {
    return (
      <div className="progress-history">
        <div className="card">
          <div className="card-header">
            <h4 className="card-title">Progress History</h4>
          </div>
          <div className="no-history">
            <p>No progress history available yet.</p>
            <p>Skills and levels will appear here once they are marked as completed by a coach.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="progress-history">
      <div className="card">
        <div className="card-header">
          <h4 className="card-title">Progress History</h4>
          <div className="view-controls">
            <button
              onClick={() => setViewMode('timeline')}
              className={`btn btn-sm ${viewMode === 'timeline' ? 'btn-primary' : 'btn-outline'}`}
            >
              Timeline View
            </button>
            <button
              onClick={() => setViewMode('detailed')}
              className={`btn btn-sm ${viewMode === 'detailed' ? 'btn-primary' : 'btn-outline'}`}
            >
              Detailed List
            </button>
          </div>
        </div>

        {/* Summary Statistics */}
        <div className="history-summary">
          <div className="summary-stats">
            <div className="stat-item">
              <div className="stat-number">{historyData.summary.totalSkillsCompleted}</div>
              <div className="stat-label">Skills Completed</div>
            </div>
            <div className="stat-item">
              <div className="stat-number">{historyData.summary.totalLevelsCompleted}</div>
              <div className="stat-label">Levels Completed</div>
            </div>
            <div className="stat-item">
              <div className="stat-number">{historyData.summary.totalDaysActive}</div>
              <div className="stat-label">Days Active</div>
            </div>
          </div>
          
          {historyData.summary.firstCompletion && (
            <div className="journey-info">
              <p>
                <strong>Journey Started:</strong> {formatDate(historyData.summary.firstCompletion)}
              </p>
              {historyData.summary.latestCompletion && historyData.summary.firstCompletion !== historyData.summary.latestCompletion && (
                <p>
                  <strong>Latest Achievement:</strong> {formatDate(historyData.summary.latestCompletion)}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Timeline View */}
        {viewMode === 'timeline' && (
          <div className="timeline-view">
            <h5>Monthly Progress Timeline</h5>
            <div className="timeline">
              {historyData.timeline.map((monthData, index) => (
                <div key={monthData.month} className="timeline-month">
                  <div className="timeline-marker">
                    <div className="timeline-date">
                      {formatMonth(monthData.month)}
                    </div>
                    <div className="timeline-stats">
                      {monthData.skills.length > 0 && (
                        <span className="month-stat skills">
                          {monthData.skills.length} skill{monthData.skills.length !== 1 ? 's' : ''}
                        </span>
                      )}
                      {monthData.levels.length > 0 && (
                        <span className="month-stat levels">
                          {monthData.levels.length} level{monthData.levels.length !== 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <div className="timeline-content">
                    {/* Levels completed this month */}
                    {monthData.levels.map(level => (
                      <div key={level.id} className="timeline-item level-item">
                        <div className="item-icon level-icon">🏆</div>
                        <div className="item-content">
                          <div className="item-title">
                            <strong>Level {level.levelInfo.number} Completed</strong>
                          </div>
                          <div className="item-description">
                            {level.levelInfo.name}
                            {level.routineInfo && (
                              <span className="routine-info">
                                {' '}• {level.routineInfo.name || `Routine ${level.routineInfo.order}`}
                                {level.routineInfo.isAlternative && ' (Alternative)'}
                              </span>
                            )}
                          </div>
                          <div className="item-meta">
                            <span className="completion-date">{formatDate(level.completedAt)}</span>
                            <span className="coach-info">
                              by {level.user.firstName} {level.user.lastName}
                            </span>
                          </div>
                          {level.notes && (
                            <div className="item-notes">
                              <em>"{level.notes}"</em>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}

                    {/* Skills completed this month */}
                    {monthData.skills.map(skill => (
                      <div key={skill.id} className="timeline-item skill-item">
                        <div className="item-icon skill-icon">✅</div>
                        <div className="item-content">
                          <div className="item-title">
                            <strong>{skill.itemName}</strong>
                          </div>
                          <div className="item-description">
                            Level {skill.levelInfo.number}: {skill.levelInfo.name}
                          </div>
                          <div className="item-meta">
                            <span className="completion-date">{formatDate(skill.completedAt)}</span>
                            <span className="coach-info">
                              by {skill.user.firstName} {skill.user.lastName}
                            </span>
                          </div>
                          {skill.notes && (
                            <div className="item-notes">
                              <em>"{skill.notes}"</em>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Detailed List View */}
        {viewMode === 'detailed' && (
          <div className="detailed-view">
            <h5>Detailed Progress History</h5>
            <div className="history-list">
              {historyData.history.map((item, index) => (
                <div key={`${item.type}-${item.id}`} className={`history-item ${item.type}-history-item`}>
                  <div className="history-item-header">
                    <div className="item-type-icon">
                      {item.type === 'level' ? '🏆' : '✅'}
                    </div>
                    <div className="item-info">
                      <h6 className="item-title">
                        {item.type === 'level' && `Level ${item.levelInfo.number}: `}
                        {item.itemName}
                      </h6>
                      <div className="item-subtitle">
                        {item.type === 'skill' && `Level ${item.levelInfo.number}: ${item.levelInfo.name}`}
                        {item.type === 'level' && item.routineInfo && (
                          <>
                            Routine: {item.routineInfo.name || `Routine ${item.routineInfo.order}`}
                            {item.routineInfo.isAlternative && ' (Alternative)'}
                          </>
                        )}
                      </div>
                    </div>
                    <div className="item-completion">
                      <div className="completion-date">
                        {formatDate(item.completedAt)}
                      </div>
                      <div className="completion-time">
                        {formatTime(item.completedAt)}
                      </div>
                    </div>
                  </div>
                  
                  <div className="history-item-details">
                    <div className="coach-info">
                      <strong>Marked by:</strong> {item.user.firstName} {item.user.lastName}
                    </div>
                    {item.notes && (
                      <div className="notes">
                        <strong>Notes:</strong> {item.notes}
                      </div>
                    )}
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

export default ProgressHistory; 