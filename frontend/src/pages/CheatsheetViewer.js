import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import * as pdfjsLib from 'pdfjs-dist';
import './CheatsheetViewer.css';

// Set up PDF.js worker
// Use the worker file from the public directory
pdfjsLib.GlobalWorkerOptions.workerSrc = `${process.env.PUBLIC_URL || ''}/pdf.worker.min.js`;

const CheatsheetViewer = () => {
  const { cheatsheetId } = useParams();
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [scale, setScale] = useState(1);

  // Map cheatsheet IDs to page numbers in the PDF
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
    const loadPDF = async () => {
      // Use the backend route to serve the PDF
      // In development, use localhost backend directly; in production, use API URL
      let pdfUrl;
      if (process.env.NODE_ENV === 'development') {
        // In development, use the backend directly
        pdfUrl = 'http://localhost:5000/cheatsheets/2026%20Requirements%20(1).pdf';
      } else {
        // In production, use the configured API URL or relative path
        const apiBaseUrl = process.env.REACT_APP_API_URL || '';
        pdfUrl = `${apiBaseUrl}/cheatsheets/2026%20Requirements%20(1).pdf`;
      }

      try {
        setLoading(true);
        setError(null);

        const loadingTask = pdfjsLib.getDocument(pdfUrl);
        const pdf = await loadingTask.promise;
        
        const pageNumber = pageMap[cheatsheetId] || 1;
        await renderPage(pdf, pageNumber);
        
        setCurrentPage(pageNumber);
        setLoading(false);
      } catch (err) {
        console.error('Error loading PDF:', err);
        console.error('PDF URL attempted:', pdfUrl);
        console.error('Error details:', err.message, err.stack);
        setError(`Failed to load cheatsheet: ${err.message || 'Please try again.'}`);
        setLoading(false);
      }
    };

    loadPDF();
  }, [cheatsheetId, pageMap]);

  useEffect(() => {
    const handleResize = () => {
      // Recalculate scale on window resize
      if (containerRef.current && canvasRef.current) {
        const container = containerRef.current;
        const canvas = canvasRef.current;
        const containerWidth = container.clientWidth;
        const containerHeight = container.clientHeight;
        
        // Calculate scale to fit container while maintaining aspect ratio
        const scaleX = (containerWidth - 40) / canvas.width;
        const scaleY = (containerHeight - 40) / canvas.height;
        const newScale = Math.min(scaleX, scaleY, 2); // Max scale of 2
        
        setScale(newScale);
      }
    };

    window.addEventListener('resize', handleResize);
    handleResize(); // Initial calculation

    return () => window.removeEventListener('resize', handleResize);
  }, [currentPage, loading]);

  const renderPage = async (pdf, pageNumber) => {
    const page = await pdf.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 2 }); // High DPI for quality
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const context = canvas.getContext('2d');
    canvas.height = viewport.height;
    canvas.width = viewport.width;

    const renderContext = {
      canvasContext: context,
      viewport: viewport
    };

    await page.render(renderContext).promise;
  };

  const handleZoomIn = () => {
    setScale(prev => Math.min(prev + 0.25, 3));
  };

  const handleZoomOut = () => {
    setScale(prev => Math.max(prev - 0.25, 0.5));
  };

  const handleResetZoom = () => {
    setScale(1);
  };

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
          className="canvas-wrapper"
          style={{ transform: `scale(${scale})` }}
        >
          <canvas ref={canvasRef} className="pdf-canvas" />
        </div>
      </div>
    </div>
  );
};

export default CheatsheetViewer;

