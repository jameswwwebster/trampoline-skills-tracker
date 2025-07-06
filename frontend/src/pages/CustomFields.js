import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import apiClient from '../utils/apiInterceptor';
import './CustomFields.css';

const FIELD_TYPES = [
  { value: 'TEXT', label: 'Text' },
  { value: 'TEXTAREA', label: 'Text Area' },
  { value: 'NUMBER', label: 'Number' },
  { value: 'EMAIL', label: 'Email' },
  { value: 'PHONE', label: 'Phone' },
  { value: 'DATE', label: 'Date' },
  { value: 'BOOLEAN', label: 'Yes/No' },
  { value: 'DROPDOWN', label: 'Dropdown' },
  { value: 'MULTI_SELECT', label: 'Multi-Select' }
];

const CustomFields = () => {
  const { user } = useAuth();
  const [fields, setFields] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingField, setEditingField] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    key: '',
    fieldType: 'TEXT',
    isRequired: false,
    options: []
  });

  useEffect(() => {
    fetchCustomFields();
  }, []);

  const fetchCustomFields = async () => {
    try {
      const response = await apiClient.get('/api/user-custom-fields');
      setFields(response.data);
    } catch (error) {
      console.error('Error fetching custom fields:', error);
      setError('Failed to load custom fields');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      const url = editingField 
        ? `/api/user-custom-fields/${editingField.id}`
        : '/api/user-custom-fields';
      
      const method = editingField ? 'PUT' : 'POST';
      
      const submitData = {
        ...formData,
        options: ['DROPDOWN', 'MULTI_SELECT'].includes(formData.fieldType) 
          ? formData.options.filter(opt => opt.trim() !== '')
          : null
      };

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(submitData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save custom field');
      }

      await fetchCustomFields();
      handleCloseModal();
    } catch (error) {
      console.error('Error saving custom field:', error);
      setError(error.message);
    }
  };

  const handleDelete = async (fieldId) => {
    if (!window.confirm('Are you sure you want to delete this custom field? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch(`/api/user-custom-fields/${fieldId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to delete custom field');
      }

      await fetchCustomFields();
    } catch (error) {
      console.error('Error deleting custom field:', error);
      setError('Failed to delete custom field');
    }
  };

  const handleEdit = (field) => {
    setEditingField(field);
    setFormData({
      name: field.name,
      key: field.key,
      fieldType: field.fieldType,
      isRequired: field.isRequired,
      options: field.options ? JSON.parse(field.options) : []
    });
    setShowCreateModal(true);
  };

  const handleCloseModal = () => {
    setShowCreateModal(false);
    setEditingField(null);
    setFormData({
      name: '',
      key: '',
      fieldType: 'TEXT',
      isRequired: false,
      options: []
    });
    setError(null);
  };

  const handleKeyChange = (name) => {
    const key = name.toLowerCase().replace(/[^a-z0-9]/g, '_');
    setFormData(prev => ({ ...prev, key }));
  };

  const handleAddOption = () => {
    setFormData(prev => ({
      ...prev,
      options: [...prev.options, '']
    }));
  };

  const handleOptionChange = (index, value) => {
    setFormData(prev => ({
      ...prev,
      options: prev.options.map((opt, i) => i === index ? value : opt)
    }));
  };

  const handleRemoveOption = (index) => {
    setFormData(prev => ({
      ...prev,
      options: prev.options.filter((_, i) => i !== index)
    }));
  };

  const getFieldTypeIcon = (type) => {
    const icons = {
      TEXT: '📝',
      TEXTAREA: '📄',
      NUMBER: '🔢',
      EMAIL: '📧',
      PHONE: '📞',
      DATE: '📅',
      BOOLEAN: '☑️',
      DROPDOWN: '📋',
      MULTI_SELECT: '📋'
    };
    return icons[type] || '📝';
  };

  if (loading) {
    return (
      <div className="custom-fields-page">
        <div className="loading-spinner">Loading custom fields...</div>
      </div>
    );
  }

  return (
    <div className="custom-fields-page">
        <div className="custom-fields-header">
          <h1>Custom Fields</h1>
          <p>Manage additional fields for user profiles that can be imported from CSV files</p>
          <button 
            className="btn btn-primary"
            onClick={() => setShowCreateModal(true)}
          >
            Add Custom Field
          </button>
        </div>

        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        <div className="custom-fields-grid">
          {fields.length === 0 ? (
            <div className="empty-state">
              <h3>No custom fields yet</h3>
              <p>Create your first custom field to collect additional information about users.</p>
            </div>
          ) : (
            fields.map((field) => (
              <div key={field.id} className="custom-field-card">
                <div className="field-header">
                  <div className="field-icon">
                    {getFieldTypeIcon(field.fieldType)}
                  </div>
                  <div className="field-info">
                    <h3>{field.name}</h3>
                    <p className="field-key">Key: {field.key}</p>
                    <p className="field-type">
                      {FIELD_TYPES.find(t => t.value === field.fieldType)?.label}
                      {field.isRequired && <span className="required-badge">Required</span>}
                    </p>
                  </div>
                </div>

                {field.options && (
                  <div className="field-options">
                    <strong>Options:</strong>
                    <ul>
                      {JSON.parse(field.options).map((option, index) => (
                        <li key={index}>{option}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="field-actions">
                  <button 
                    className="btn btn-secondary"
                    onClick={() => handleEdit(field)}
                  >
                    Edit
                  </button>
                  <button 
                    className="btn btn-danger"
                    onClick={() => handleDelete(field.id)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {showCreateModal && (
          <div className="modal-overlay">
            <div className="modal-content">
              <div className="modal-header">
                <h2>{editingField ? 'Edit Custom Field' : 'Create Custom Field'}</h2>
                <button className="close-btn" onClick={handleCloseModal}>×</button>
              </div>

              <form onSubmit={handleSubmit} className="custom-field-form">
                <div className="form-group">
                  <label htmlFor="name">Field Name *</label>
                  <input
                    type="text"
                    id="name"
                    value={formData.name}
                    onChange={(e) => {
                      setFormData(prev => ({ ...prev, name: e.target.value }));
                      handleKeyChange(e.target.value);
                    }}
                    required
                    placeholder="e.g., Emergency Contact"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="key">Field Key *</label>
                  <input
                    type="text"
                    id="key"
                    value={formData.key}
                    onChange={(e) => setFormData(prev => ({ ...prev, key: e.target.value }))}
                    required
                    placeholder="e.g., emergency_contact"
                  />
                  <small>Used for CSV column mapping. Only letters, numbers, and underscores.</small>
                </div>

                <div className="form-group">
                  <label htmlFor="fieldType">Field Type *</label>
                  <select
                    id="fieldType"
                    value={formData.fieldType}
                    onChange={(e) => setFormData(prev => ({ ...prev, fieldType: e.target.value }))}
                    required
                  >
                    {FIELD_TYPES.map(type => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>
                    <input
                      type="checkbox"
                      checked={formData.isRequired}
                      onChange={(e) => setFormData(prev => ({ ...prev, isRequired: e.target.checked }))}
                    />
                    Required field
                  </label>
                </div>

                {['DROPDOWN', 'MULTI_SELECT'].includes(formData.fieldType) && (
                  <div className="form-group">
                    <label>Options *</label>
                    <div className="options-list">
                      {formData.options.map((option, index) => (
                        <div key={index} className="option-row">
                          <input
                            type="text"
                            value={option}
                            onChange={(e) => handleOptionChange(index, e.target.value)}
                            placeholder={`Option ${index + 1}`}
                          />
                          <button
                            type="button"
                            className="btn btn-danger btn-sm"
                            onClick={() => handleRemoveOption(index)}
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={handleAddOption}
                      >
                        Add Option
                      </button>
                    </div>
                  </div>
                )}

                <div className="form-actions">
                  <button type="button" className="btn btn-secondary" onClick={handleCloseModal}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary">
                    {editingField ? 'Update Field' : 'Create Field'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
  );
};

export default CustomFields; 