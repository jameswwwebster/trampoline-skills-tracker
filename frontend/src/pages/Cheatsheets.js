import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import './Cheatsheets.css';

const Cheatsheets = () => {
  // SEO: Add structured data and meta tags
  useEffect(() => {
    const baseUrl = process.env.NODE_ENV === 'development' 
      ? 'http://localhost:3000' 
      : 'https://trampoline-frontend.onrender.com';
    const pageUrl = `${baseUrl}/cheatsheets`;

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
          "item": pageUrl
        }
      ]
    });
    document.head.appendChild(breadcrumbScript);

    // Add collection page structured data
    const collectionScript = document.createElement('script');
    collectionScript.type = 'application/ld+json';
    collectionScript.id = 'collection-structured-data';
    const existingCollection = document.getElementById('collection-structured-data');
    if (existingCollection) {
      existingCollection.remove();
    }
    collectionScript.textContent = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      "name": "2026 BG Rules Cheatsheets - Trampoline & DMT",
      "description": "One-page cheatsheets for trampoline and DMT requirements for British Gymnastics competitions in the UK - 2026 rules, regulations and qualification pathways",
      "url": pageUrl,
      "inLanguage": "en-GB",
      "publisher": {
        "@type": "Organization",
        "name": "British Gymnastics"
      }
    });
    document.head.appendChild(collectionScript);
  }, []);
  // List of cheatsheets - all 8 pages
  const cheatsheets = [
    {
      id: 'dmt-national',
      title: 'DMT National Requirements',
      description: 'Requirements and qualification pathways in GB National DMT competition',
      page: 1
    },
    {
      id: 'dmt-regional',
      title: 'DMT Regional Requirements',
      description: 'Requirements and qualification pathways in GB Regional DMT competition',
      page: 2
    },
    {
      id: 'dmt-disability',
      title: 'DMT Disability Requirements',
      description: 'Requirements for DMT in different GB series for disabled athletes',
      page: 3
    },
    {
      id: 'trampoline-national',
      title: 'Trampoline National Requirements',
      description: 'Requirements and qualification pathways in GB National Trampoline competition',
      page: 4
    },
    {
      id: 'trampoline-regional',
      title: 'Trampoline Regional Requirements',
      description: 'Requirements and qualification pathways in GB Regional Trampoline competition',
      page: 5
    },
    {
      id: 'trampoline-disability',
      title: 'Trampoline Disability Requirements',
      description: 'Requirements for Trampoline in different GB series for disabled athletes',
      page: 6
    },
    {
      id: 'club-level',
      title: 'Club Requirements',
      description: 'Requirements and qualification pathways in GB Club Level competition',
      page: 7
    },
    {
      id: 'club-level-north',
      title: 'North Region Club Requirements',
      description: 'Requirements and qualification pathways in North Region Club Level competition',
      page: 8
    }
  ];

  const fullPdfUrl = `${process.env.REACT_APP_API_URL || ''}/cheatsheets/2026-Requirements.pdf`;

  return (
    <div className="cheatsheets-container">
      <div className="cheatsheets-header">
        <h1>2026 BG Rules Cheatsheets</h1>
        <p className="subtitle">Trampoline & DMT</p>
        <p className="description">
          Quick reference guides for competition requirements and qualification pathways.
          Tap any cheatsheet to view in full screen.
        </p>
        <p className="full-pdf-link">
          <a href={fullPdfUrl} target="_blank" rel="noopener noreferrer">
            Download full 2026 Requirements (PDF)
          </a>
        </p>
      </div>
      
      <div className="cheatsheets-grid">
        {cheatsheets.map((cheatsheet) => (
          <Link
            key={cheatsheet.id}
            to={`/cheatsheets/${cheatsheet.id}`}
            className="cheatsheet-card"
          >
            <div className="cheatsheet-card-content">
              <h2>{cheatsheet.title}</h2>
              <p>{cheatsheet.description}</p>
              <span className="view-link">View Cheatsheet →</span>
            </div>
          </Link>
        ))}
      </div>

      <div className="appendix-section">
        <h2>Source Documents</h2>
        <p className="appendix-description">
          These cheatsheets are based on the official British Gymnastics technical requirements and FIG regulations. 
          For complete details, please refer to the source documents below.
        </p>

        <div className="source-documents">
          <div className="source-category source-category-full-doc">
            <h3>Full document</h3>
            <ul>
              <li>
                <a href={fullPdfUrl} target="_blank" rel="noopener noreferrer">
                  2026 Requirements (full PDF)
                </a>
              </li>
            </ul>
          </div>

          <div className="source-category">
            <h3>Trampoline</h3>
            <ul>
              <li>
                <a href="https://s3.amazonaws.com/a.storyblok.com/f/83342/x/82bc22bb5c/tra-technical-requirements-2026-national-pathway.pdf" 
                   target="_blank" 
                   rel="noopener noreferrer">
                  Trampoline National Pathway
                </a>
              </li>
              <li>
                <a href="https://s3.amazonaws.com/a.storyblok.com/f/83342/x/d8cd574e43/tra-technical-requirements-2026-regional-pathway.pdf" 
                   target="_blank" 
                   rel="noopener noreferrer">
                  Trampoline Regional & Club Pathway
                </a>
              </li>
              <li>
                <a href="https://s3.amazonaws.com/a.storyblok.com/f/83342/x/aeeac655ba/tra-technical-requirements-2026-disabilities-pathway.pdf" 
                   target="_blank" 
                   rel="noopener noreferrer">
                  Trampoline Disability Pathway
                </a>
              </li>
            </ul>
          </div>

          <div className="source-category">
            <h3>DMT (Double Mini Trampoline)</h3>
            <ul>
              <li>
                <a href="https://s3.amazonaws.com/a.storyblok.com/f/83342/x/dd0673925c/dmt-technical-requirements-2026-national-pathway.pdf" 
                   target="_blank" 
                   rel="noopener noreferrer">
                  DMT National Pathway
                </a>
              </li>
              <li>
                <a href="https://s3.amazonaws.com/a.storyblok.com/f/83342/x/4a5fd1d7b9/dmt-technical-requirements-2026-regional-pathway.pdf" 
                   target="_blank" 
                   rel="noopener noreferrer">
                  DMT Regional & Club Pathway
                </a>
              </li>
              <li>
                <a href="https://s3.amazonaws.com/a.storyblok.com/f/83342/x/2b27402501/dmt-technical-requirements-2026-disabilities-pathway.pdf" 
                   target="_blank" 
                   rel="noopener noreferrer">
                  DMT Disability Pathway
                </a>
              </li>
            </ul>
          </div>

          <div className="source-category">
            <h3>FIG Regulations</h3>
            <ul>
              <li>
                <a href="https://www.gymnastics.sport/publicdir/rules/files/en_1.1%20-%20WAG%20COP%202025-2028.pdf" 
                   target="_blank" 
                   rel="noopener noreferrer">
                  FIG Code of Points 2025-2028
                </a>
              </li>
              <li>
                <a href="https://www.gymnastics.sport/publicdir/rules/files/en_1.1%20-%20Technical%20Regulations%202026.pdf" 
                   target="_blank" 
                   rel="noopener noreferrer">
                  FIG Technical Regulations 2026
                </a>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Cheatsheets;

