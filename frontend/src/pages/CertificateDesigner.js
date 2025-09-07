import React, { useState, useEffect, useRef, useCallback } from 'react';
// import { useAuth } from '../contexts/AuthContext'; // Not used currently
import axios from 'axios';
import '../components/CertificateDesigner.css';

// Throttle function for better performance
const throttle = (func, limit) => {
  let inThrottle;
  return function() {
    const args = arguments;
    const context = this;
    if (!inThrottle) {
      func.apply(context, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  }
};

// Debounce function for API calls
const debounce = (func, wait) => {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

const CertificateDesigner = () => {
  // const { user } = useAuth(); // Not used currently
  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [fields, setFields] = useState([]);
  const [selectedField, setSelectedField] = useState(null);
  const [showTemplateUpload, setShowTemplateUpload] = useState(false);
  const [showFieldModal, setShowFieldModal] = useState(false);
  const [draggedField, setDraggedField] = useState(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [fieldTypes, setFieldTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [templateUrl, setTemplateUrl] = useState(null);
  const [templateDimensions, setTemplateDimensions] = useState({ width: 0, height: 0 });
  const [templateLoading, setTemplateLoading] = useState(false);
  
  const canvasContainerRef = useRef(null);

  // Form states
  // const [uploadForm, setUploadForm] = useState({
  //   name: '',
  //   isDefault: false,
  //   file: null
  // }); // Not used currently
  
  const [fieldForm, setFieldForm] = useState({
    fieldType: '',
    label: '',
    x: 0.5,
    y: 0.5,
    fontSize: 18,
    fontFamily: 'Arial',
    fontColor: '#000000',
    fontWeight: 'normal',
    textAlign: 'center',
    rotation: 0,
    isVisible: true,
    customText: ''
  });

  // Use refs to avoid stale closures
  const dragStateRef = useRef({
    draggedField: null,
    isDragging: false,
    dragOffset: { x: 0, y: 0 }
  });

  // Update ref whenever state changes
  useEffect(() => {
    dragStateRef.current = {
      draggedField,
      isDragging,
      dragOffset
    };
  }, [draggedField, isDragging, dragOffset]);

  useEffect(() => {
    loadTemplates();
    loadFieldTypes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedTemplate) {
      loadFields(selectedTemplate.id);
      loadTemplateImage(selectedTemplate.id);
    }
    
    // Reset drag state when template changes
    setDraggedField(null);
    setIsDragging(false);
  }, [selectedTemplate]);

  const loadTemplates = async () => {
    try {
      const response = await axios.get('/api/certificate-templates');
      setTemplates(response.data);
      
      // Auto-select first template if available
      if (response.data.length > 0) {
        const firstTemplate = response.data[0];
        setSelectedTemplate(firstTemplate);
        await loadFields(firstTemplate.id);
        await loadTemplateImage(firstTemplate.id);
      } else {
        // No templates available - show helpful message
        setError('No certificate templates found. Please upload a template to get started.');
        setSelectedTemplate(null);
        setFields([]);
        setTemplateUrl(null);
      }
    } catch (error) {
      console.error('Error loading templates:', error);
      setError('Failed to load templates');
    } finally {
      setLoading(false);
    }
  };

  const loadFieldTypes = async () => {
    try {
      const response = await axios.get('/api/certificate-fields/types');
      setFieldTypes(response.data);
    } catch (error) {
      console.error('Error loading field types:', error);
    }
  };

  const loadFields = async (templateId) => {
    try {
      const response = await axios.get(`/api/certificate-fields/template/${templateId}`);
      setFields(response.data);
    } catch (error) {
      console.error('Error loading fields:', error);
      setError('Failed to load fields');
    }
  };

  const loadTemplateImage = async (templateId) => {
    try {
      // Set loading state and clear previous template URL and error
      setTemplateLoading(true);
      setTemplateUrl(null);
      setError(null);
      
      const response = await axios.get(`/api/certificate-templates/${templateId}/pdf`, {
        responseType: 'blob'
      });
      const imageBlob = new Blob([response.data]);
      const imageUrl = URL.createObjectURL(imageBlob);
      setTemplateUrl(imageUrl);
    } catch (error) {
      console.error('Error loading template image:', error);
      setTemplateUrl(null);
      
      // Provide more specific error messages with recovery options
      if (error.response?.status === 404) {
        const errorData = error.response?.data;
        
        // Handle ephemeral filesystem issue specifically
        if (errorData?.reason === 'ephemeral_filesystem') {
          setError(
            <div>
              <h4>Template File Lost Due to Server Restart</h4>
              <p>Your template file was lost because the hosting platform restarted the server. This can happen on platforms with ephemeral filesystems.</p>
              <p><strong>What happened:</strong> The server file system is temporary and gets reset during deployments or maintenance.</p>
              <p><strong>Solution:</strong> Please re-upload your template. Your template configuration is saved, only the image file needs to be uploaded again.</p>
              <p><strong>Future:</strong> We're working on implementing permanent cloud storage to prevent this issue.</p>
            </div>
          );
        } else if (errorData?.templateName) {
          setError(`Template "${errorData.templateName}" file not found on server. The template has been marked as inactive. Please re-upload the template to continue using it.`);
        } else {
          setError('Template image file not found. Please re-upload the template.');
        }
        
        // Automatically reload templates to update the list
        setTimeout(() => {
          loadTemplates();
        }, 1000);
      } else if (error.response?.status === 403) {
        setError('Access denied to template image.');
      } else {
        setError(`Failed to load template image: ${error.response?.data?.error || error.message}`);
      }
    } finally {
      setTemplateLoading(false);
    }
  };

  const handleTemplateUpload = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    
    try {
      await axios.post('/api/certificate-templates/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      
      setSuccess('Template uploaded successfully!');
      setShowTemplateUpload(false);
      await loadTemplates();
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      console.error('Error uploading template:', error);
      setError(error.response?.data?.error || 'Failed to upload template');
    }
  };

  const handleFieldSave = async (e) => {
    e.preventDefault();
    
    try {
      const fieldData = {
        ...fieldForm,
        templateId: selectedTemplate.id
      };
      
      if (selectedField) {
        await axios.put(`/api/certificate-fields/${selectedField.id}`, fieldData);
      } else {
        await axios.post(`/api/certificate-fields/template/${selectedTemplate.id}`, fieldData);
      }
      
      setSuccess('Field saved successfully!');
      setShowFieldModal(false);
      await loadFields(selectedTemplate.id);
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      console.error('Error saving field:', error);
      setError(error.response?.data?.error || 'Failed to save field');
    }
  };

  const handleFieldDelete = async (fieldId) => {
    if (window.confirm('Are you sure you want to delete this field?')) {
      try {
        await axios.delete(`/api/certificate-fields/${fieldId}`);
        setSuccess('Field deleted successfully!');
        await loadFields(selectedTemplate.id);
        
        // Clear success message after 3 seconds
        setTimeout(() => setSuccess(''), 3000);
      } catch (error) {
        console.error('Error deleting field:', error);
        setError('Failed to delete field');
      }
    }
  };

  const handleSetAsDefault = async (templateId) => {
    try {
      const template = templates.find(t => t.id === templateId);
      
      if (template.isDefault) {
        // If already default, confirm removal
        if (!window.confirm('This template is currently the default. Remove it as default?')) {
          return;
        }
      }
      
      await axios.put(`/api/certificate-templates/${templateId}`, {
        name: template.name,
        isDefault: !template.isDefault
      });
      
      setSuccess(`Template ${template.isDefault ? 'removed as' : 'set as'} default successfully!`);
      await loadTemplates();
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      console.error('Error setting template as default:', error);
      setError('Failed to update template default status');
    }
  };

  const handleTemplateDelete = async (templateId) => {
    try {
      const template = templates.find(t => t.id === templateId);
      
      if (!window.confirm(`Are you sure you want to delete the template "${template.name}"? This action cannot be undone.`)) {
        return;
      }
      
      await axios.delete(`/api/certificate-templates/${templateId}`);
      
      setSuccess(`Template "${template.name}" deleted successfully!`);
      
      // If deleted template was selected, clear selection
      if (selectedTemplate && selectedTemplate.id === templateId) {
        setSelectedTemplate(null);
        setFields([]);
        setTemplateUrl(null);
      }
      
      await loadTemplates();
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      console.error('Error deleting template:', error);
      const errorMessage = error.response?.data?.error || 'Failed to delete template';
      
      // Show specific error for templates in use
      if (error.response?.data?.certificateCount > 0) {
        setError(`Cannot delete template: It is being used by ${error.response.data.certificateCount} certificate(s). Archive it instead.`);
      } else {
        setError(errorMessage);
      }
    }
  };

  const handleTemplateArchive = async (templateId) => {
    try {
      const template = templates.find(t => t.id === templateId);
      
      if (!window.confirm(`Archive the template "${template.name}"? It will be hidden from the template list but can be restored later.`)) {
        return;
      }
      
      await axios.post(`/api/certificate-templates/${templateId}/archive`);
      
      setSuccess(`Template "${template.name}" archived successfully!`);
      
      // If archived template was selected, clear selection
      if (selectedTemplate && selectedTemplate.id === templateId) {
        setSelectedTemplate(null);
        setFields([]);
        setTemplateUrl(null);
      }
      
      await loadTemplates();
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      console.error('Error archiving template:', error);
      setError(error.response?.data?.error || 'Failed to archive template');
    }
  };

  const handleRegenerateCertificates = async (templateId = null, forceAll = false) => {
    try {
      const templateName = templateId ? 
        templates.find(t => t.id === templateId)?.name : 
        'all templates';
      
      const message = forceAll ? 
        `Are you sure you want to force regenerate ALL certificates${templateId ? ` using "${templateName}"` : ''}? This will recreate all certificates regardless of whether they need updating.` :
        `Are you sure you want to regenerate certificates${templateId ? ` using "${templateName}"` : ''}? Only certificates that need updating will be regenerated.`;
      
      if (!window.confirm(message)) {
        return;
      }
      
      setLoading(true);
      setError(null);
      
      const response = await axios.post('/api/certificates/regenerate', {
        templateId,
        forceAll
      });
      
      const result = response.data;
      setSuccess(`✅ Certificate regeneration completed!\n📊 ${result.regeneratedCount} regenerated, ${result.skippedCount} skipped${result.errorCount > 0 ? `, ${result.errorCount} errors` : ''}`);
      
      // Clear success message after 8 seconds
      setTimeout(() => setSuccess(''), 8000);
      
    } catch (error) {
      console.error('Error regenerating certificates:', error);
      setError(error.response?.data?.error || 'Failed to regenerate certificates');
    } finally {
      setLoading(false);
    }
  };

  // Debounced API update function
  const debouncedUpdateField = useCallback(
    debounce(async (fieldId, x, y) => {
      try {
        await axios.put(`/api/certificate-fields/${fieldId}`, { x, y });
      } catch (error) {
        console.error('Error updating field position:', error);
      }
    }, 500),
    []
  );

  // Improved drag start handler with simplified coordinates
  const handleFieldDragStart = (field, e) => {
    e.preventDefault();
    
    const clientX = e.clientX || (e.touches && e.touches[0].clientX);
    const clientY = e.clientY || (e.touches && e.touches[0].clientY);
    
    if (!clientX || !clientY) return;
    
    setDraggedField(field);
    setIsDragging(true);
    
    // Get the image element's bounding rect directly
    const imageElement = canvasContainerRef.current.querySelector('img');
    if (!imageElement) return;
    
    const imageRect = imageElement.getBoundingClientRect();
    
    // Calculate field's current absolute position relative to image
    // Use the actual image dimensions, not template dimensions
    const fieldX = (field.x * imageRect.width);
    const fieldY = (field.y * imageRect.height);
    
    // Calculate mouse offset from field position (relative to image)
    const offsetX = clientX - (imageRect.left + fieldX);
    const offsetY = clientY - (imageRect.top + fieldY);
    
    setDragOffset({
      x: offsetX,
      y: offsetY
    });
    
    // Store values in ref for event handlers
    dragStateRef.current = {
      draggedField: field,
      dragOffset: { x: offsetX, y: offsetY },
      isDragging: true
    };
    
    // Add event listeners
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd);
  };

  // Throttled mouse move handler
  const handleMouseMove = throttle((e) => {
    const { draggedField: currentDraggedField, isDragging: currentIsDragging } = dragStateRef.current;
    if (!currentDraggedField || !currentIsDragging) return;
    
    updateFieldPosition(e.clientX, e.clientY);
  }, 16); // ~60fps

  // Throttled touch move handler
  const handleTouchMove = throttle((e) => {
    const { draggedField: currentDraggedField, isDragging: currentIsDragging } = dragStateRef.current;
    if (!currentDraggedField || !currentIsDragging) return;
    
    e.preventDefault();
    const touch = e.touches[0];
    updateFieldPosition(touch.clientX, touch.clientY);
  }, 16); // ~60fps

  // Simplified position update logic
  const updateFieldPosition = (clientX, clientY) => {
    const { draggedField: currentDraggedField, dragOffset: currentDragOffset } = dragStateRef.current;
    if (!currentDraggedField || !templateDimensions.width || !templateDimensions.height) return;

    // Get the image element's bounding rect directly
    const imageElement = canvasContainerRef.current.querySelector('img');
    if (!imageElement) return;
    
    const imageRect = imageElement.getBoundingClientRect();
    
    // Calculate position relative to image - this gives us the pixel position within the image
    const imageX = clientX - imageRect.left - currentDragOffset.x;
    const imageY = clientY - imageRect.top - currentDragOffset.y;
    
    // Convert to relative coordinates (0-1) - these represent the CENTER of the text
    // The image dimensions should match the template dimensions
    const centerX = imageX / imageRect.width;
    const centerY = imageY / imageRect.height;

    // Constrain to image bounds
    const constrainedX = Math.max(0, Math.min(1, centerX));
    const constrainedY = Math.max(0, Math.min(1, centerY));

    setFields(prevFields => 
      prevFields.map(f => 
        f.id === currentDraggedField.id 
          ? { ...f, x: constrainedX, y: constrainedY }
          : f
      )
    );
  };

  // Mouse up handler
  const handleMouseUp = () => {
    const { draggedField: currentDraggedField, isDragging: currentIsDragging } = dragStateRef.current;
    
    if (currentDraggedField && currentIsDragging) {
      setFields(currentFields => {
        const updatedField = currentFields.find(f => f.id === currentDraggedField.id);
        if (updatedField) {
          debouncedUpdateField(currentDraggedField.id, updatedField.x, updatedField.y);
        }
        return currentFields;
      });
      
      setDraggedField(null);
      setIsDragging(false);
    }
    
    // Clean up event listeners
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  };

  // Touch end handler
  const handleTouchEnd = () => {
    const { draggedField: currentDraggedField, isDragging: currentIsDragging } = dragStateRef.current;
    
    if (currentDraggedField && currentIsDragging) {
      setFields(currentFields => {
        const updatedField = currentFields.find(f => f.id === currentDraggedField.id);
        if (updatedField) {
          debouncedUpdateField(currentDraggedField.id, updatedField.x, updatedField.y);
        }
        return currentFields;
      });
      
      setDraggedField(null);
      setIsDragging(false);
    }
    
    // Clean up event listeners
    document.removeEventListener('touchmove', handleTouchMove);
    document.removeEventListener('touchend', handleTouchEnd);
  };

  // Add escape key handler to cancel drag
  useEffect(() => {
    const handleEscapeKey = (e) => {
      if (e.key === 'Escape' && (draggedField || isDragging)) {
        setDraggedField(null);
        setIsDragging(false);
        // Clean up event listeners
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.removeEventListener('touchmove', handleTouchMove);
        document.removeEventListener('touchend', handleTouchEnd);
      }
    };

    document.addEventListener('keydown', handleEscapeKey);
    return () => {
      document.removeEventListener('keydown', handleEscapeKey);
    };
  }, [draggedField, isDragging]);

  // Clean up event listeners on unmount
  useEffect(() => {
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, []);

  const resetFieldForm = () => {
    setFieldForm({
      fieldType: '',
      label: '',
      x: 0.5,
      y: 0.5,
      fontSize: 18,
      fontFamily: 'Arial',
      fontColor: '#000000',
      fontWeight: 'normal',
      textAlign: 'center',
      rotation: 0,
      isVisible: true,
      customText: ''
    });
  };

  const openFieldModal = (field = null) => {
    if (field) {
      setSelectedField(field);
      setFieldForm({
        fieldType: field.fieldType,
        label: field.label,
        x: field.x,
        y: field.y,
        fontSize: field.fontSize,
        fontFamily: field.fontFamily,
        fontColor: field.fontColor,
        fontWeight: field.fontWeight,
        textAlign: field.textAlign,
        rotation: field.rotation,
        isVisible: field.isVisible,
        customText: field.customText || ''
      });
    } else {
      setSelectedField(null);
      resetFieldForm();
    }
    setShowFieldModal(true);
  };

  const getSampleText = (fieldType) => {
    const sampleData = {
      GYMNAST_NAME: 'John Doe',
      COACH_NAME: 'Jane Smith',
      DATE: 'January 15, 2024',
      LEVEL_NAME: 'Body Landings',
      LEVEL_NUMBER: '2',
      CLUB_NAME: 'Example Gymnastics Club',
      CUSTOM_TEXT: fieldForm.customText || 'Custom Text'
    };
    return sampleData[fieldType] || 'Sample Text';
  };



  if (loading) {
    return (
      <div className="certificate-designer">
        <div className="loading">Loading certificate designer...</div>
      </div>
    );
  }

  return (
    <div className={`certificate-designer ${isDragging ? 'dragging' : ''}`}>
      <div className="designer-header">
        <h1>Certificate Setup</h1>
        <div className="header-actions">
          <button 
            onClick={() => setShowTemplateUpload(true)}
            className="btn btn-primary"
          >
            Upload Template
          </button>
          <button 
            onClick={() => openFieldModal()}
            className="btn btn-secondary"
            disabled={!selectedTemplate}
          >
            Add Field
          </button>
        </div>
      </div>


      {/* Error display */}
      {error && (
        <div className="error-message">
          {typeof error === 'string' ? error : error}
        </div>
      )}
      {success && <div className="alert alert-success">{success}</div>}

      <div className="designer-layout">
        {/* Template Selection Sidebar */}
        <div className="sidebar">
          <h3>Templates</h3>
          <div className="template-list">
            {templates.length === 0 ? (
              <div className="no-templates">
                <p>No templates available</p>
                <p>Upload a template to get started</p>
                <button 
                  onClick={() => setShowTemplateUpload(true)}
                  className="btn btn-primary btn-sm"
                >
                  Upload Template
                </button>
              </div>
            ) : (
              templates.map(template => (
              <div
                key={template.id}
                className={`template-item ${selectedTemplate?.id === template.id ? 'selected' : ''}`}
              >
                <div 
                  className="template-main"
                  onClick={() => setSelectedTemplate(template)}
                >
                  <div className="template-name">{template.name}</div>
                  <div className="template-info">
                    {template.isDefault && <span className="badge">Default</span>}
                    <span className="file-size">{(template.fileSize / 1024).toFixed(1)}KB</span>
                  </div>
                </div>
                <div className="template-actions">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSetAsDefault(template.id);
                    }}
                    className={`btn btn-sm ${template.isDefault ? 'btn-warning' : 'btn-outline-primary'}`}
                    title={template.isDefault ? 'Remove as default' : 'Set as default'}
                  >
                    {template.isDefault ? '⭐' : '☆'}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleTemplateArchive(template.id);
                    }}
                    className="btn btn-sm btn-outline-secondary"
                    title="Archive template"
                  >
                    📦
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleTemplateDelete(template.id);
                    }}
                    className="btn btn-sm btn-outline-danger"
                    title="Delete template"
                  >
                    🗑️
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRegenerateCertificates(template.id, false);
                    }}
                    className="btn btn-sm btn-outline-success"
                    title="Regenerate certificates using this template"
                  >
                    🔄
                  </button>
                </div>
              </div>
              ))
            )}
          </div>

          {templates.length > 0 && (
            <div className="regenerate-section">
              <h3>Certificate Regeneration</h3>
              <div className="regenerate-actions">
                <button
                  onClick={() => handleRegenerateCertificates(null, false)}
                  className="btn btn-sm btn-outline-success"
                  title="Smart regeneration - only updates certificates that need it"
                >
                  🔄 Smart Regenerate All
                </button>
                <button
                  onClick={() => handleRegenerateCertificates(null, true)}
                  className="btn btn-sm btn-outline-warning"
                  title="Force regenerate all certificates"
                >
                  🔄 Force Regenerate All
                </button>
              </div>
              <div className="regenerate-help">
                <small>
                  <strong>Smart:</strong> Only updates certificates that need it<br/>
                  <strong>Force:</strong> Regenerates all certificates regardless
                </small>
              </div>
            </div>
          )}

          {selectedTemplate && (
            <div className="template-info-section">
              <h3>Template Info</h3>
              <div className="template-dimensions">
                <small>
                  Dimensions: {templateDimensions.width} × {templateDimensions.height}px<br/>
                  Scale Factor: {templateDimensions.width > 0 ? (templateDimensions.width / 1000).toFixed(2) : '1.00'}x
                </small>
              </div>
            </div>
          )}

          {selectedTemplate && (
            <div className="field-list">
              <h3>Fields</h3>
              {fields.map(field => (
                <div key={field.id} className="field-item">
                  <div className="field-info">
                    <span className="field-label">{field.label}</span>
                    <span className="field-type">{field.fieldType}</span>
                  </div>
                  <div className="field-actions">
                    <button 
                      onClick={() => openFieldModal(field)}
                      className="btn btn-sm btn-secondary"
                      title="Edit field"
                    >
                      ✏️
                    </button>
                    <button 
                      onClick={() => handleFieldDelete(field.id)}
                      className="btn btn-sm btn-danger"
                      title="Delete field"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Canvas Area */}
        <div className="canvas-container">
          <div className="template-canvas-wrapper" ref={canvasContainerRef}>
            {selectedTemplate && templateUrl ? (
              <div className="template-image-container">
                <div className="template-page-container">
                  <img
                    src={templateUrl}
                    alt="Certificate Template"
                    onLoad={(e) => {
                      const img = e.target;
                      setTemplateDimensions({
                        width: img.clientWidth,
                        height: img.clientHeight
                      });
                      // Clear any previous errors when image loads successfully
                      setError(null);
                    }}
                    onError={(e) => {
                      console.error('Template image failed to load:', e);
                      setError('Template image failed to display. The file may be corrupted or in an unsupported format.');
                      setTemplateUrl(null);
                      setTemplateDimensions({ width: 0, height: 0 });
                    }}
                    style={{ maxWidth: '100%', height: 'auto' }}
                  />
                  
                  {/* Field overlay positioned over the template image */}
                  <div className="field-overlay">
                    {fields.map(field => {
                      if (!field.isVisible) return null;
                      
                      // Calculate proportional font size for display
                      const referenceWidth = 1000;
                      
                      // Calculate display position - field.x and field.y represent the CENTER point for alignment
                      // Images are displayed at their natural size
                      const scaleFactor = templateDimensions.width / referenceWidth;
                      const scaledFontSize = Math.round(field.fontSize * scaleFactor);
                      
                      // Use template dimensions for positioning (should match image dimensions)
                      const centerX = field.x * templateDimensions.width;
                      const centerY = field.y * templateDimensions.height;
                      
                      // Position element to match backend exactly:
                      // - Backend uses textBaseline: 'middle' and textAlign for positioning
                      // - We need to position the div so its text renders at the same coordinates
                      let displayLeft = centerX;
                      let displayTop = centerY;
                      let transformX = '0%';
                      let transformY = '-50%'; // Always center vertically to match textBaseline: 'middle'
                      
                      // Adjust horizontal positioning based on text alignment
                      if (field.textAlign === 'left') {
                        transformX = '0%'; // Left edge at centerX
                      } else if (field.textAlign === 'right') {
                        transformX = '-100%'; // Right edge at centerX
                      } else {
                        transformX = '-50%'; // Center at centerX (default)
                      }
                      
                      return (
                        <div
                          key={field.id}
                          className={`field-element ${draggedField?.id === field.id ? 'dragging' : ''} ${selectedField?.id === field.id ? 'selected' : ''}`}
                          style={{
                            left: `${displayLeft}px`,
                            top: `${displayTop}px`,
                            fontSize: `${scaledFontSize}px`,
                            fontFamily: field.fontFamily,
                            color: field.fontColor,
                            fontWeight: field.fontWeight,
                            textAlign: field.textAlign,
                            // Position to match backend: center both horizontally and vertically at the stored coordinates
                            transform: `translate(${transformX}, ${transformY}) rotate(${field.rotation}deg)`,
                            transformOrigin: 'center center'
                          }}
                          onMouseDown={(e) => handleFieldDragStart(field, e)}
                          onTouchStart={(e) => handleFieldDragStart(field, e)}
                          onClick={() => {
                            setSelectedField(field);
                          }}
                        >
                          {/* Anchor marker - shows exact center point */}
                          <div className="anchor-marker" style={{
                            position: 'absolute',
                            left: '50%',
                            top: '50%',
                            width: '12px',
                            height: '12px',
                            transform: 'translate(-50%, -50%)',
                            pointerEvents: 'none',
                            zIndex: 1000
                          }}>
                            <div style={{
                              position: 'absolute',
                              left: '50%',
                              top: '0',
                              width: '1px',
                              height: '12px',
                              backgroundColor: '#ff0000',
                              transform: 'translateX(-50%)'
                            }}></div>
                            <div style={{
                              position: 'absolute',
                              left: '0',
                              top: '50%',
                              width: '12px',
                              height: '1px',
                              backgroundColor: '#ff0000',
                              transform: 'translateY(-50%)'
                            }}></div>
                            <div style={{
                              position: 'absolute',
                              left: '50%',
                              top: '50%',
                              width: '3px',
                              height: '3px',
                              backgroundColor: '#ff0000',
                              borderRadius: '50%',
                              transform: 'translate(-50%, -50%)'
                            }}></div>
                          </div>
                          {getSampleText(field.fieldType)}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : selectedTemplate ? (
              templateLoading ? (
                <div className="template-loading">
                  <div className="loading-spinner"></div>
                  <p>Loading template image...</p>
                </div>
              ) : (
                <div className="no-template">
                  <p>Template selected but image failed to load</p>
                  <button 
                    onClick={() => loadTemplateImage(selectedTemplate.id)}
                    className="btn btn-secondary"
                  >
                    Retry Loading
                  </button>
                </div>
              )
            ) : (
              <div className="no-template">
                <p>Select a template to begin designing</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Template Upload Modal */}
      {showTemplateUpload && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2>Upload Certificate Template</h2>
              <button 
                onClick={() => setShowTemplateUpload(false)}
                className="btn btn-close"
              >
                ×
              </button>
            </div>
            <form onSubmit={handleTemplateUpload}>
              <div className="form-group">
                <label>Template Name</label>
                <input
                  type="text"
                  name="name"
                  required
                />
              </div>
              <div className="form-group">
                <label>Template Image (PNG or JPEG)</label>
                <input
                  type="file"
                  name="template"
                  accept=".png,.jpg,.jpeg,image/png,image/jpeg"
                  required
                  onChange={(e) => {
                    const file = e.target.files[0];
                    if (file) {
                      // Basic validation
                      if (file.size > 10 * 1024 * 1024) {
                        setError('File size must be less than 10MB');
                        e.target.value = '';
                        return;
                      }
                      
                      // Check file type
                      const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg'];
                      if (!allowedTypes.includes(file.type)) {
                        setError('Please select a PNG or JPEG image file');
                        e.target.value = '';
                        return;
                      }
                      
                      // Clear any previous errors
                      setError(null);
                    }
                  }}
                />
                <small className="help-text">
                  Upload a PNG or JPEG image of your certificate template. For best results, use high resolution images (300 DPI or higher). Maximum file size: 10MB.
                </small>
              </div>
              <div className="form-group">
                <label>
                  <input
                    type="checkbox"
                    name="isDefault"
                  />
                  Set as default template
                </label>
              </div>
              <div className="modal-actions">
                <button type="submit" className="btn btn-primary">Upload</button>
                <button 
                  type="button" 
                  onClick={() => setShowTemplateUpload(false)}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Field Modal */}
      {showFieldModal && (
        <div className="modal-overlay">
          <div className="modal modal-large">
            <div className="modal-header">
              <h2>{selectedField ? 'Edit Field' : 'Add Field'}</h2>
              <button 
                onClick={() => setShowFieldModal(false)}
                className="btn btn-close"
              >
                ×
              </button>
            </div>
            <form onSubmit={handleFieldSave}>
              <div className="form-row">
                <div className="form-group">
                  <label>Field Type</label>
                  <select
                    value={fieldForm.fieldType}
                    onChange={(e) => setFieldForm({...fieldForm, fieldType: e.target.value})}
                    required
                    disabled={!!selectedField}
                  >
                    <option value="">Select field type</option>
                    {fieldTypes.map(type => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Label</label>
                  <input
                    type="text"
                    value={fieldForm.label}
                    onChange={(e) => setFieldForm({...fieldForm, label: e.target.value})}
                    required
                  />
                </div>
              </div>

              {fieldForm.fieldType === 'CUSTOM_TEXT' && (
                <div className="form-group">
                  <label>Custom Text</label>
                  <input
                    type="text"
                    value={fieldForm.customText}
                    onChange={(e) => setFieldForm({...fieldForm, customText: e.target.value})}
                    required
                  />
                </div>
              )}

              <div className="form-row">
                <div className="form-group">
                  <label>Font Size</label>
                  <input
                    type="number"
                    value={fieldForm.fontSize}
                    onChange={(e) => setFieldForm({...fieldForm, fontSize: parseInt(e.target.value)})}
                    min="8"
                    max="72"
                  />
                  <small className="help-text">
                    Font size scales proportionally based on template dimensions (reference: 1000px width)
                  </small>
                </div>
                <div className="form-group">
                  <label>Font Family</label>
                  <select
                    value={fieldForm.fontFamily}
                    onChange={(e) => setFieldForm({...fieldForm, fontFamily: e.target.value})}
                  >
                    <option value="Arial">Arial</option>
                    <option value="Helvetica">Helvetica</option>
                    <option value="Times">Times</option>
                    <option value="Courier">Courier</option>
                    <option value="Lilita One">Lilita One</option>
                  </select>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Font Color</label>
                  <input
                    type="color"
                    value={fieldForm.fontColor}
                    onChange={(e) => setFieldForm({...fieldForm, fontColor: e.target.value})}
                  />
                </div>
                <div className="form-group">
                  <label>Font Weight</label>
                  <select
                    value={fieldForm.fontWeight}
                    onChange={(e) => setFieldForm({...fieldForm, fontWeight: e.target.value})}
                  >
                    <option value="normal">Normal</option>
                    <option value="bold">Bold</option>
                  </select>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Text Align</label>
                  <select
                    value={fieldForm.textAlign}
                    onChange={(e) => setFieldForm({...fieldForm, textAlign: e.target.value})}
                  >
                    <option value="left">Left</option>
                    <option value="center">Center</option>
                    <option value="right">Right</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Rotation (degrees)</label>
                  <input
                    type="number"
                    value={fieldForm.rotation}
                    onChange={(e) => setFieldForm({...fieldForm, rotation: parseFloat(e.target.value)})}
                    min="-180"
                    max="180"
                  />
                </div>
              </div>

              <div className="form-group">
                <label>
                  <input
                    type="checkbox"
                    checked={fieldForm.isVisible}
                    onChange={(e) => setFieldForm({...fieldForm, isVisible: e.target.checked})}
                  />
                  Visible
                </label>
              </div>

              <div className="modal-actions">
                <button type="submit" className="btn btn-primary">
                  {selectedField ? 'Update' : 'Add'} Field
                </button>
                <button 
                  type="button" 
                  onClick={() => setShowFieldModal(false)}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CertificateDesigner; 