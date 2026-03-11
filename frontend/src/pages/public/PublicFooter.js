import React from 'react';
import { SOCIAL_LINKS } from './publicConstants';

export default function PublicFooter() {
  return (
    <footer className="pub-footer">
      <div className="pub-footer-inner">
        <span>© {new Date().getFullYear()} Trampoline Life</span>
        <div className="pub-footer-links">
          <a href={SOCIAL_LINKS.instagram} target="_blank" rel="noopener noreferrer">Instagram</a>
          <a href={SOCIAL_LINKS.tiktok} target="_blank" rel="noopener noreferrer">TikTok</a>
          <a href={SOCIAL_LINKS.facebook} target="_blank" rel="noopener noreferrer">Facebook</a>
          <a href={SOCIAL_LINKS.whatsapp} target="_blank" rel="noopener noreferrer">WhatsApp</a>
        </div>
      </div>
    </footer>
  );
}
