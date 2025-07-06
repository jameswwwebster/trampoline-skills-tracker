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
      
      const response = await axios.put(`/api/certificates/${certificateId}/status`, {
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
              <div className="card">
                <div className="card-header">
                  <h3 className="card-title">📊 Club Overview</h3>
                </div>
                <div>
                  <div className="loading">
                    <div className="spinner"></div>
                    <p>Loading metrics...</p>
                  </div>
                </div>
              </div>
            ) : metrics ? (
              <>
                {/* Summary Stats */}
                <div className="card">
                  <div className="card-header">
                    <h3 className="card-title">📊 Club Overview</h3>
                  </div>
                  <div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
                      <div className="metric-stat">
                        <div className="metric-number">{metrics.summary.totalGymnasts}</div>
                        <div className="metric-label">Total Gymnasts</div>
                      </div>
                      <div className="metric-stat">
                        <div className="metric-number">{metrics.summary.activeGymnasts}</div>
                        <div className="metric-label">Active (30 days)</div>
                      </div>
                      <div className="metric-stat">
                        <div className="metric-number">{metrics.summary.totalSkillsCompleted}</div>
                        <div className="metric-label">Skills Completed</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Level Distribution */}
                <div className="card">
                  <div className="card-header">
                    <h3 className="card-title">🎯 Gymnast Level Distribution</h3>
                    <p className="text-muted" style={{ marginTop: '0.5rem', fontSize: '0.875rem' }}>
                      Click on a level to view gymnasts working at that level
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
                      Click on a competition to view gymnasts ready to compete
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
                          <div>
                            <span><strong>{competitionName}</strong></span>
                            <span className="badge badge-secondary" style={{ marginLeft: '0.5rem' }}>{data.category}</span>
                          </div>
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
                              <div style={{ fontSize: '0.8rem', color: '#666' }}>
                                Awarded {new Date(certificate.awardedAt).toLocaleDateString()}
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
                              <div style={{ fontSize: '0.8rem', color: '#666' }}>
                                Awarded by {certificate.awardedBy.firstName} {certificate.awardedBy.lastName}
                              </div>
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
              </>
            ) : null}
          </>
        )}

        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Club Information</h3>
          </div>
          <div>
            <p><strong>Club:</strong> {user?.club?.name || 'No club assigned'}</p>
            <p><strong>Your Role:</strong> {user?.role?.replace('_', ' ')}</p>
            {user?.club?.address && (
              <p><strong>Address:</strong> {user.club.address}</p>
            )}
            {user?.club?.phone && (
              <p><strong>Phone:</strong> {user.club.phone}</p>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Quick Actions</h3>
          </div>
          <div>
            <p>Welcome to the Trampoline Tracker!</p>
            
            {isChild && (
              <div style={{ marginTop: '1rem' }}>
                <Link to="/my-progress" className="btn btn-primary">
                  🚀 View My Progress
                </Link>
                <p style={{ marginTop: '0.5rem', fontSize: '0.9rem', color: '#666' }}>
                  See your skills, levels, and achievements!
                </p>
              </div>
            )}
            
            {isParent && (
              <div style={{ marginTop: '1rem' }}>
                <Link to="/my-progress" className="btn btn-primary" style={{ marginRight: '1.5rem' }}>
                  📊 View My Children's Progress
                </Link>
                <button onClick={handleGenerateShareCode} className="btn btn-outline">
                  🔑 Generate Share Code
                </button>
                <p style={{ marginTop: '0.5rem', fontSize: '0.9rem', color: '#666' }}>
                  Monitor your children's skill development and generate access codes for them
                </p>
              </div>
            )}
            
            {isCoach && (
              <div style={{ marginTop: '1rem' }}>
                <Link to="/gymnasts" className="btn btn-primary" style={{ marginRight: '1.5rem' }}>
                  👥 Manage Gymnasts
                </Link>
                <button onClick={handleGetCodeOfDay} className="btn btn-secondary">
                  📅 Code of the Day
                </button>
                <p style={{ marginTop: '0.5rem', fontSize: '0.9rem', color: '#666' }}>
                  Track gymnast progress and manage club-wide access codes
                </p>
              </div>
            )}
            
            {isClubAdmin && (
              <div style={{ marginTop: '1rem' }}>
                <Link to="/gymnasts" className="btn btn-primary" style={{ marginRight: '1.5rem' }}>
                  👥 Manage Gymnasts
                </Link>
                <Link to="/parents" className="btn btn-outline" style={{ marginRight: '1.5rem' }}>
                  👪 View Parents
                </Link>
                <Link to="/users" className="btn btn-outline" style={{ marginRight: '1.5rem' }}>
                  👤 Manage User Roles
                </Link>
                <button onClick={handleGetCodeOfDay} className="btn btn-secondary">
                  📅 Code of the Day
                </button>
                <p style={{ marginTop: '0.5rem', fontSize: '0.9rem', color: '#666' }}>
                  Full club management, user role management, and code of the day controls
                </p>
              </div>
            )}
            
            <div style={{ marginTop: '1.5rem' }}>
              <h4>Navigation Options:</h4>
              <ul>
                <li>
                  <Link to="/levels">View and explore trampoline levels</Link>
                </li>
                {(isClubAdmin || isCoach) && (
                  <li>
                    <Link to="/competitions">Manage competitions</Link>
                  </li>
                )}
                {isClubAdmin && (
                  <li>
                    <Link to="/invites">Send invitations to new users</Link>
                  </li>
                )}
                {isClubAdmin && (
                  <li>
                    <Link to="/parents">View club parents and guardians</Link>
                  </li>
                )}
                {isClubAdmin && (
                  <li>
                    <Link to="/users">Manage user roles and permissions</Link>
                  </li>
                )}
              </ul>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Getting Started</h3>
          </div>
          <div>
            <p>This system tracks gymnast progress through trampoline skill levels.</p>
            <p>There are 10 sequential levels plus additional side paths for specialized training.</p>
            <p>Each level contains specific skills and routine requirements.</p>
            
            {isChild && (
              <div style={{ marginTop: '1rem', padding: '1rem', backgroundColor: '#e3f2fd', borderRadius: '8px' }}>
                <h4 style={{ color: '#1976d2', marginBottom: '0.5rem' }}>🤸‍♀️ Hi {user?.firstName}!</h4>
                <ul style={{ marginBottom: '0' }}>
                  <li>Click <strong>"My Progress"</strong> to see all your awesome trampoline skills!</li>
                  <li>See which skills you've mastered and what's coming next</li>
                  <li>Track your journey through the 10 trampoline levels</li>
                  <li>Celebrate your achievements and progress!</li>
                </ul>
              </div>
            )}
            
            {isParent && (
              <div style={{ marginTop: '1rem', padding: '1rem', backgroundColor: '#f8f9fa', borderRadius: '8px' }}>
                <h4 style={{ color: '#495057', marginBottom: '0.5rem' }}>👪 For Parents:</h4>
                <ul style={{ marginBottom: '0' }}>
                  <li>Use <strong>"Children's Progress"</strong> to view your child's skill development</li>
                  <li>Generate a <strong>Share Code</strong> so your children and others you trust can login and see progress</li>
                  <li>See which skills they've mastered and what they're working on next</li>
                  <li>Track their progression through the trampoline levels</li>
                  <li>Monitor their competition eligibility as they advance</li>
                  <li>View their complete progress history and achievements</li>
                </ul>
              </div>
            )}

            {isCoach && (
              <div style={{ marginTop: '1rem', padding: '1rem', backgroundColor: '#fff3cd', borderRadius: '8px' }}>
                <h4 style={{ color: '#856404', marginBottom: '0.5rem' }}>🏃‍♂️ For Coaches:</h4>
                <ul style={{ marginBottom: '0' }}>
                  <li>Use <strong>Code of the Day</strong> for club-wide access during training sessions</li>
                  <li>All gymnasts in your club can use the same code to access their progress</li>
                  <li>Track all gymnasts' progress and update skill achievements</li>
                  <li>Manage competition preparation and level progression</li>
                </ul>
              </div>
            )}
          </div>
        </div>
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