import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { ChevronRightIcon, ChevronDownIcon, PencilIcon, TrashIcon } from '@heroicons/react/24/outline';

const CompetitionModal = ({ competition, onSave, onCancel }) => {
  const [formData, setFormData] = useState({
    name: competition?.name || '',
    code: competition?.code || '',
    description: competition?.description || '',
    category: competition?.category || '',
    order: competition?.order || 1
  });

  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [existingCategories, setExistingCategories] = useState([]);
  const [isCustomCategory, setIsCustomCategory] = useState(false);

  // Fetch existing categories on mount
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await fetch('/api/competitions/categories', {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        });
        if (response.ok) {
          const categories = await response.json();
          setExistingCategories(categories);
          
          // If editing and category is not in existing list, set as custom
          if (competition?.category && !categories.includes(competition.category)) {
            setIsCustomCategory(true);
          }
        }
      } catch (error) {
        console.error('Failed to fetch categories:', error);
      }
    };

    fetchCategories();
  }, [competition]);

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

  const handleCategoryChange = (e) => {
    const value = e.target.value;
    if (value === '__custom__') {
      setIsCustomCategory(true);
      setFormData(prev => ({ ...prev, category: '' }));
    } else {
      setIsCustomCategory(false);
      setFormData(prev => ({ ...prev, category: value }));
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
            {!isCustomCategory ? (
              <select
                name="category"
                value={formData.category}
                onChange={handleCategoryChange}
                required
              >
                <option value="">Select a category...</option>
                {existingCategories.map(category => (
                  <option key={category} value={category}>{category}</option>
                ))}
                <option value="__custom__">+ Create new category</option>
              </select>
            ) : (
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <input
                  type="text"
                  name="category"
                  value={formData.category}
                  onChange={handleChange}
                  placeholder="Enter new category name..."
                  required
                  style={{ flex: 1 }}
                />
                <button
                  type="button"
                  onClick={() => {
                    setIsCustomCategory(false);
                    setFormData(prev => ({ ...prev, category: '' }));
                  }}
                  className="btn btn-sm btn-outline"
                >
                  Cancel
                </button>
              </div>
            )}
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

          {/* Active toggle removed for simplicity */}

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

const CategoryModal = ({ category, action, onSave, onCancel }) => {
  const [formData, setFormData] = useState({
    newCategoryName: action === 'edit' ? category : ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState({});

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
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
      if (action === 'edit') {
        if (!formData.newCategoryName.trim()) {
          setErrors({ newCategoryName: 'Category name is required' });
          return;
        }
        await onSave(formData);
      } else if (action === 'delete') {
        await onSave({});
      }
    } catch (error) {
      setErrors({ submit: error.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h3>
            {action === 'edit' ? 'Edit Category' : 'Delete Category'}
          </h3>
          <button className="modal-close" onClick={onCancel}>×</button>
        </div>
        
        <form onSubmit={handleSubmit} className="modal-body">
          {action === 'edit' ? (
            <div className="form-group">
              <label>Category Name *</label>
              <input
                type="text"
                name="newCategoryName"
                value={formData.newCategoryName}
                onChange={handleChange}
                required
                placeholder="Enter category name..."
              />
              {errors.newCategoryName && <span className="error">{errors.newCategoryName}</span>}
            </div>
          ) : (
            <div className="form-group">
              <p>Are you sure you want to delete the category <strong>"{category}"</strong>?</p>
              <p className="text-warning">
                This action cannot be undone. You can only delete categories that have no competitions.
              </p>
            </div>
          )}

          {errors.submit && <div className="error">{errors.submit}</div>}
        </form>

        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onCancel}>
            Cancel
          </button>
          <button 
            type="submit" 
            className={`btn ${action === 'delete' ? 'btn-danger' : 'btn-primary'}`}
            disabled={isSubmitting}
            onClick={handleSubmit}
          >
            {isSubmitting ? 'Processing...' : (action === 'edit' ? 'Save Changes' : 'Delete Category')}
          </button>
        </div>
      </div>
    </div>
  );
};

const CompetitionCard = ({ competition, onEdit, onDelete }) => {
  const deleteDisabled = competition.levelsCount > 0;
  const deleteTitle = deleteDisabled
    ? `Cannot delete: associated with ${competition.levelsCount} level${competition.levelsCount === 1 ? '' : 's'}`
    : 'Delete competition';
  return (
    <div className="competition-card">
      <div className="competition-header">
        <div className="competition-info">
          <h4>{competition.name}</h4>
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
            <span title={deleteTitle}>
              <button 
                className="btn btn-xs btn-danger" 
                onClick={() => onDelete(competition)}
                disabled={deleteDisabled}
              >
                <TrashIcon className="icon" />
                Delete
              </button>
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

const Competitions = () => {
  const { canEditCompetitions } = useAuth();
  const [competitions, setCompetitions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [selectedCompetition, setSelectedCompetition] = useState(null);
  const [collapsedCategories, setCollapsedCategories] = useState(new Set());
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [categoryAction, setCategoryAction] = useState(null); // 'edit' or 'delete'
  const [initializedCollapse, setInitializedCollapse] = useState(false);

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
        // Collapse all categories by default on first load
        if (!initializedCollapse) {
          const cats = new Set(data.map(c => c.category));
          setCollapsedCategories(cats);
          setInitializedCollapse(true);
        }
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

  const handleEditCategory = (category) => {
    setSelectedCategory(category);
    setCategoryAction('edit');
    setShowCategoryModal(true);
  };

  const handleDeleteCategory = (category) => {
    setSelectedCategory(category);
    setCategoryAction('delete');
    setShowCategoryModal(true);
  };

  const handleCategoryAction = async (data) => {
    try {
      const url = `/api/competitions/categories/${encodeURIComponent(selectedCategory)}`;
      
      if (categoryAction === 'edit') {
        const response = await fetch(url, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify({ newCategoryName: data.newCategoryName })
        });

        if (response.ok) {
          await fetchCompetitions();
          setShowCategoryModal(false);
          setSelectedCategory(null);
          setCategoryAction(null);
        } else {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to update category');
        }
      } else if (categoryAction === 'delete') {
        const response = await fetch(url, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        });

        if (response.ok) {
          await fetchCompetitions();
          setShowCategoryModal(false);
          setSelectedCategory(null);
          setCategoryAction(null);
        } else {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to delete category');
        }
      }
    } catch (error) {
      alert(error.message);
    }
  };

  // Group competitions by category
  const groupedCompetitions = competitions.reduce((acc, competition) => {
    if (!acc[competition.category]) {
      acc[competition.category] = [];
    }
    acc[competition.category].push(competition);
    return acc;
  }, {});

  // Sort categories - prioritize common categories, then alphabetical
  const commonCategoryOrder = ['CLUB', 'REGIONAL', 'LEAGUE', 'NATIONAL', 'INTERNATIONAL'];
  const sortedCategories = Object.keys(groupedCompetitions).sort((a, b) => {
    const aIndex = commonCategoryOrder.indexOf(a);
    const bIndex = commonCategoryOrder.indexOf(b);
    
    // If both are common categories, use the predefined order
    if (aIndex !== -1 && bIndex !== -1) {
      return aIndex - bIndex;
    }
    
    // If only one is a common category, prioritize it
    if (aIndex !== -1) return -1;
    if (bIndex !== -1) return 1;
    
    // If neither are common categories, sort alphabetically
    return a.localeCompare(b);
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
        <h1>Competition Categories</h1>
        {canEditCompetitions && (
          <button className="btn btn-primary" onClick={handleCreateCompetition}>
            Create Competition Category
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
            <div className="category-header">
              <div 
                className="category-header-main"
                onClick={() => toggleCategory(category)}
              >
                {collapsedCategories.has(category) ? 
                  <ChevronRightIcon className="icon" /> : 
                  <ChevronDownIcon className="icon" />
                }
                <h2>{category.replace(/_/g, ' ')}</h2>
              </div>
              {canEditCompetitions && (
                <div className="category-actions">
                  <button 
                    className="btn btn-xs btn-secondary"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEditCategory(category);
                    }}
                    title="Edit category name"
                  >
                    <PencilIcon className="icon" />
                  </button>
                  <span title={groupedCompetitions[category].length > 0 ? 'Cannot delete categories that contain competitions' : 'Delete category'}>
                    <button 
                      className="btn btn-xs btn-outline btn-danger"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteCategory(category);
                      }}
                      disabled={groupedCompetitions[category].length > 0}
                    >
                      <TrashIcon className="icon" />
                    </button>
                  </span>
                </div>
              )}
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

      {showCategoryModal && (
        <CategoryModal
          category={selectedCategory}
          action={categoryAction}
          onSave={handleCategoryAction}
          onCancel={() => {
            setShowCategoryModal(false);
            setSelectedCategory(null);
            setCategoryAction(null);
          }}
        />
      )}
    </div>
  );
};

export default Competitions; 