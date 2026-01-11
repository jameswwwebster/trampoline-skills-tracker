import React from 'react';
import { Link } from 'react-router-dom';
import './Cheatsheets.css';

const Cheatsheets = () => {
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

  return (
    <div className="cheatsheets-container">
      <div className="cheatsheets-header">
        <h1>2026 BG Rules Cheatsheets</h1>
        <p className="subtitle">Trampoline & DMT</p>
        <p className="description">
          Quick reference guides for competition requirements and qualification pathways.
          Tap any cheatsheet to view in full screen.
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

