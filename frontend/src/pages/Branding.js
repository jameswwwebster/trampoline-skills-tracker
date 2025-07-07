import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { useBranding } from '../contexts/BrandingContext';

const Branding = () => {
  const { user } = useAuth();
  const { updateBranding } = useBranding();
  const [branding, setBranding] = useState({
    primaryColor: '#2c3e50',
    secondaryColor: '#3498db',
    accentColor: '#d4af37',
    backgroundColor: '#f8f9fa',
    textColor: '#212529',
    logoUrl: '',
    fontFamily: '',
    website: '',
    description: ''
  });
  const [presets, setPresets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    fetchBranding();
    fetchPresets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchBranding = async () => {
    try {
      const response = await axios.get('/api/branding');
      const brandingData = { ...branding, ...response.data };
      setBranding(brandingData);
      updateBranding(brandingData);
    } catch (err) {
      console.error('Failed to fetch branding:', err);
      setError('Failed to load branding settings');
    }
  };

  const fetchPresets = async () => {
    try {
      const response = await axios.get('/api/branding/presets');
      setPresets(response.data);
    } catch (err) {
      console.error('Failed to fetch presets:', err);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    const newBranding = { ...branding, [name]: value };
    setBranding(newBranding);
    updateBranding(newBranding);
  };

  const handleColorChange = (colorName, value) => {
    const newBranding = { ...branding, [colorName]: value };
    setBranding(newBranding);
    updateBranding(newBranding);
  };

  const applyPreset = (preset) => {
    const newBranding = {
      ...branding,
      primaryColor: preset.primaryColor,
      secondaryColor: preset.secondaryColor,
      accentColor: preset.accentColor,
      backgroundColor: preset.backgroundColor,
      textColor: preset.textColor
    };
    setBranding(newBranding);
    updateBranding(newBranding);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      // Only send the fields that are allowed by the backend validation
      const updateData = {
        primaryColor: branding.primaryColor || null,
        secondaryColor: branding.secondaryColor || null,
        accentColor: branding.accentColor || null,
        backgroundColor: branding.backgroundColor || null,
        textColor: branding.textColor || null,
        logoUrl: branding.logoUrl || '',
        fontFamily: branding.fontFamily || '',
        website: branding.website || '',
        description: branding.description || ''
      };

      console.log('Sending branding update:', updateData);
      const response = await axios.put('/api/branding', updateData);
      const updatedBranding = { ...branding, ...response.data };
      setBranding(updatedBranding);
      updateBranding(updatedBranding);
      setSuccess('Branding settings updated successfully!');
      
      // Clear success message after 5 seconds
      setTimeout(() => setSuccess(''), 5000);
    } catch (err) {
      console.error('Failed to update branding:', err);
      setError(err.response?.data?.error || 'Failed to update branding settings');
    } finally {
      setLoading(false);
    }
  };

  const resetToDefaults = () => {
    setBranding({
      primaryColor: '#2c3e50',
      secondaryColor: '#3498db',
      accentColor: '#d4af37',
      backgroundColor: '#f8f9fa',
      textColor: '#212529',
      logoUrl: branding.logoUrl,
      fontFamily: '',
      website: branding.website,
      description: branding.description
    });
  };

  if (!user || user.role !== 'CLUB_ADMIN') {
    return (
      <div className="container mt-4">
        <div className="alert alert-warning">
          <h4>Access Denied</h4>
          <p>Only club administrators can access branding settings.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mt-4">
      <div className="row">
        <div className="col-md-8">
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">🎨 Club Branding</h3>
              <p className="text-muted mb-0">Customize your club's visual appearance</p>
            </div>
            <div className="card-body">
              {success && (
                <div className="alert alert-success alert-dismissible fade show" role="alert">
                  {success}
                  <button type="button" className="btn-close" onClick={() => setSuccess('')}></button>
                </div>
              )}
              
              {error && (
                <div className="alert alert-danger alert-dismissible fade show" role="alert">
                  {error}
                  <button type="button" className="btn-close" onClick={() => setError('')}></button>
                </div>
              )}

              <form onSubmit={handleSubmit}>
                {/* Color Settings */}
                <div className="mb-4">
                  <h5>Color Scheme</h5>
                  <div className="row">
                    <div className="col-md-6 mb-3">
                      <label className="form-label">Primary Color</label>
                      <div className="input-group">
                        <input
                          type="color"
                          className="form-control form-control-color"
                          value={branding.primaryColor || '#2c3e50'}
                          onChange={(e) => handleColorChange('primaryColor', e.target.value)}
                        />
                        <input
                          type="text"
                          className="form-control"
                          value={branding.primaryColor || '#2c3e50'}
                          onChange={(e) => handleColorChange('primaryColor', e.target.value)}
                          placeholder="#2c3e50"
                        />
                      </div>
                    </div>
                    <div className="col-md-6 mb-3">
                      <label className="form-label">Secondary Color</label>
                      <div className="input-group">
                        <input
                          type="color"
                          className="form-control form-control-color"
                          value={branding.secondaryColor || '#3498db'}
                          onChange={(e) => handleColorChange('secondaryColor', e.target.value)}
                        />
                        <input
                          type="text"
                          className="form-control"
                          value={branding.secondaryColor || '#3498db'}
                          onChange={(e) => handleColorChange('secondaryColor', e.target.value)}
                          placeholder="#3498db"
                        />
                      </div>
                    </div>
                    <div className="col-md-6 mb-3">
                      <label className="form-label">Accent Color</label>
                      <div className="input-group">
                        <input
                          type="color"
                          className="form-control form-control-color"
                          value={branding.accentColor || '#d4af37'}
                          onChange={(e) => handleColorChange('accentColor', e.target.value)}
                        />
                        <input
                          type="text"
                          className="form-control"
                          value={branding.accentColor || '#d4af37'}
                          onChange={(e) => handleColorChange('accentColor', e.target.value)}
                          placeholder="#d4af37"
                        />
                      </div>
                    </div>
                    <div className="col-md-6 mb-3">
                      <label className="form-label">Background Color</label>
                      <div className="input-group">
                        <input
                          type="color"
                          className="form-control form-control-color"
                          value={branding.backgroundColor || '#f8f9fa'}
                          onChange={(e) => handleColorChange('backgroundColor', e.target.value)}
                        />
                        <input
                          type="text"
                          className="form-control"
                          value={branding.backgroundColor || '#f8f9fa'}
                          onChange={(e) => handleColorChange('backgroundColor', e.target.value)}
                          placeholder="#f8f9fa"
                        />
                      </div>
                    </div>
                    <div className="col-md-6 mb-3">
                      <label className="form-label">Text Color</label>
                      <div className="input-group">
                        <input
                          type="color"
                          className="form-control form-control-color"
                          value={branding.textColor || '#212529'}
                          onChange={(e) => handleColorChange('textColor', e.target.value)}
                        />
                        <input
                          type="text"
                          className="form-control"
                          value={branding.textColor || '#212529'}
                          onChange={(e) => handleColorChange('textColor', e.target.value)}
                          placeholder="#212529"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Logo and Typography */}
                <div className="mb-4">
                  <h5>Logo & Typography</h5>
                  <div className="row">
                    <div className="col-md-6 mb-3">
                      <label className="form-label">Logo URL</label>
                      <input
                        type="url"
                        className="form-control"
                        name="logoUrl"
                        value={branding.logoUrl || ''}
                        onChange={handleInputChange}
                        placeholder="https://example.com/logo.png"
                      />
                    </div>
                    <div className="col-md-6 mb-3">
                      <label className="form-label">Font Family</label>
                                             <select
                         className="form-control"
                         name="fontFamily"
                         value={branding.fontFamily || ''}
                         onChange={handleInputChange}
                       >
                         <option value="">Default (System)</option>
                         <option value="'Lilita One', sans-serif">Lilita One (Bold & Playful)</option>
                         <option value="Arial, sans-serif">Arial (Clean & Simple)</option>
                         <option value="Helvetica, sans-serif">Helvetica (Modern)</option>
                         <option value="'Open Sans', sans-serif">Open Sans (Friendly)</option>
                         <option value="'Roboto', sans-serif">Roboto (Professional)</option>
                         <option value="'Montserrat', sans-serif">Montserrat (Elegant)</option>
                         <option value="'Poppins', sans-serif">Poppins (Rounded)</option>
                         <option value="Georgia, serif">Georgia (Classic Serif)</option>
                         <option value="'Times New Roman', serif">Times New Roman (Traditional)</option>
                         <option value="'Playfair Display', serif">Playfair Display (Elegant Serif)</option>
                         <option value="'Source Code Pro', monospace">Source Code Pro (Monospace)</option>
                         <option value="'Courier New', monospace">Courier New (Typewriter)</option>
                         <option value="Verdana, sans-serif">Verdana (Web Safe)</option>
                         <option value="'Trebuchet MS', sans-serif">Trebuchet MS (Humanist)</option>
                       </select>
                    </div>
                  </div>
                </div>

                {/* Club Information */}
                <div className="mb-4">
                  <h5>Club Information</h5>
                  <div className="row">
                    <div className="col-md-6 mb-3">
                      <label className="form-label">Website</label>
                      <input
                        type="url"
                        className="form-control"
                        name="website"
                        value={branding.website || ''}
                        onChange={handleInputChange}
                        placeholder="https://yourclub.com"
                      />
                    </div>
                    <div className="col-md-12 mb-3">
                      <label className="form-label">Description</label>
                      <textarea
                        className="form-control"
                        name="description"
                        value={branding.description || ''}
                        onChange={handleInputChange}
                        rows="3"
                        placeholder="Brief description of your club..."
                        maxLength="500"
                      />
                      <div className="form-text">
                        {branding.description?.length || 0}/500 characters
                      </div>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="d-flex justify-content-between">
                  <button
                    type="button"
                    className="btn btn-outline-secondary"
                    onClick={resetToDefaults}
                  >
                    Reset to Defaults
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={loading}
                  >
                    {loading ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>

        {/* Preview and Presets */}
        <div className="col-md-4">
          {/* Live Preview */}
          <div className="card mb-4">
            <div className="card-header">
              <h5>Live Preview</h5>
            </div>
            <div className="card-body p-0">
              <div className="brand-preview" style={{ 
                backgroundColor: branding.backgroundColor,
                color: branding.textColor,
                fontFamily: branding.fontFamily || 'inherit'
              }}>
                {/* Header Preview */}
                <div className="preview-header" style={{ backgroundColor: branding.primaryColor }}>
                  <div className="preview-logo" style={{ color: '#ffffff' }}>
                    {branding.logoUrl ? (
                      <img src={branding.logoUrl} alt="Logo" style={{ height: '30px', maxWidth: '120px' }} />
                    ) : (
                      <span style={{ fontWeight: 'bold' }}>Your Club Logo</span>
                    )}
                  </div>
                  <div className="preview-nav">
                    <span style={{ color: '#ffffff', opacity: 0.9 }}>Dashboard</span>
                    <span style={{ color: '#ffffff', opacity: 0.7 }}>Gymnasts</span>
                  </div>
                </div>
                
                {/* Content Preview */}
                <div className="preview-content">
                  <div className="preview-card">
                    <div className="preview-card-header" style={{ 
                      backgroundColor: branding.secondaryColor, 
                      color: '#ffffff' 
                    }}>
                      <h6 style={{ margin: 0, fontWeight: 'bold' }}>Sample Card</h6>
                    </div>
                    <div className="preview-card-body">
                      <p style={{ margin: '8px 0', fontSize: '14px' }}>
                        This is how your content will look with the selected colors.
                      </p>
                      <button 
                        className="preview-button" 
                        style={{ 
                          backgroundColor: branding.accentColor,
                          color: '#ffffff',
                          border: 'none',
                          padding: '6px 12px',
                          borderRadius: '4px',
                          fontSize: '12px',
                          fontWeight: 'bold'
                        }}
                      >
                        Action Button
                      </button>
                    </div>
                  </div>
                  
                  <div className="preview-text-samples">
                    <h6 style={{ color: branding.primaryColor, margin: '12px 0 8px' }}>
                      Heading Text
                    </h6>
                    <p style={{ margin: '4px 0', fontSize: '13px' }}>
                      Regular paragraph text using your selected font and colors.
                    </p>
                    <small style={{ color: branding.textColor, opacity: 0.7 }}>
                      Secondary text information
                    </small>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          {/* Color Swatches */}
          <div className="card mb-4">
            <div className="card-header">
              <h5>Color Palette</h5>
            </div>
            <div className="card-body">
              <div className="color-preview-grid">
                <div className="color-preview-item">
                  <div 
                    className="color-swatch" 
                    style={{ backgroundColor: branding.primaryColor }}
                  ></div>
                  <small>Primary</small>
                  <tiny style={{ fontSize: '10px', color: '#666' }}>
                    {branding.primaryColor}
                  </tiny>
                </div>
                <div className="color-preview-item">
                  <div 
                    className="color-swatch" 
                    style={{ backgroundColor: branding.secondaryColor }}
                  ></div>
                  <small>Secondary</small>
                  <tiny style={{ fontSize: '10px', color: '#666' }}>
                    {branding.secondaryColor}
                  </tiny>
                </div>
                <div className="color-preview-item">
                  <div 
                    className="color-swatch" 
                    style={{ backgroundColor: branding.accentColor }}
                  ></div>
                  <small>Accent</small>
                  <tiny style={{ fontSize: '10px', color: '#666' }}>
                    {branding.accentColor}
                  </tiny>
                </div>
                <div className="color-preview-item">
                  <div 
                    className="color-swatch" 
                    style={{ backgroundColor: branding.backgroundColor }}
                  ></div>
                  <small>Background</small>
                  <tiny style={{ fontSize: '10px', color: '#666' }}>
                    {branding.backgroundColor}
                  </tiny>
                </div>
                <div className="color-preview-item">
                  <div 
                    className="color-swatch" 
                    style={{ backgroundColor: branding.textColor }}
                  ></div>
                  <small>Text</small>
                  <tiny style={{ fontSize: '10px', color: '#666' }}>
                    {branding.textColor}
                  </tiny>
                </div>
              </div>
            </div>
          </div>

          {/* Color Presets */}
          <div className="card">
            <div className="card-header">
              <h5>Color Presets</h5>
            </div>
            <div className="card-body">
              {presets.map((preset, index) => (
                <div key={index} className="preset-item mb-3">
                  <div className="d-flex justify-content-between align-items-center">
                    <div>
                      <strong>{preset.name}</strong>
                      <div className="preset-colors">
                        <span 
                          className="color-dot" 
                          style={{ backgroundColor: preset.primaryColor }}
                        ></span>
                        <span 
                          className="color-dot" 
                          style={{ backgroundColor: preset.secondaryColor }}
                        ></span>
                        <span 
                          className="color-dot" 
                          style={{ backgroundColor: preset.accentColor }}
                        ></span>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-primary"
                      onClick={() => applyPreset(preset)}
                    >
                      Apply
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .brand-preview {
          border-radius: 8px;
          overflow: hidden;
          border: 1px solid #dee2e6;
          min-height: 200px;
        }
        
        .preview-header {
          padding: 12px 16px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 1px solid rgba(255,255,255,0.2);
        }
        
        .preview-logo {
          font-size: 16px;
          font-weight: bold;
        }
        
        .preview-nav {
          display: flex;
          gap: 16px;
          font-size: 14px;
        }
        
        .preview-content {
          padding: 16px;
        }
        
        .preview-card {
          border: 1px solid #dee2e6;
          border-radius: 6px;
          overflow: hidden;
          margin-bottom: 16px;
        }
        
        .preview-card-header {
          padding: 8px 12px;
          font-size: 14px;
        }
        
        .preview-card-body {
          padding: 12px;
        }
        
        .preview-text-samples {
          margin-top: 8px;
        }
        
        .color-preview-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(60px, 1fr));
          gap: 10px;
        }
        
        .color-preview-item {
          text-align: center;
        }
        
        .color-swatch {
          width: 40px;
          height: 40px;
          border-radius: 6px;
          border: 2px solid #dee2e6;
          margin: 0 auto 4px;
        }
        
        .preset-colors {
          display: flex;
          gap: 5px;
          margin-top: 5px;
        }
        
        .color-dot {
          width: 20px;
          height: 20px;
          border-radius: 50%;
          border: 1px solid #dee2e6;
          display: inline-block;
        }
        
        .preset-item {
          padding: 10px;
          border: 1px solid #dee2e6;
          border-radius: 8px;
          background-color: #f8f9fa;
        }
        
        .form-control-color {
          max-width: 60px;
        }

      `}</style>
    </div>
  );
};

export default Branding; 