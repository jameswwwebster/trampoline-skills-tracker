import React, { useState } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';

const CoachNotes = ({ gymnast, onNotesUpdate }) => {
  const [notes, setNotes] = useState(gymnast?.coachNotes || '');
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const { user } = useAuth();

  // Only coaches and club admins can edit notes
  const canEditNotes = user?.role === 'COACH' || user?.role === 'CLUB_ADMIN';

  const handleSave = async () => {
    if (!canEditNotes) return;

    setSaving(true);
    setError('');

    try {
      const response = await axios.patch(`/api/gymnasts/${gymnast.id}/coach-notes`, {
        coachNotes: notes
      });

      // Notify parent component of the update
      if (onNotesUpdate) {
        onNotesUpdate(response.data);
      }

      setIsEditing(false);
    } catch (error) {
      console.error('Failed to save coach notes:', error);
      setError(error.response?.data?.error || 'Failed to save notes');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setNotes(gymnast?.coachNotes || '');
    setIsEditing(false);
    setError('');
  };

  const handleEdit = () => {
    setIsEditing(true);
    setError('');
  };

  if (!gymnast) {
    return null;
  }

  return (
    <div className="coach-notes-section">
      <div className="card">
        <div className="card-header">
          <div className="card-title-row">
            <h4 className="card-title">Coach Notes</h4>
            {canEditNotes && !isEditing && (
              <button
                onClick={handleEdit}
                className="btn btn-sm btn-outline"
                disabled={saving}
              >
                Edit Notes
              </button>
            )}
          </div>
        </div>

        <div className="card-body">
          {error && (
            <div className="alert alert-error" style={{ marginBottom: '1rem' }}>
              {error}
            </div>
          )}

          {!canEditNotes && (
            <div className="alert alert-info" style={{ marginBottom: '1rem' }}>
              Only coaches can edit notes.
            </div>
          )}

          {isEditing ? (
            <div className="notes-editing">
              <div className="form-group">
                <label htmlFor="coach-notes">Notes about this gymnast:</label>
                <textarea
                  id="coach-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="form-control"
                  rows={5}
                  placeholder="Add notes about the gymnast's progress, strengths, areas for improvement, goals, etc."
                  disabled={saving}
                />
              </div>

              <div className="form-actions">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="btn btn-primary"
                >
                  {saving ? 'Saving...' : 'Save Notes'}
                </button>
                <button
                  onClick={handleCancel}
                  disabled={saving}
                  className="btn btn-outline"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="notes-display">
              {gymnast.coachNotes ? (
                <div className="notes-content">
                  <p>{gymnast.coachNotes}</p>
                </div>
              ) : (
                <div className="notes-empty">
                  <p className="text-muted">
                    {canEditNotes 
                      ? 'No coach notes yet. Click "Edit Notes" to add notes about this gymnast.'
                      : 'No coach notes available.'
                    }
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CoachNotes; 