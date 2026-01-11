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
    </div>
  );
};

export default Cheatsheets;

