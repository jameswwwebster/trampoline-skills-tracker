import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import './booking/bookingVars.css';
import './AuthPages.css';

const Register = () => {
  const [formData, setFormData] = useState({
    firstName: '', lastName: '', email: '', phone: '', password: '', confirmPassword: '',
  });
  const [policiesAccepted, setPoliciesAccepted] = useState(false);
  const [validationErrors, setValidationErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const { register, isAuthenticated, error } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated) navigate('/', { replace: true });
  }, [isAuthenticated, navigate]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(f => ({ ...f, [name]: value }));
    if (validationErrors[name]) setValidationErrors(v => ({ ...v, [name]: '' }));
  };

  const validate = () => {
    const errors = {};
    if (!formData.firstName.trim()) errors.firstName = 'Required';
    if (!formData.lastName.trim()) errors.lastName = 'Required';
    if (!formData.email.trim()) errors.email = 'Required';
    else if (!/\S+@\S+\.\S+/.test(formData.email)) errors.email = 'Invalid email';
    if (!formData.phone.trim()) errors.phone = 'Required';
    if (!formData.password) errors.password = 'Required';
    else if (formData.password.length < 6) errors.password = 'At least 6 characters';
    if (formData.password !== formData.confirmPassword) errors.confirmPassword = 'Passwords do not match';
    if (!policiesAccepted) errors.policies = 'You must read and accept the club policies';
    return errors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errors = validate();
    if (Object.keys(errors).length > 0) { setValidationErrors(errors); return; }
    setIsLoading(true);
    setValidationErrors({});
    const result = await register({
      firstName: formData.firstName,
      lastName: formData.lastName,
      email: formData.email,
      phone: formData.phone,
      password: formData.password,
    });
    if (result.success) navigate('/booking', { replace: true });
    setIsLoading(false);
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-brand">Trampoline Life</div>
        <h1 className="auth-heading">Create an account</h1>

        {error && <p className="auth-error">{error}</p>}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="auth-grid-2">
            <label className="auth-label">First name
              <input name="firstName" value={formData.firstName} onChange={handleChange}
                className={`auth-input${validationErrors.firstName ? ' auth-input--error' : ''}`} required />
              {validationErrors.firstName && <span className="auth-field-error">{validationErrors.firstName}</span>}
            </label>
            <label className="auth-label">Last name
              <input name="lastName" value={formData.lastName} onChange={handleChange}
                className={`auth-input${validationErrors.lastName ? ' auth-input--error' : ''}`} required />
              {validationErrors.lastName && <span className="auth-field-error">{validationErrors.lastName}</span>}
            </label>
          </div>

          <label className="auth-label">Email
            <input type="email" name="email" value={formData.email} onChange={handleChange}
              className={`auth-input${validationErrors.email ? ' auth-input--error' : ''}`} required autoComplete="email" />
            {validationErrors.email && <span className="auth-field-error">{validationErrors.email}</span>}
          </label>

          <label className="auth-label">Phone number
            <input type="tel" name="phone" value={formData.phone} onChange={handleChange}
              className={`auth-input${validationErrors.phone ? ' auth-input--error' : ''}`} required />
            {validationErrors.phone && <span className="auth-field-error">{validationErrors.phone}</span>}
          </label>

          <label className="auth-label">Password
            <input type="password" name="password" value={formData.password} onChange={handleChange}
              className={`auth-input${validationErrors.password ? ' auth-input--error' : ''}`} required autoComplete="new-password" />
            {validationErrors.password && <span className="auth-field-error">{validationErrors.password}</span>}
          </label>

          <label className="auth-label">Confirm password
            <input type="password" name="confirmPassword" value={formData.confirmPassword} onChange={handleChange}
              className={`auth-input${validationErrors.confirmPassword ? ' auth-input--error' : ''}`} required />
            {validationErrors.confirmPassword && <span className="auth-field-error">{validationErrors.confirmPassword}</span>}
          </label>

          <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem', cursor: 'pointer', fontSize: '0.9rem', lineHeight: 1.4 }}>
            <input
              type="checkbox"
              checked={policiesAccepted}
              onChange={e => { setPoliciesAccepted(e.target.checked); if (validationErrors.policies) setValidationErrors(v => ({ ...v, policies: '' })); }}
              className="auth-checkbox"
            />
            <span>
              I have read and agree to the{' '}
              <a href="https://www.trampoline.life/club-policies" target="_blank" rel="noopener noreferrer" className="auth-link">
                club policies
              </a>
            </span>
          </label>
          {validationErrors.policies && <span className="auth-field-error">{validationErrors.policies}</span>}

          <button type="submit" disabled={isLoading} className="auth-btn auth-btn--primary">
            {isLoading ? 'Creating account…' : 'Create account'}
          </button>
        </form>

        <div className="auth-links" style={{ flexDirection: 'column', gap: '0.2rem' }}>
          <span>Already have an account?</span>
          <Link to="/login" className="auth-link">Sign in</Link>
        </div>
      </div>
    </div>
  );
};

export default Register;
