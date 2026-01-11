import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import './CheatsheetViewer.css';

const CheatsheetViewer = () => {
  const { cheatsheetId } = useParams();
  const containerRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [scale, setScale] = useState(1);

  // Map cheatsheet IDs to page numbers
  const pageMap = React.useMemo(() => ({
    'dmt-national': 1,
    'dmt-regional': 2,
    'dmt-disability': 3,
    'tra-disability': 4,
    'club-level': 5,
    'club-level-north': 6
  }), []);

  const cheatsheetTitles = {
    'dmt-national': 'DMT National Pathway',
    'dmt-regional': 'DMT Regional Pathway',
    'dmt-disability': 'DMT Disability',
    'tra-disability': 'TRA Disability',
    'club-level': 'Club Level',
    'club-level-north': 'Club Level - North Region'
  };

  useEffect(() => {
    const pageNumber = pageMap[cheatsheetId] || 1;
    
    // Construct image URL
    let imageUrl;
    if (process.env.NODE_ENV === 'development') {
      imageUrl = `http://localhost:5000/cheatsheets/pages/page-${pageNumber}.jpg`;
    } else {
      const apiBaseUrl = process.env.REACT_APP_API_URL || '';
      imageUrl = `${apiBaseUrl}/cheatsheets/pages/page-${pageNumber}.jpg`;
    }

    // Preload image
    const img = new Image();
    img.onload = () => {
      setLoading(false);
      setError(null);
    };
    img.onerror = (err) => {
      console.error('Error loading image:', err);
      console.error('Image URL attempted:', imageUrl);
      console.error('Image load error details:', img.src, img.complete, img.naturalWidth);
      setError(`Failed to load cheatsheet image from: ${imageUrl}`);
      setLoading(false);
    };
    console.log('Loading cheatsheet image from:', imageUrl);
    img.src = imageUrl;
  }, [cheatsheetId, pageMap]);

  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        const container = containerRef.current;
        const img = container.querySelector('img');
        if (img) {
          const containerWidth = container.clientWidth;
          const containerHeight = container.clientHeight;
          
          // Calculate scale to fit container while maintaining aspect ratio
          const scaleX = (containerWidth - 40) / img.naturalWidth;
          const scaleY = (containerHeight - 40) / img.naturalHeight;
          const newScale = Math.min(scaleX, scaleY, 2); // Max scale of 2
          
          setScale(newScale);
        }
      }
    };

    window.addEventListener('resize', handleResize);
    handleResize(); // Initial calculation

    return () => window.removeEventListener('resize', handleResize);
  }, [loading]);

  const handleZoomIn = () => {
    setScale(prev => Math.min(prev + 0.25, 3));
  };

  const handleZoomOut = () => {
    setScale(prev => Math.max(prev - 0.25, 0.5));
  };

  const handleResetZoom = () => {
    setScale(1);
  };

  const pageNumber = pageMap[cheatsheetId] || 1;
  let imageUrl;
  if (process.env.NODE_ENV === 'development') {
    imageUrl = `http://localhost:5000/cheatsheets/pages/page-${pageNumber}.jpg`;
  } else {
    const apiBaseUrl = process.env.REACT_APP_API_URL || '';
    imageUrl = `${apiBaseUrl}/cheatsheets/pages/page-${pageNumber}.jpg`;
  }

  if (loading) {
    return (
      <div className="cheatsheet-viewer">
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Loading cheatsheet...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="cheatsheet-viewer">
        <div className="error-container">
          <p>{error}</p>
          <Link to="/cheatsheets" className="back-button">← Back to Cheatsheets</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="cheatsheet-viewer">
      <div className="viewer-header">
        <Link to="/cheatsheets" className="back-link">← Back</Link>
        <h2>{cheatsheetTitles[cheatsheetId] || 'Cheatsheet'}</h2>
        <div className="zoom-controls">
          <button onClick={handleZoomOut} className="zoom-button" aria-label="Zoom out">−</button>
          <span className="zoom-level">{Math.round(scale * 100)}%</span>
          <button onClick={handleZoomIn} className="zoom-button" aria-label="Zoom in">+</button>
          <button onClick={handleResetZoom} className="zoom-button reset" aria-label="Reset zoom">⌂</button>
        </div>
      </div>
      
      <div className="viewer-container" ref={containerRef}>
        <div 
          className="image-wrapper"
          style={{ transform: `scale(${scale})` }}
        >
          <img 
            src={imageUrl} 
            alt={cheatsheetTitles[cheatsheetId] || 'Cheatsheet'}
            className="cheatsheet-image"
            onLoad={() => setLoading(false)}
            onError={() => {
              setError('Failed to load cheatsheet image');
              setLoading(false);
            }}
          />
        </div>
      </div>
    </div>
  );
};

export default CheatsheetViewer;
