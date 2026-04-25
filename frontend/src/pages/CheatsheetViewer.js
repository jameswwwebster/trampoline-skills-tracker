import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import './CheatsheetViewer.css';

const CheatsheetViewer = () => {
  const { cheatsheetId } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [transform, setTransform] = useState({ scale: 1, x: 0, y: 0 });
  const [animating, setAnimating] = useState(false);

  const containerRef = useRef(null);
  const imgRef = useRef(null);
  const transformRef = useRef({ scale: 1, x: 0, y: 0 });
  const lastTapRef = useRef({ time: 0, x: 0, y: 0 });
  const touchStateRef = useRef(null);

  const pageMap = React.useMemo(() => ({
    'dmt-national': 1,
    'dmt-regional': 2,
    'dmt-disability': 3,
    'trampoline-national': 4,
    'trampoline-regional': 5,
    'trampoline-disability': 6,
    'club-level': 7,
    'club-level-north': 8,
    'dmt-english': 9,
    'trampoline-english': 10
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
    'dmt-english': 'DMT English Pathway',
    'trampoline-english': 'Trampoline English Pathway'
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
    'dmt-english': 'Reference for requirements and qualification pathways in ENG National DMT competition',
    'trampoline-english': 'Reference for requirements and qualification pathways in ENG National Trampoline competition'
  };

  // Enable pinch-to-zoom on this page only; restore app-wide restriction on unmount
  useEffect(() => {
    const viewportMeta = document.querySelector('meta[name="viewport"]');
    const original = viewportMeta?.getAttribute('content');
    viewportMeta?.setAttribute('content', 'width=device-width, initial-scale=1, minimum-scale=1, viewport-fit=cover');
    return () => { if (original) viewportMeta?.setAttribute('content', original); };
  }, []);

  // Dynamic meta tags
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

    document.title = `${title} | 2026 BG Rules Cheatsheets | British Gymnastics`;

    const updateMetaTag = (property, content, isProperty = false) => {
      const selector = isProperty ? `meta[property="${property}"]` : `meta[name="${property}"]`;
      let meta = document.querySelector(selector);
      if (!meta) {
        meta = document.createElement('meta');
        meta.setAttribute(isProperty ? 'property' : 'name', property);
        document.head.appendChild(meta);
      }
      meta.setAttribute('content', content);
    };

    updateMetaTag('description', description);
    updateMetaTag('og:title', `${title} | 2026 BG Rules Cheatsheets`, true);
    updateMetaTag('og:description', description, true);
    updateMetaTag('og:url', pageUrl, true);
    updateMetaTag('og:image', imageUrl, true);
    updateMetaTag('twitter:title', `${title} | 2026 BG Rules Cheatsheets`);
    updateMetaTag('twitter:description', description);
    updateMetaTag('twitter:url', pageUrl);

    let canonical = document.querySelector('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.setAttribute('rel', 'canonical');
      document.head.appendChild(canonical);
    }
    canonical.setAttribute('href', pageUrl);

    const addStructuredData = (id, data) => {
      document.getElementById(id)?.remove();
      const script = document.createElement('script');
      script.type = 'application/ld+json';
      script.id = id;
      script.textContent = JSON.stringify(data);
      document.head.appendChild(script);
    };

    addStructuredData('breadcrumb-structured-data', {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      "itemListElement": [
        { "@type": "ListItem", "position": 1, "name": "Cheatsheets", "item": `${baseUrl}/cheatsheets` },
        { "@type": "ListItem", "position": 2, "name": title, "item": pageUrl }
      ]
    });

    addStructuredData('page-structured-data', {
      "@context": "https://schema.org",
      "@type": "WebPage",
      "name": title,
      "description": description,
      "url": pageUrl,
      "inLanguage": "en-GB",
      "isPartOf": { "@type": "WebSite", "name": "2026 BG Rules Cheatsheets - Trampoline & DMT", "url": `${baseUrl}/cheatsheets` },
      "publisher": { "@type": "Organization", "name": "British Gymnastics" }
    });

    return () => { document.title = '2026 BG Rules Cheatsheets - Trampoline & DMT | British Gymnastics'; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cheatsheetId]);

  // Touch zoom/pan — attached after image loads so imgRef dimensions are valid
  useEffect(() => {
    if (loading) return;
    const container = containerRef.current;
    if (!container) return;

    const getDist = (t1, t2) => Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
    const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

    const clampXY = (scale, x, y) => {
      const img = imgRef.current;
      if (!img) return { scale, x, y };
      const cw = container.clientWidth;
      const ch = container.clientHeight;
      const sw = img.clientWidth * scale;
      const sh = img.clientHeight * scale;
      return {
        scale,
        x: sw < cw ? (cw - sw) / 2 : clamp(x, cw - sw, 0),
        y: sh < ch ? (ch - sh) / 2 : clamp(y, ch - sh, 0),
      };
    };

    const applyTransform = (t, animate = false) => {
      transformRef.current = t;
      if (animate) {
        setAnimating(true);
        setTransform({ ...t });
        setTimeout(() => setAnimating(false), 260);
      } else {
        setAnimating(false);
        setTransform({ ...t });
      }
    };

    const onTouchStart = (e) => {
      if (e.touches.length === 1) {
        const touch = e.touches[0];
        const now = Date.now();
        const last = lastTapRef.current;
        const dd = Math.hypot(touch.clientX - last.x, touch.clientY - last.y);

        if (now - last.time < 300 && dd < 40) {
          // Double-tap: zoom in on tap point, or reset
          e.preventDefault();
          const rect = container.getBoundingClientRect();
          const tapX = touch.clientX - rect.left;
          const tapY = touch.clientY - rect.top;
          const cur = transformRef.current;

          if (cur.scale > 1.5) {
            applyTransform({ scale: 1, x: 0, y: 0 }, true);
          } else {
            const newScale = 2.5;
            const imgX = (tapX - cur.x) / cur.scale;
            const imgY = (tapY - cur.y) / cur.scale;
            applyTransform(clampXY(newScale, tapX - imgX * newScale, tapY - imgY * newScale), true);
          }
          lastTapRef.current = { time: 0, x: 0, y: 0 };
          touchStateRef.current = null;
          return;
        }

        lastTapRef.current = { time: now, x: touch.clientX, y: touch.clientY };
        touchStateRef.current = {
          type: 'pan',
          sx: touch.clientX, sy: touch.clientY,
          stx: transformRef.current.x, sty: transformRef.current.y,
        };
      } else if (e.touches.length === 2) {
        e.preventDefault();
        const rect = container.getBoundingClientRect();
        const t1 = e.touches[0], t2 = e.touches[1];
        touchStateRef.current = {
          type: 'pinch',
          startDist: getDist(t1, t2),
          startScale: transformRef.current.scale,
          midX: (t1.clientX + t2.clientX) / 2 - rect.left,
          midY: (t1.clientY + t2.clientY) / 2 - rect.top,
          stx: transformRef.current.x,
          sty: transformRef.current.y,
        };
      }
    };

    const onTouchMove = (e) => {
      const s = touchStateRef.current;
      if (!s) return;
      e.preventDefault();

      if (s.type === 'pan' && e.touches.length === 1) {
        const cur = transformRef.current;
        if (cur.scale <= 1) return;
        const touch = e.touches[0];
        applyTransform(clampXY(cur.scale,
          s.stx + (touch.clientX - s.sx),
          s.sty + (touch.clientY - s.sy)
        ));
      } else if (s.type === 'pinch' && e.touches.length === 2) {
        const newScale = clamp(s.startScale * (getDist(e.touches[0], e.touches[1]) / s.startDist), 1, 4);
        const imgMx = (s.midX - s.stx) / s.startScale;
        const imgMy = (s.midY - s.sty) / s.startScale;
        applyTransform(clampXY(newScale, s.midX - imgMx * newScale, s.midY - imgMy * newScale));
      }
    };

    const onTouchEnd = (e) => {
      if (e.touches.length === 0) {
        if (transformRef.current.scale < 1.15) {
          applyTransform({ scale: 1, x: 0, y: 0 }, true);
        }
        touchStateRef.current = null;
      } else if (e.touches.length === 1 && touchStateRef.current?.type === 'pinch') {
        // Transition pinch → pan smoothly
        const touch = e.touches[0];
        touchStateRef.current = {
          type: 'pan',
          sx: touch.clientX, sy: touch.clientY,
          stx: transformRef.current.x, sty: transformRef.current.y,
        };
      }
    };

    container.addEventListener('touchstart', onTouchStart, { passive: false });
    container.addEventListener('touchmove', onTouchMove, { passive: false });
    container.addEventListener('touchend', onTouchEnd, { passive: false });

    return () => {
      container.removeEventListener('touchstart', onTouchStart);
      container.removeEventListener('touchmove', onTouchMove);
      container.removeEventListener('touchend', onTouchEnd);
    };
  }, [loading]);

  const pageNumber = pageMap[cheatsheetId] || 1;
  const imageUrl = process.env.NODE_ENV === 'development'
    ? `http://localhost:5000/cheatsheets/pages/page-${pageNumber}.jpg`
    : `${process.env.REACT_APP_API_URL || ''}/cheatsheets/pages/page-${pageNumber}.jpg`;

  // Preload
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => { setLoading(false); setError(null); };
    img.onerror = () => { setError(`Failed to load cheatsheet image`); setLoading(false); };
    img.src = imageUrl;
  }, [imageUrl]);

  const handleDownload = async () => {
    try {
      const response = await fetch(imageUrl, { mode: 'cors' });
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${cheatsheetTitles[cheatsheetId] || 'cheatsheet'}.jpg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      window.open(imageUrl, '_blank');
    }
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
        <button className="download-btn" onClick={handleDownload} title="Download image">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
        </button>
      </div>
      <p className="zoom-hint">Double-tap to zoom · pinch to zoom · drag to pan</p>
      <div className="viewer-container" ref={containerRef}>
        <img
          ref={imgRef}
          src={imageUrl}
          alt={`${cheatsheetTitles[cheatsheetId] || 'Cheatsheet'} - 2026 British Gymnastics competition requirements and qualification pathways`}
          className="cheatsheet-image"
          style={{
            transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
            transformOrigin: '0 0',
            transition: animating ? 'transform 0.25s ease' : 'none',
            willChange: 'transform',
          }}
          crossOrigin="anonymous"
          onLoad={() => setLoading(false)}
          onError={() => { setError('Failed to load cheatsheet image'); setLoading(false); }}
        />
      </div>
    </div>
  );
};

export default CheatsheetViewer;
