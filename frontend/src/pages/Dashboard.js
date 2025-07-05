import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import CreateClubForm from '../components/CreateClubForm';

const Dashboard = () => {
  const { user, isClubAdmin, isParent, isChild, isCoach, generateShareCode, generateCodeOfTheDay, getCodeOfTheDay, clearCodeOfTheDay, updateUser } = useAuth();
  const [shareCodeModal, setShareCodeModal] = useState(false);
  const [codeOfDayModal, setCodeOfDayModal] = useState(false);
  const [generatedCode, setGeneratedCode] = useState(null);
  const [codeOfDayInfo, setCodeOfDayInfo] = useState(null);

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
                <button onClick={handleGetCodeOfDay} className="btn btn-secondary">
                  📅 Code of the Day
                </button>
                <p style={{ marginTop: '0.5rem', fontSize: '0.9rem', color: '#666' }}>
                  Full club management and code of the day controls
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