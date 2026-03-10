import React, { createContext, useContext, useState, useEffect } from 'react';
import { get } from '../utils/apiInterceptor';

const BrandingContext = createContext();

export const useBranding = () => {
  const context = useContext(BrandingContext);
  if (!context) {
    throw new Error('useBranding must be used within a BrandingProvider');
  }
  return context;
};

export const BrandingProvider = ({ children }) => {
  const [branding, setBranding] = useState({
    primaryColor: '#2d2d2d',
    secondaryColor: '#7c35e8',
    accentColor: '#9b4dca',
    backgroundColor: '#eaeaec',
    textColor: '#1a1a1a',
    logoUrl: '',
    fontFamily: "'Exo 2', Arial, sans-serif",
    website: '',
    description: ''
  });
  const [loading, setLoading] = useState(true);

  const fetchBranding = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        // Not logged in; keep defaults and avoid noisy 401s
        return;
      }
      const response = await get('/api/branding');
      setBranding(prev => ({ ...prev, ...response.data }));
    } catch (err) {
      console.error('Failed to fetch branding:', err);
      // Use default values if fetching fails
    } finally {
      setLoading(false);
    }
  };

  const updateBranding = (newBranding) => {
    setBranding(prev => ({ ...prev, ...newBranding }));
  };

  // Apply branding to CSS custom properties
  useEffect(() => {
    const root = document.documentElement;
    
    // Set tracking system CSS custom properties
    root.style.setProperty('--primary-color', branding.primaryColor);
    root.style.setProperty('--secondary-color', branding.secondaryColor);
    root.style.setProperty('--accent-color', branding.accentColor);
    root.style.setProperty('--background-color', branding.backgroundColor);
    root.style.setProperty('--text-color', branding.textColor);

    // Mirror into booking system vars so both systems stay in sync
    root.style.setProperty('--booking-bg-dark', branding.primaryColor);
    root.style.setProperty('--booking-accent', branding.secondaryColor);
    root.style.setProperty('--booking-accent-light', branding.accentColor);
    root.style.setProperty('--booking-accent-dark', branding.secondaryColor);
    root.style.setProperty('--booking-bg-light', branding.backgroundColor);
    root.style.setProperty('--booking-text-on-light', branding.textColor);
    root.style.setProperty('--booking-accent-gradient',
      `linear-gradient(135deg, ${branding.secondaryColor}, ${branding.accentColor})`);

    // Font
    if (branding.fontFamily) {
      root.style.setProperty('--font-family', branding.fontFamily);
      root.style.setProperty('--booking-font', branding.fontFamily);
    }
    
    // Set body background
    document.body.style.backgroundColor = branding.backgroundColor;
    document.body.style.color = branding.textColor;
    
    if (branding.fontFamily) {
      document.body.style.fontFamily = branding.fontFamily;
    }
  }, [branding]);

  useEffect(() => {
    fetchBranding();
  }, []);

  const value = {
    branding,
    updateBranding,
    loading,
    fetchBranding
  };

  return (
    <BrandingContext.Provider value={value}>
      {children}
    </BrandingContext.Provider>
  );
}; 