import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import CreateClubForm from '../components/CreateClubForm';

const Dashboard = () => {
  const { user, isClubAdmin, isParent, isChild, isCoach, generateShareCode, generateCodeOfTheDay, getCodeOfTheDay, clearCodeOfTheDay, updateUser } = useAuth();
  const [shareCodeModal, setShareCodeModal] = useState(false);
  const [codeOfDayModal, setCodeOfDayModal] = useState(false);
  const [generatedCode, setGeneratedCode] = useState(null);
  const [codeOfDayInfo, setCodeOfDayInfo] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [loadingMetrics, setLoadingMetrics] = useState(false);
  const [unprintedCertificates, setUnprintedCertificates] = useState([]);
  const [loadingUnprinted, setLoadingUnprinted] = useState(false);
  const [success, setSuccess] = useState(null);
  const [error, setError] = useState(null);

  // Fetch metrics for coaches and admins
  useEffect(() => {
    if ((isCoach || isClubAdmin) && user?.club) {
      fetchMetrics();
      fetchUnprintedCertificates();
    }
  }, [isCoach, isClubAdmin, user?.club]);

  const fetchMetrics = async () => {
    try {
      setLoadingMetrics(true);
      const response = await axios.get('/api/dashboard/metrics');
      setMetrics(response.data);
    } catch (error) {
      console.error('Failed to fetch metrics:', error);
    } finally {
      setLoadingMetrics(false);
    }
  };

    const fetchUnprintedCertificates = async () => {
    try {
      setLoadingUnprinted(true);
      const response = await axios.get('/api/dashboard/unprinted-certificates');
      setUnprintedCertificates(response.data);
    } catch (error) {
      console.error('Failed to fetch unprinted certificates:', error);
    } finally {
      setLoadingUnprinted(false);
    }
  };

  const handlePrintCertificate = async (certificateId) => {
    try {
      setError(null);
      setSuccess(null);
      
      await axios.put(`/api/certificates/${certificateId}/status`, {
        status: 'PRINTED'
      });
      
      // Refresh the unprinted certificates list
      await fetchUnprintedCertificates();
      
      // Show success message
      const certificate = unprintedCertificates.find(c => c.id === certificateId);
      setSuccess(`🖨️ Certificate marked as printed for ${certificate?.gymnast?.firstName} ${certificate?.gymnast?.lastName} (Level ${certificate?.level?.identifier})!`);
      
      // Clear success message after 5 seconds
      setTimeout(() => setSuccess(null), 5000);
      
    } catch (err) {
      console.error('Failed to mark certificate as printed:', err);
      setError(err.response?.data?.error || 'Failed to mark certificate as printed. Please try again.');
      
      // Clear error message after 5 seconds
      setTimeout(() => setError(null), 5000);
    }
  };

  const handleClubCreated = (club, updatedUser) => {
    // Update the user context with the new club information
    updateUser(updatedUser);
  };

  const handleGenerateShareCode = async () => {
    const result = await generateShareCode();
    if (result.success) {
      setGeneratedCode(result.shareCode);
      setShareCodeModal(true);
    }
  };

  const handleGenerateCodeOfDay = async () => {
    const result = await generateCodeOfTheDay(8); // 8 hours expiration
    if (result.success) {
      setCodeOfDayInfo(result);
      setCodeOfDayModal(true);
    }
  };

  const handleGetCodeOfDay = async () => {
    const result = await getCodeOfTheDay();
    if (result.success) {
      setCodeOfDayInfo(result);
      setCodeOfDayModal(true);
    }
  };

  // Show club creation form for club admins without a club
  if (isClubAdmin && !user?.club) {
    return (
      <div>
        <h1>Welcome, {user?.firstName}!</h1>
        <CreateClubForm onClubCreated={handleClubCreated} />
      </div>
    );
  }

  return (
    <div>
      <h1>Welcome, {user?.firstName}!</h1>
      
      <div className="grid">
        {/* Metrics for Coaches and Admins */}
        {(isCoach || isClubAdmin) && (
          <>
            {loadingMetrics ? (
              <div className="loading" style={{ padding: '1rem' }}>
                <div className="spinner"></div>
                <p>Loading metrics...</p>
              </div>
            ) : metrics ? (
              <>
                {/* Level Distribution */}
                <div className="card">
                  <div className="card-header">
                    <h3 className="card-title">🎯 Gymnast Level Distribution</h3>
                    <p className="text-muted" style={{ marginTop: '0.5rem', fontSize: '0.875rem' }}>
                      Current working levels - Click on a level to view gymnasts working at that level
                    </p>
                  </div>
                  <div>
                    {Object.entries(metrics.levelDistribution)
                      .filter(([_, data]) => data.count > 0)
                      .map(([identifier, data]) => (
                        <Link 
                          key={identifier} 
                          to={`/gymnasts?level=${encodeURIComponent(identifier)}`}
                          className="dashboard-metric-link"
                          style={{ 
                            display: 'flex', 
                            justifyContent: 'space-between', 
                            alignItems: 'center', 
                            padding: '0.75rem 0.5rem', 
                            borderBottom: '1px solid #eee'
                          }}
                        >
                          <span><strong>Level {identifier}</strong> - {data.levelName}</span>
                          <span className="badge badge-info">{data.count} gymnast{data.count !== 1 ? 's' : ''}</span>
                        </Link>
                      ))}
                    {Object.values(metrics.levelDistribution).every(data => data.count === 0) && (
                      <p className="text-muted">No gymnast progress data available yet.</p>
                    )}
                  </div>
                </div>

                {/* Competition Readiness */}
                <div className="card">
                  <div className="card-header">
                    <h3 className="card-title">🏆 Competition Readiness</h3>
                    <p className="text-muted" style={{ marginTop: '0.5rem', fontSize: '0.875rem' }}>
                      Gymnasts currently working on levels associated with competitions - Click to view
                    </p>
                  </div>
                  <div>
                    {Object.entries(metrics.competitionReadiness).length > 0 ? (
                      Object.entries(metrics.competitionReadiness).map(([competitionName, data]) => (
                        <Link 
                          key={competitionName} 
                          to={`/gymnasts?competition=${encodeURIComponent(competitionName)}`}
                          className="dashboard-metric-link"
                          style={{ 
                            display: 'flex', 
                            justifyContent: 'space-between', 
                            alignItems: 'center', 
                            padding: '0.75rem 0.5rem', 
                            borderBottom: '1px solid #eee'
                          }}
                        >
                          <div><span><strong>{competitionName}</strong></span></div>
                          <span className="badge badge-success">{data.ready} ready</span>
                        </Link>
                      ))
                    ) : (
                      <p className="text-muted">No competition data available.</p>
                    )}
                  </div>
                </div>

                {/* Recent Activity */}
                <div className="card">
                  <div className="card-header">
                    <h3 className="card-title">⚡ Recent Activity (30 days)</h3>
                  </div>
                  <div>
                    {metrics.recentActivity.skills.length > 0 || metrics.recentActivity.levels.length > 0 ? (
                      <div>
                        {metrics.recentActivity.levels.slice(0, 5).map((activity, index) => (
                          <div key={`level-${index}`} style={{ padding: '0.5rem 0', borderBottom: '1px solid #eee' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span>
                                <strong>{activity.gymnast.firstName} {activity.gymnast.lastName}</strong> completed{' '}
                                <span className="badge badge-primary">Level {activity.level.identifier}</span>
                              </span>
                              <span className="text-muted small">
                                {new Date(activity.updatedAt).toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                        ))}
                        {metrics.recentActivity.skills.slice(0, 3).map((activity, index) => (
                          <div key={`skill-${index}`} style={{ padding: '0.5rem 0', borderBottom: '1px solid #eee' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span>
                                <strong>{activity.gymnast.firstName} {activity.gymnast.lastName}</strong> mastered{' '}
                                <em>{activity.skill.name}</em>
                              </span>
                              <span className="text-muted small">
                                {new Date(activity.updatedAt).toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-muted">No recent activity in the last 30 days.</p>
                    )}
                  </div>
                </div>

                {/* Unprinted Certificates */}
                <div className="card">
                  <div className="card-header">
                    <h3 className="card-title">🖨️ Certificates Ready to Print</h3>
                    <p className="text-muted" style={{ marginTop: '0.5rem', fontSize: '0.875rem' }}>
                      Certificates that have been awarded but haven't been printed yet
                    </p>
                  </div>
                  <div>
                    {loadingUnprinted ? (
                      <div className="loading">
                        <div className="spinner"></div>
                        <p>Loading certificates to print...</p>
                      </div>
                    ) : unprintedCertificates.length > 0 ? (
                      <div>
                        {success && (
                          <div className="alert alert-success" style={{ marginBottom: '1rem' }}>
                            {success}
                          </div>
                        )}
                        {error && (
                          <div className="alert alert-error" style={{ marginBottom: '1rem' }}>
                            {error}
                          </div>
                        )}
                        {unprintedCertificates.slice(0, 10).map((certificate, index) => (
                          <div key={certificate.id} style={{ padding: '1rem 0.5rem', borderBottom: '1px solid #eee' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                              <div>
                                <strong>{certificate.gymnast.firstName} {certificate.gymnast.lastName}</strong>
                                <span className="badge badge-primary" style={{ marginLeft: '0.5rem' }}>
                                  Level {certificate.level.identifier}
                                </span>
                                <span className="badge badge-secondary" style={{ marginLeft: '0.5rem' }}>
                                  {certificate.level.name}
                                </span>
                              </div>
                              
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <button
                                onClick={() => handlePrintCertificate(certificate.id)}
                                className="btn btn-sm btn-success"
                                title="Mark as printed"
                              >
                                🖨️ Mark as Printed
                              </button>
                              <Link
                                to={`/certificates/${certificate.id}/preview`}
                                className="btn btn-sm btn-outline"
                                title="View certificate"
                              >
                                👁️ Preview
                              </Link>
                              
                            </div>
                          </div>
                        ))}
                        {unprintedCertificates.length > 10 && (
                          <div style={{ padding: '1rem 0.5rem', textAlign: 'center' }}>
                            <Link to="/certificates" className="btn btn-outline">
                              View All Certificates to Print ({unprintedCertificates.length - 10} more)
                            </Link>
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-muted">🎉 All certificates have been printed!</p>
                    )}
                  </div>
                </div>

                {/* Code of the Day */}
                <div className="card">
                  <div className="card-header">
                    <h3 className="card-title">📅 Code of the Day</h3>
                    <p className="text-muted" style={{ marginTop: '0.5rem', fontSize: '0.875rem' }}>
                      Generate a daily access code for gymnasts to view their progress
                    </p>
                  </div>
                  <div className="card-body">
                    <button
                      onClick={handleGetCodeOfDay}
                      className="btn btn-primary"
                      style={{ width: '100%' }}
                    >
                      📅 Generate Code of the Day
                    </button>
                  </div>
                </div>
              </>
            ) : null}
          </>
        )}

        
      </div>

      {/* Share Code Modal */}
      {shareCodeModal && (
        <div className="modal-overlay active" onClick={() => setShareCodeModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>🔑 Share Access Code Generated!</h3>
              <button 
                className="modal-close"
                onClick={() => setShareCodeModal(false)}
                aria-label="Close modal"
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                <div style={{ 
                  fontSize: '2rem', 
                  fontWeight: 'bold', 
                  backgroundColor: '#f8f9fa', 
                  padding: '1rem', 
                  borderRadius: '8px',
                  border: '2px solid #28a745',
                  color: '#28a745',
                  letterSpacing: '0.2em'
                }}>
                  {generatedCode}
                </div>
              </div>
              <div style={{ fontSize: '0.9rem', lineHeight: '1.5' }}>
                <p><strong>📱 Share this code with gymnasts so they can:</strong></p>
                <ul style={{ marginLeft: '1rem' }}>
                  <li>Go to the "Kids Login" page</li>
                  <li>Enter their name and this access code</li>
                  <li>View their own progress independently!</li>
                </ul>
                <p style={{ marginTop: '1rem', color: '#dc3545', fontWeight: 'bold' }}>
                  ⚠️ Keep this code safe! You can generate a new one anytime if needed.
                </p>
                {isCoach && (
                  <p style={{ marginTop: '1rem', color: '#0066cc', fontStyle: 'italic' }}>
                    💡 As a coach, this code gives access to all gymnasts in your club.
                  </p>
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button 
                onClick={() => setShareCodeModal(false)}
                className="btn btn-primary"
              >
                Got it!
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Code of the Day Modal */}
      {codeOfDayModal && (
        <div className="modal-overlay active" onClick={() => setCodeOfDayModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>📅 Code of the Day</h3>
              <button 
                className="modal-close"
                onClick={() => setCodeOfDayModal(false)}
                aria-label="Close modal"
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              {codeOfDayInfo?.isActive ? (
                <div>
                  <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                    <div style={{ 
                      fontSize: '2rem', 
                      fontWeight: 'bold', 
                      backgroundColor: '#f8f9fa', 
                      padding: '1rem', 
                      borderRadius: '8px',
                      border: '2px solid #007bff',
                      color: '#007bff',
                      letterSpacing: '0.2em'
                    }}>
                      {codeOfDayInfo.codeOfTheDay}
                    </div>
                  </div>
                  <div style={{ fontSize: '0.9rem', lineHeight: '1.5' }}>
                    <p><strong>🏫 Current club-wide access code</strong></p>
                    <p><strong>Expires:</strong> {new Date(codeOfDayInfo.expiresAt).toLocaleString()}</p>
                    <p style={{ marginTop: '1rem' }}>Any gymnast in your club can use this code to access their progress.</p>
                  </div>
                  <div style={{ marginTop: '1rem', display: 'flex', gap: '1rem' }}>
                    <button onClick={handleGenerateCodeOfDay} className="btn btn-outline">
                      🔄 Generate New Code
                    </button>
                    <button onClick={() => clearCodeOfTheDay().then(() => setCodeOfDayModal(false))} className="btn btn-secondary">
                      🗑️ Clear Code
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <p>No active code of the day. Generate one for club-wide access.</p>
                  <button onClick={handleGenerateCodeOfDay} className="btn btn-primary">
                    📅 Generate Code of the Day
                  </button>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button 
                onClick={() => setCodeOfDayModal(false)}
                className="btn btn-secondary"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard; 