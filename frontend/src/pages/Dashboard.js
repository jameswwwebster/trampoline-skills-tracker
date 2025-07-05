import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import CreateClubForm from '../components/CreateClubForm';

const Dashboard = () => {
  const { user, isClubAdmin, isParent, isChild, generateFamilyCode, updateUser } = useAuth();
  const [familyCodeModal, setFamilyCodeModal] = useState(false);
  const [generatedCode, setGeneratedCode] = useState(null);

  const handleClubCreated = (club, updatedUser) => {
    // Update the user context with the new club information
    updateUser(updatedUser);
  };

  const handleGenerateFamilyCode = async () => {
    const result = await generateFamilyCode();
    if (result.success) {
      setGeneratedCode(result.familyAccessCode);
      setFamilyCodeModal(true);
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
                <Link to="/my-progress" className="btn btn-primary" style={{ marginRight: '1rem' }}>
                  📊 View My Children's Progress
                </Link>
                <button onClick={handleGenerateFamilyCode} className="btn btn-outline">
                  🔑 Generate Family Code
                </button>
                <p style={{ marginTop: '0.5rem', fontSize: '0.9rem', color: '#666' }}>
                  Monitor your children's skill development and generate access codes for them
                </p>
              </div>
            )}
            
            {(isClubAdmin || user?.role === 'COACH') && (
              <div style={{ marginTop: '1rem' }}>
                <Link to="/gymnasts" className="btn btn-primary">
                  Manage Gymnasts
                </Link>
                <p style={{ marginTop: '0.5rem', fontSize: '0.9rem', color: '#666' }}>
                  Track and update gymnast progress
                </p>
              </div>
            )}
            
            <div style={{ marginTop: '1.5rem' }}>
              <h4>Navigation Options:</h4>
              <ul>
                <li>
                  <Link to="/levels">View and explore trampoline levels</Link>
                </li>
                {(isClubAdmin || user?.role === 'COACH') && (
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
                  <li>Generate a <strong>Family Code</strong> so your children can login and see their own progress</li>
                  <li>See which skills they've mastered and what they're working on next</li>
                  <li>Track their progression through the 10 trampoline levels</li>
                  <li>Monitor their competition eligibility as they advance</li>
                  <li>View their complete progress history and achievements</li>
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Family Code Modal */}
      {familyCodeModal && (
        <div className="modal-overlay active" onClick={() => setFamilyCodeModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>🔑 Family Access Code Generated!</h3>
              <button 
                className="modal-close"
                onClick={() => setFamilyCodeModal(false)}
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
                <p><strong>📱 Share this code with your children so they can:</strong></p>
                <ul style={{ marginLeft: '1rem' }}>
                  <li>Go to the "Kids Login" page</li>
                  <li>Enter their name and this family code</li>
                  <li>View their own progress independently!</li>
                </ul>
                <p style={{ marginTop: '1rem', color: '#dc3545', fontWeight: 'bold' }}>
                  ⚠️ Keep this code safe! You can generate a new one anytime if needed.
                </p>
              </div>
            </div>
            <div className="modal-footer">
              <button 
                onClick={() => setFamilyCodeModal(false)}
                className="btn btn-primary"
              >
                Got it!
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard; 