import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { ChevronRightIcon, ChevronDownIcon, PencilIcon, TrashIcon } from '@heroicons/react/24/outline';

const CompetitionModal = ({ competition, onSave, onCancel, categories }) => {
  const [formData, setFormData] = useState({
    name: competition?.name || '',
    code: competition?.code || '',
    description: competition?.description || '',
    category: competition?.category || 'CLUB',
    order: competition?.order || 1,
    isActive: competition?.isActive ?? true
  });

  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    
    // Clear error when field is changed
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrors({});

    try {
      await onSave(formData);
    } catch (error) {
      if (error.response?.data?.error) {
        setErrors({ submit: error.response.data.error });
      } else {
        setErrors({ submit: 'An error occurred while saving the competition' });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h3>{competition ? 'Edit Competition' : 'Create Competition'}</h3>
          <button className="modal-close" onClick={onCancel}>×</button>
        </div>
        
        <form onSubmit={handleSubmit} className="modal-body">
          <div className="form-group">
            <label>Name *</label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
              placeholder="e.g., Club Level 1"
            />
            {errors.name && <span className="error">{errors.name}</span>}
          </div>

          <div className="form-group">
            <label>Code *</label>
            <input
              type="text"
              name="code"
              value={formData.code}
              onChange={handleChange}
              required
              placeholder="e.g., club-level-1"
            />
            {errors.code && <span className="error">{errors.code}</span>}
          </div>

          <div className="form-group">
            <label>Description</label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              placeholder="Optional description of the competition"
              rows="3"
            />
            {errors.description && <span className="error">{errors.description}</span>}
          </div>

          <div className="form-group">
            <label>Category *</label>
            <select
              name="category"
              value={formData.category}
              onChange={handleChange}
              required
            >
              <option value="CLUB">Club</option>
              <option value="REGIONAL">Regional</option>
              <option value="LEAGUE">League</option>
              <option value="NATIONAL">National</option>
              <option value="INTERNATIONAL">International</option>
            </select>
            {errors.category && <span className="error">{errors.category}</span>}
          </div>

          <div className="form-group">
            <label>Order *</label>
            <input
              type="number"
              name="order"
              value={formData.order}
              onChange={handleChange}
              required
              min="1"
            />
            {errors.order && <span className="error">{errors.order}</span>}
          </div>

          <div className="form-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                name="isActive"
                checked={formData.isActive}
                onChange={handleChange}
              />
              <span className="checkbox-custom"></span>
              Active
            </label>
          </div>

          {errors.submit && <div className="error">{errors.submit}</div>}
        </form>

        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onCancel}>
            Cancel
          </button>
          <button 
            type="submit" 
            className="btn btn-primary"
            disabled={isSubmitting}
            onClick={handleSubmit}
          >
            {isSubmitting ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
};

const CompetitionCard = ({ competition, onEdit, onDelete }) => {
  return (
    <div className="competition-card">
      <div className="competition-header">
        <div className="competition-info">
          <h4>{competition.name}</h4>
          <p className="competition-code">{competition.code}</p>
          {competition.description && (
            <p className="competition-description">{competition.description}</p>
          )}
        </div>
        <div className="competition-actions">
          {onEdit && (
            <button className="btn btn-xs btn-secondary" onClick={() => onEdit(competition)}>
              <PencilIcon className="icon" />
              Edit
            </button>
          )}
          {onDelete && (
            <button 
              className="btn btn-xs btn-danger" 
              onClick={() => onDelete(competition)}
              disabled={competition.levelsCount > 0}
            >
              <TrashIcon className="icon" />
              Delete
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

const Competitions = () => {
  const { user, canEditCompetitions } = useAuth();
  const [competitions, setCompetitions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [selectedCompetition, setSelectedCompetition] = useState(null);
  const [collapsedCategories, setCollapsedCategories] = useState(new Set());

  useEffect(() => {
    fetchCompetitions();
  }, []);

  const fetchCompetitions = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/competitions', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setCompetitions(data);
      } else {
        setError('Failed to fetch competitions');
      }
    } catch (err) {
      setError('An error occurred while fetching competitions');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCompetition = () => {
    setSelectedCompetition(null);
    setShowModal(true);
  };

  const handleEditCompetition = (competition) => {
    setSelectedCompetition(competition);
    setShowModal(true);
  };

  const handleSaveCompetition = async (competitionData) => {
    const url = selectedCompetition 
      ? `/api/competitions/${selectedCompetition.id}`
      : '/api/competitions';
    
    const method = selectedCompetition ? 'PUT' : 'POST';

    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify(competitionData)
    });

    if (response.ok) {
      await fetchCompetitions();
      setShowModal(false);
      setSelectedCompetition(null);
    } else {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to save competition');
    }
  };

  const handleDeleteCompetition = async (competition) => {
    if (competition.levelsCount > 0) {
      alert('Cannot delete competition that is associated with levels. Remove the associations first.');
      return;
    }

    if (window.confirm(`Are you sure you want to delete "${competition.name}"?`)) {
      try {
        const response = await fetch(`/api/competitions/${competition.id}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        });

        if (response.ok) {
          await fetchCompetitions();
        } else {
          const errorData = await response.json();
          alert(errorData.error || 'Failed to delete competition');
        }
      } catch (err) {
        alert('An error occurred while deleting the competition');
      }
    }
  };

  const toggleCategory = (category) => {
    setCollapsedCategories(prev => {
      const newSet = new Set(prev);
      if (newSet.has(category)) {
        newSet.delete(category);
      } else {
        newSet.add(category);
      }
      return newSet;
    });
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

  if (loading) {
    return <div className="loading">Loading competitions...</div>;
  }

  if (error) {
    return <div className="error">{error}</div>;
  }

  return (
    <div className="competitions-page">
      <div className="page-header">
        <h1>Competition Management</h1>
        <p>Manage competition levels and their associations with skill levels</p>
        {canEditCompetitions && (
          <button className="btn btn-primary" onClick={handleCreateCompetition}>
            Create Competition
          </button>
        )}
      </div>

      {!canEditCompetitions && (
        <div className="info-message">
          <p>You can view competitions but don't have permission to edit them.</p>
        </div>
      )}

      <div className="competitions-content">
        {sortedCategories.map(category => (
          <div key={category} className="category-section">
            <div 
              className="category-header"
              onClick={() => toggleCategory(category)}
            >
              {collapsedCategories.has(category) ? 
                <ChevronRightIcon className="icon" /> : 
                <ChevronDownIcon className="icon" />
              }
              <h2>{category.toLowerCase().replace('_', ' ')}</h2>
              <span className="category-count">({groupedCompetitions[category].length})</span>
            </div>

            {!collapsedCategories.has(category) && (
              <div className="category-content">
                {groupedCompetitions[category].map(competition => (
                  <CompetitionCard
                    key={competition.id}
                    competition={competition}
                    onEdit={canEditCompetitions ? handleEditCompetition : undefined}
                    onDelete={canEditCompetitions ? handleDeleteCompetition : undefined}
                  />
                ))}
              </div>
            )}
          </div>
        ))}

        {sortedCategories.length === 0 && (
          <div className="empty-state">
            <p>No competitions found.</p>
            {canEditCompetitions && (
              <button className="btn btn-primary" onClick={handleCreateCompetition}>
                Create your first competition
              </button>
            )}
          </div>
        )}
      </div>

      {showModal && (
        <CompetitionModal
          competition={selectedCompetition}
          onSave={handleSaveCompetition}
          onCancel={() => {
            setShowModal(false);
            setSelectedCompetition(null);
          }}
        />
      )}
    </div>
  );
};

export default Competitions; 