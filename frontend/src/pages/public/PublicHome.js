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

        {/* Session Information */}
        <section id="sessions" className="pub-sessions">
          <div className="pub-sessions-inner">
            <h2 className="pub-sessions-title">Session Information</h2>
            <h3 className="pub-sessions-subtitle">Trampoline and DMT</h3>
            <p className="pub-sessions-price">£6 per hour</p>
            <p className="pub-sessions-age">Age 5+</p>
            <p className="pub-sessions-body">
              Our recreation sessions are suitable for all ages and abilities and concentrate on
              developing beginner trampoline skills. Coaching is provided but there is a period where
              participants will be expected to practice the skills on their own. It's best if attendees
              have a degree of independence.
            </p>
            <p className="pub-sessions-body">
              Since the spaces in our sessions are limited we ask that people book in advance using our{' '}
              <a href="/booking" className="pub-sessions-link">booking system</a>. These sessions are
              first come first serve.
            </p>
            <div className="pub-sessions-grid">
              <div className="pub-sessions-day">
                <h4>Tuesday</h4>
                <p>5–6pm</p>
                <p>6–7pm</p>
              </div>
              <div className="pub-sessions-day">
                <h4>Wednesday</h4>
                <p>5–6pm</p>
                <p>6–7pm</p>
              </div>
              <div className="pub-sessions-day">
                <h4>Thursday</h4>
                <p>5–6pm</p>
                <p>6–7pm</p>
                <p>(16+ only) 7–8pm</p>
              </div>
            </div>
          </div>
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}
