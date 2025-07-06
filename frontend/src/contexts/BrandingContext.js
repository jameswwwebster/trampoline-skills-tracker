import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

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
  const [loading, setLoading] = useState(true);

  const fetchBranding = async () => {
    try {
      const response = await axios.get('/api/branding');
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
    
    // Set CSS custom properties
    root.style.setProperty('--primary-color', branding.primaryColor);
    root.style.setProperty('--secondary-color', branding.secondaryColor);
    root.style.setProperty('--accent-color', branding.accentColor);
    root.style.setProperty('--background-color', branding.backgroundColor);
    root.style.setProperty('--text-color', branding.textColor);
    
    // Set font family if specified
    if (branding.fontFamily) {
      root.style.setProperty('--font-family', branding.fontFamily);
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