import React, { useState, useEffect } from 'react';
import axios from 'axios';
import apiClient from '../utils/apiInterceptor';
import { useAuth } from '../contexts/AuthContext';

const ImportGymnasts = () => {
  const [file, setFile] = useState(null);
  const [previewData, setPreviewData] = useState(null);
  const [customFields, setCustomFields] = useState([]);
  const [importResult, setImportResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [duplicates, setDuplicates] = useState(null);
  const [showDuplicates, setShowDuplicates] = useState(false);
  const [importOptions, setImportOptions] = useState({
    importNonGymnasts: true,
    updateExisting: true  // Default to true for upsert behavior
  });

  const { isClubAdmin } = useAuth();

  // Fetch custom fields on component mount
  useEffect(() => {
    const fetchCustomFields = async () => {
      try {
        const response = await apiClient.get('/api/user-custom-fields');
        setCustomFields(response.data);
      } catch (error) {
        console.error('Failed to fetch custom fields:', error);
      }
    };

    if (isClubAdmin) {
      fetchCustomFields();
    }
  }, [isClubAdmin]);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      if (selectedFile.type === 'text/csv' || selectedFile.name.endsWith('.csv')) {
        setFile(selectedFile);
        setPreviewData(null);
        setImportResult(null);
        setError(null);
        setSuccess(null);
      } else {
        setError('Please select a CSV file');
        setFile(null);
      }
    }
  };

  const handlePreview = async () => {
    if (!file) {
      setError('Please select a CSV file first');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const formData = new FormData();
      formData.append('csvFile', file);

      const response = await axios.post('/api/import/preview', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      setPreviewData(response.data);
      const { validRows, updateRows, skippedRows, errorRows, customFieldsRows } = response.data;
      let message = `Preview loaded: ${validRows} new records, ${updateRows || 0} updates`;
      if (customFieldsRows > 0) {
        message += `, ${customFieldsRows} with custom fields`;
      }
      if (skippedRows > 0) {
        message += `, ${skippedRows} skipped`;
      }
      if (errorRows > 0) {
        message += `, ${errorRows} errors`;
      }
      setSuccess(message);
    } catch (error) {
      setError(error.response?.data?.error || 'Failed to preview CSV file');
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    if (!file) {
      setError('Please select a CSV file first');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const formData = new FormData();
      formData.append('csvFile', file);
      formData.append('importOptions', JSON.stringify(importOptions));

      const response = await axios.post('/api/import/gymnasts', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      setImportResult(response.data);
      const { summary } = response.data;
      let message = `Import completed: ${summary.created || 0} created, ${summary.updated || 0} updated`;
      if (summary.customFieldsProcessed > 0) {
        message += `, ${summary.customFieldsProcessed} with custom fields`;
      }
      if (summary.skipped > 0) {
        message += `, ${summary.skipped} skipped`;
      }
      if (summary.errors > 0) {
        message += `, ${summary.errors} errors`;
      }
      setSuccess(message);
      
      // Clear the file input after successful import
      setFile(null);
      setPreviewData(null);
      document.getElementById('csvFile').value = '';
    } catch (error) {
      setError(error.response?.data?.error || 'Failed to import CSV file');
    } finally {
      setLoading(false);
    }
  };

  const checkDuplicates = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await apiClient.get('/api/import/duplicates');
      setDuplicates(response.data);
      setShowDuplicates(true);
    } catch (error) {
      setError(error.response?.data?.error || 'Failed to check for duplicates');
    } finally {
      setLoading(false);
    }
  };

  if (!isClubAdmin) {
    return (
      <div className="alert alert-error">
        Access denied. This page is only available for club administrators.
      </div>
    );
  }

  return (
    <div>
      <div className="flex-between">
        <h1>Import Gymnasts</h1>
      </div>

      <div className="info-message">
        <p>Import gymnasts from British Gymnastics CSV export files</p>
        <p><strong>Expected format:</strong> MID, First Name, Last Name, Email, Phone No, Date Of Birth, Age, Organisation, Roles, Memberships</p>
        <p><strong>Custom Fields:</strong> Include any custom field columns in your CSV. Column names are matched case-insensitively to your custom field name or key.</p>
        <p><strong>Note:</strong> Date Of Birth is optional. If provided, it should be in MM/DD/YYYY, DD/MM/YYYY, or YYYY-MM-DD format.</p>
        <p><strong>Update mode:</strong> When enabled, import will create new records or update existing ones based on matching name/email.</p>
      </div>

      {error && (
        <div className="alert alert-error">
          {error}
        </div>
      )}

      {success && (
        <div className="alert alert-success">
          {success}
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Select CSV File</h3>
        </div>
        <div className="card-body">
          <div className="form-group">
            <label htmlFor="csvFile">CSV File</label>
            <input
              type="file"
              id="csvFile"
              accept=".csv"
              onChange={handleFileChange}
              className="form-control"
            />
            <small className="form-text text-muted">
              Select a CSV file exported from British Gymnastics system
            </small>
          </div>

          {file && (
            <div className="file-info">
              <p><strong>Selected file:</strong> {file.name}</p>
              <p><strong>Size:</strong> {(file.size / 1024).toFixed(2)} KB</p>
            </div>
          )}

          <div className="form-group">
            <h4>Import Options</h4>
            <div className="checkbox-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={importOptions.importNonGymnasts}
                  onChange={(e) => setImportOptions(prev => ({
                    ...prev,
                    importNonGymnasts: e.target.checked
                  }))}
                />
                Import all records (includes coaches, administrators, etc.)
              </label>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={importOptions.updateExisting}
                  onChange={(e) => setImportOptions(prev => ({
                    ...prev,
                    updateExisting: e.target.checked
                  }))}
                />
                Update existing records (create new or update existing)
              </label>
            </div>
          </div>

          <div className="button-group">
            <button
              onClick={handlePreview}
              disabled={!file || loading}
              className="btn btn-secondary"
            >
              {loading ? 'Loading...' : 'Preview'}
            </button>
            <button
              onClick={handleImport}
              disabled={!file || loading}
              className="btn btn-primary"
            >
              {loading ? 'Importing...' : 'Import'}
            </button>
            <button
              onClick={checkDuplicates}
              disabled={loading}
              className="btn btn-warning"
            >
              {loading ? 'Checking...' : 'Check Duplicates'}
            </button>
          </div>
        </div>
      </div>

      {previewData && (
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Preview Results</h3>
          </div>
          <div className="card-body">
            <div className="stats-grid">
              <div className="stat-item">
                <div className="stat-value">{previewData.totalRows}</div>
                <div className="stat-label">Total Rows</div>
              </div>
              <div className="stat-item">
                <div className="stat-value">{previewData.validRows}</div>
                <div className="stat-label">New Records</div>
              </div>
              <div className="stat-item">
                <div className="stat-value">{previewData.updateRows || 0}</div>
                <div className="stat-label">Updates</div>
              </div>
              <div className="stat-item">
                <div className="stat-value">{previewData.customFieldsRows || 0}</div>
                <div className="stat-label">With Custom Fields</div>
              </div>
              <div className="stat-item">
                <div className="stat-value">{previewData.skippedRows}</div>
                <div className="stat-label">Skipped Rows</div>
              </div>
              <div className="stat-item">
                <div className="stat-value">{previewData.errorRows}</div>
                <div className="stat-label">Error Rows</div>
              </div>
            </div>

            {customFields.length > 0 && (
              <div className="custom-fields-mapping">
                <h4>Custom Field Mappings</h4>
                <div className="mapping-info">
                  <p><small>The following custom fields will be populated from matching CSV columns:</small></p>
                  <div className="mapping-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.5rem', marginTop: '0.5rem' }}>
                    {customFields.map(field => (
                      <div key={field.id} className="mapping-item" style={{ padding: '0.5rem', border: '1px solid #ddd', borderRadius: '4px', fontSize: '0.875rem' }}>
                        <strong>{field.name}</strong><br />
                        <small>CSV Column: "{field.key}" or "{field.name}"</small><br />
                        <small>Type: {field.fieldType}</small>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {previewData.data && previewData.data.length > 0 && (
              <div className="preview-table">
                <h4>Sample Data (first 10 rows)</h4>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Line</th>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Age</th>
                      <th>Date of Birth</th>
                      <th>Is Gymnast</th>
                      {customFields.length > 0 && <th>Custom Fields</th>}
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewData.data.slice(0, 10).map((row, index) => (
                      <tr key={index}>
                        <td>{row.line}</td>
                        <td>{row.firstName} {row.lastName}</td>
                        <td>{row.email || '-'}</td>
                        <td>{row.age}</td>
                        <td>{new Date(row.dateOfBirth).toLocaleDateString()}</td>
                        <td>
                          <span className={`badge ${row.isGymnast ? 'badge-success' : 'badge-secondary'}`}>
                            {row.isGymnast ? 'Yes' : 'No'}
                          </span>
                        </td>
                        {customFields.length > 0 && (
                          <td>
                            <div style={{ fontSize: '0.875rem' }}>
                              {customFields.map(field => {
                                const fieldValue = row.customFieldValues && row.customFieldValues[field.id];
                                return (
                                  <div key={field.id} style={{ marginBottom: '0.25rem' }}>
                                    <small style={{ fontWeight: 'bold' }}>{field.name}:</small>{' '}
                                    <small>{fieldValue || '-'}</small>
                                  </div>
                                );
                              })}
                            </div>
                          </td>
                        )}
                        <td>
                          <span className={`badge ${row.action === 'CREATE' ? 'badge-primary' : 'badge-warning'}`}>
                            {row.action}
                          </span>
                          {row.reason && (
                            <small className="text-muted d-block">{row.reason}</small>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {previewData.errors && previewData.errors.length > 0 && (
              <div className="errors-section">
                <h4>Errors</h4>
                <div className="error-list">
                  {previewData.errors.slice(0, 5).map((error, index) => (
                    <div key={index} className="error-item">
                      <strong>Line {error.line}:</strong> {error.error}
                    </div>
                  ))}
                  {previewData.errors.length > 5 && (
                    <div className="text-muted">
                      ... and {previewData.errors.length - 5} more errors
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {importResult && (
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Import Results</h3>
          </div>
          <div className="card-body">
            <div className="stats-grid">
              <div className="stat-item">
                <div className="stat-value">{importResult.summary.totalProcessed}</div>
                <div className="stat-label">Total Processed</div>
              </div>
              <div className="stat-item">
                <div className="stat-value">{importResult.summary.created || 0}</div>
                <div className="stat-label">Created</div>
              </div>
              <div className="stat-item">
                <div className="stat-value">{importResult.summary.updated || 0}</div>
                <div className="stat-label">Updated</div>
              </div>
              <div className="stat-item">
                <div className="stat-value">{importResult.summary.customFieldsProcessed || 0}</div>
                <div className="stat-label">With Custom Fields</div>
              </div>
              <div className="stat-item">
                <div className="stat-value">{importResult.summary.skipped}</div>
                <div className="stat-label">Skipped</div>
              </div>
              <div className="stat-item">
                <div className="stat-value">{importResult.summary.errors}</div>
                <div className="stat-label">Errors</div>
              </div>
            </div>

            {importResult.imported && importResult.imported.length > 0 && (
              <div className="imported-section">
                <h4>Successfully Imported ({importResult.imported.length})</h4>
                <div className="imported-list">
                  {importResult.imported.slice(0, 10).map((item, index) => (
                    <div key={index} className="imported-item">
                      <strong>{item.data.firstName} {item.data.lastName}</strong>
                      {item.data.email && <span> - {item.data.email}</span>}
                      <span className="text-muted"> (Age: {item.data.age})</span>
                    </div>
                  ))}
                  {importResult.imported.length > 10 && (
                    <div className="text-muted">
                      ... and {importResult.imported.length - 10} more imported
                    </div>
                  )}
                </div>
              </div>
            )}

            {importResult.errors && importResult.errors.length > 0 && (
              <div className="errors-section">
                <h4>Errors ({importResult.errors.length})</h4>
                <div className="error-list">
                  {importResult.errors.slice(0, 5).map((error, index) => (
                    <div key={index} className="error-item">
                      <strong>Line {error.line}:</strong> {error.error}
                    </div>
                  ))}
                  {importResult.errors.length > 5 && (
                    <div className="text-muted">
                      ... and {importResult.errors.length - 5} more errors
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {showDuplicates && duplicates && (
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Duplicate Records Found</h3>
            <button 
              onClick={() => setShowDuplicates(false)}
              className="btn btn-small btn-secondary"
              style={{ marginLeft: 'auto' }}
            >
              Close
            </button>
          </div>
          <div className="card-body">
            <div className="stats-grid">
              <div className="stat-item">
                <div className="stat-value">{duplicates.summary.duplicateUserCount}</div>
                <div className="stat-label">Duplicate Users (by email)</div>
              </div>
              <div className="stat-item">
                <div className="stat-value">{duplicates.summary.duplicateGymnastCount}</div>
                <div className="stat-label">Duplicate Gymnasts (by name)</div>
              </div>
            </div>

            {duplicates.duplicateUsers && duplicates.duplicateUsers.length > 0 && (
              <div className="duplicates-section">
                <h4>Duplicate Users</h4>
                {duplicates.duplicateUsers.map((dup, index) => (
                  <div key={index} className="duplicate-group" style={{ marginBottom: '1rem', padding: '1rem', border: '1px solid #ddd', borderRadius: '4px' }}>
                    <h5>Email: {dup.email} ({dup.count} duplicates)</h5>
                    <div className="duplicate-items">
                      {dup.users.map((user, userIndex) => (
                        <div key={userIndex} className="duplicate-item" style={{ marginBottom: '0.5rem', padding: '0.5rem', backgroundColor: '#f8f9fa', borderRadius: '4px' }}>
                          <strong>{user.firstName} {user.lastName}</strong> 
                          <span className="text-muted"> (ID: {user.id}, Role: {user.role})</span>
                          {user.customFieldValues.length > 0 && (
                            <small className="text-muted d-block">Has {user.customFieldValues.length} custom field values</small>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {duplicates.duplicateGymnasts && duplicates.duplicateGymnasts.length > 0 && (
              <div className="duplicates-section">
                <h4>Duplicate Gymnasts</h4>
                {duplicates.duplicateGymnasts.map((dup, index) => (
                  <div key={index} className="duplicate-group" style={{ marginBottom: '1rem', padding: '1rem', border: '1px solid #ddd', borderRadius: '4px' }}>
                    <h5>Name: {dup.name} ({dup.count} duplicates)</h5>
                    <div className="duplicate-items">
                      {dup.gymnasts.map((gymnast, gymIndex) => (
                        <div key={gymIndex} className="duplicate-item" style={{ marginBottom: '0.5rem', padding: '0.5rem', backgroundColor: '#f8f9fa', borderRadius: '4px' }}>
                          <strong>{gymnast.firstName} {gymnast.lastName}</strong> 
                          <span className="text-muted"> (ID: {gymnast.id})</span>
                          {gymnast.dateOfBirth && (
                            <span className="text-muted"> - DOB: {new Date(gymnast.dateOfBirth).toLocaleDateString()}</span>
                          )}
                          {gymnast.user && (
                            <div>
                              <small className="text-muted">Linked to user: {gymnast.user.email || 'No email'}</small>
                              {gymnast.user.customFieldValues.length > 0 && (
                                <small className="text-muted"> ({gymnast.user.customFieldValues.length} custom fields)</small>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {duplicates.summary.duplicateUserCount === 0 && duplicates.summary.duplicateGymnastCount === 0 && (
              <div className="alert alert-success">
                <strong>No duplicates found!</strong> Your database is clean.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ImportGymnasts; 