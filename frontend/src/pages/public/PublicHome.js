import React from 'react';
import PublicNav from './PublicNav';
import PublicFooter from './PublicFooter';
import './public.css';

const HERO_IMAGE = 'https://static.wixstatic.com/media/010c39_6310c1e27ecf44e199e0055176fcbb5a~mv2.png/v1/crop/x_0,y_9,w_1080,h_383,q_90,enc_avif,quality_auto/010c39_6310c1e27ecf44e199e0055176fcbb5a~mv2.png';

export default function PublicHome() {
  return (
    <div className="public-page">
      <PublicNav />
      <main className="pub-main">
        {/* Hero */}
        <section className="pub-hero" style={{ backgroundImage: `url(${HERO_IMAGE})` }}>
          <div className="pub-hero-overlay">
            <div className="pub-hero-content">
              <h1 className="pub-hero-headline">
                The only <span className="pub-accent">trampoline</span> and <span className="pub-accent">DMT</span> club in Newcastle
              </h1>
              <p className="pub-hero-body">
                Trampoline Life offers recreational and competitive Trampoline and DMT training
                from qualified coaches in a safe environment. Come along and try it out for
                yourselves; young or old, everybody is welcome!
              </p>
              <a href="/booking" className="pub-hero-cta">Book a session</a>
            </div>
          </div>
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}
