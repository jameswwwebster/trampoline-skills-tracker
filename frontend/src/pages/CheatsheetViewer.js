import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import './CheatsheetViewer.css';

const CheatsheetViewer = () => {
  const { cheatsheetId } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Map cheatsheet IDs to page numbers
  const pageMap = React.useMemo(() => ({
    'dmt-national': 1,
    'dmt-regional': 2,
    'dmt-disability': 3,
    'trampoline-national': 4,
    'trampoline-regional': 5,
    'trampoline-disability': 6,
    'club-level': 7,
    'club-level-north': 8,
    'dmt-english': 9
  }), []);

  const cheatsheetTitles = {
    'dmt-national': 'DMT National Requirements',
    'dmt-regional': 'DMT Regional Requirements',
    'dmt-disability': 'DMT Disability Requirements',
    'trampoline-national': 'Trampoline National Requirements',
    'trampoline-regional': 'Trampoline Regional Requirements',
    'trampoline-disability': 'Trampoline Disability Requirements',
    'club-level': 'Club Requirements',
    'club-level-north': 'North Region Club Requirements',
    'dmt-english': 'DMT English Pathway'
  };

  const cheatsheetDescriptions = {
    'dmt-national': 'Requirements and qualification pathways in GB National DMT competition',
    'dmt-regional': 'Requirements and qualification pathways in GB Regional DMT competition',
    'dmt-disability': 'Requirements for DMT in different GB series for disabled athletes',
    'trampoline-national': 'Requirements and qualification pathways in GB National Trampoline competition',
    'trampoline-regional': 'Requirements and qualification pathways in GB Regional Trampoline competition',
    'trampoline-disability': 'Requirements for Trampoline in different GB series for disabled athletes',
    'club-level': 'Requirements and qualification pathways in GB Club Level competition',
    'club-level-north': 'Requirements and qualification pathways in North Region Club Level competition',
    'dmt-english': 'Reference for requirements and qualification pathways in ENG National DMT competition'
  };

  // Dynamic meta tags and structured data
  useEffect(() => {
    const title = cheatsheetTitles[cheatsheetId] || 'Cheatsheet';
    const description = cheatsheetDescriptions[cheatsheetId] || 'British Gymnastics competition requirements cheatsheet';
    const baseUrl = process.env.NODE_ENV === 'development' 
      ? 'http://localhost:3000' 
      : 'https://trampoline-frontend.onrender.com';
    const pageUrl = `${baseUrl}/cheatsheets/${cheatsheetId}`;
    const imageUrl = process.env.NODE_ENV === 'development'
      ? 'http://localhost:3000/social-preview.png'
      : 'https://trampoline-frontend.onrender.com/social-preview.png';

    // Update document title
    document.title = `${title} | 2026 BG Rules Cheatsheets | British Gymnastics`;

    // Update or create meta tags
    const updateMetaTag = (property, content, isProperty = false) => {
      const selector = isProperty ? `meta[property="${property}"]` : `meta[name="${property}"]`;
      let meta = document.querySelector(selector);
      if (!meta) {
        meta = document.createElement('meta');
        if (isProperty) {
          meta.setAttribute('property', property);
        } else {
          meta.setAttribute('name', property);
        }
        document.head.appendChild(meta);
      }
      meta.setAttribute('content', content);
    };

    // Update meta description
    updateMetaTag('description', description);
    
    // Update Open Graph tags
    updateMetaTag('og:title', `${title} | 2026 BG Rules Cheatsheets`, true);
    updateMetaTag('og:description', description, true);
    updateMetaTag('og:url', pageUrl, true);
    updateMetaTag('og:image', imageUrl, true);
    
    // Update Twitter tags
    updateMetaTag('twitter:title', `${title} | 2026 BG Rules Cheatsheets`);
    updateMetaTag('twitter:description', description);
    updateMetaTag('twitter:url', pageUrl);
    
    // Update canonical URL
    let canonical = document.querySelector('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.setAttribute('rel', 'canonical');
      document.head.appendChild(canonical);
    }
    canonical.setAttribute('href', pageUrl);

    // Add breadcrumb structured data
    const breadcrumbScript = document.createElement('script');
    breadcrumbScript.type = 'application/ld+json';
    breadcrumbScript.id = 'breadcrumb-structured-data';
    // Remove existing breadcrumb script if present
    const existingBreadcrumb = document.getElementById('breadcrumb-structured-data');
    if (existingBreadcrumb) {
      existingBreadcrumb.remove();
    }
    breadcrumbScript.textContent = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      "itemListElement": [
        {
          "@type": "ListItem",
          "position": 1,
          "name": "Cheatsheets",
          "item": `${baseUrl}/cheatsheets`
        },
        {
          "@type": "ListItem",
          "position": 2,
          "name": title,
          "item": pageUrl
        }
      ]
    });
    document.head.appendChild(breadcrumbScript);

    // Add page-specific structured data
    const pageScript = document.createElement('script');
    pageScript.type = 'application/ld+json';
    pageScript.id = 'page-structured-data';
    const existingPage = document.getElementById('page-structured-data');
    if (existingPage) {
      existingPage.remove();
    }
    pageScript.textContent = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "WebPage",
      "name": title,
      "description": description,
      "url": pageUrl,
      "inLanguage": "en-GB",
      "isPartOf": {
        "@type": "WebSite",
        "name": "2026 BG Rules Cheatsheets - Trampoline & DMT",
        "url": `${baseUrl}/cheatsheets`
      },
      "publisher": {
        "@type": "Organization",
        "name": "British Gymnastics"
      }
    });
    document.head.appendChild(pageScript);

    // Cleanup function
    return () => {
      // Reset title on unmount
      document.title = '2026 BG Rules Cheatsheets - Trampoline & DMT | British Gymnastics';
    };
  }, [cheatsheetId, cheatsheetTitles, cheatsheetDescriptions]);

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

    // Preload image with CORS
    const img = new Image();
    img.crossOrigin = 'anonymous'; // Enable CORS for image loading
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
      </div>
      
      <div className="viewer-container">
        <img 
          src={imageUrl} 
          alt={`${cheatsheetTitles[cheatsheetId] || 'Cheatsheet'} - 2026 British Gymnastics competition requirements and qualification pathways`}
          className="cheatsheet-image"
          crossOrigin="anonymous"
          onLoad={() => setLoading(false)}
          onError={() => {
            setError('Failed to load cheatsheet image');
            setLoading(false);
          }}
        />
      </div>
    </div>
  );
};

export default CheatsheetViewer;
