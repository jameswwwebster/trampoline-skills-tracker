import React from 'react';
import PublicNav from './PublicNav';
import PublicFooter from './PublicFooter';
import './public.css';

export default function PublicHome() {
  return (
    <div className="public-page">
      <PublicNav />
      <main className="pub-main">
        {/* Hero */}
        <section className="pub-hero">
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

        {/* Welfare Officer */}
        <section className="pub-section pub-welfare">
          <div className="pub-section-inner pub-welfare-inner">
            <img
              src="https://static.wixstatic.com/media/010c39_0dc74357e2cb4848806f93e84723d3b6~mv2.jpg/v1/fill/w_632,h_632,al_c,q_85,usm_0.66_1.00_0.01,enc_avif,quality_auto/010c39_0dc74357e2cb4848806f93e84723d3b6~mv2.jpg"
              alt="Wendy — Welfare Officer"
              className="pub-welfare-photo"
            />
            <div className="pub-welfare-info">
              <p className="pub-welfare-title">Welfare Officer</p>
              <h2 className="pub-welfare-name">Wendy</h2>
              <a href="tel:07761185480" className="pub-welfare-phone">07761 185480</a>
            </div>
          </div>
        </section>

        {/* Sponsors */}
        <section className="pub-section pub-sponsors">
          <div className="pub-section-inner">
            <h2 className="pub-section-title" style={{ textAlign: 'center' }}>Our Sponsors</h2>
            <div className="pub-sponsors-list">
              <a
                href="https://www.britishengines.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="pub-sponsor-link"
              >
                <img
                  src="https://static.wixstatic.com/media/010c39_504658f1638c4a6283d58ff8a756e724~mv2.jpg/v1/fill/w_340,h_340,al_c,q_80,usm_0.66_1.00_0.01,enc_avif,quality_auto/329757191_1482935178903653_4558575537921607617_n_jpg__nc_cat%3D110%26ccb%3D1-7%26_nc_sid%3D6ee11a%26_n.jpg"
                  alt="British Engines"
                  className="pub-sponsor-logo"
                />
              </a>
            </div>
          </div>
        </section>

        {/* Contact */}
        <section className="pub-section pub-contact">
          <div className="pub-section-inner">
            <h2 className="pub-section-title">Contact Us</h2>
            <div className="pub-contact-grid">
              <div className="pub-contact-details">
                <div className="pub-contact-item">
                  <p className="pub-contact-label">Address</p>
                  <address className="pub-contact-address">
                    Sport@Kenton<br />
                    Kenton Lane<br />
                    NE3 3RU
                  </address>
                </div>
                <div className="pub-contact-item">
                  <p className="pub-contact-label">Email</p>
                  <a href="mailto:contact@trampoline.life" className="pub-contact-email">
                    contact@trampoline.life
                  </a>
                </div>
              </div>
              <div className="pub-contact-map">
                <iframe
                  title="Trampoline Life location"
                  src="https://maps.google.com/maps?q=Sport+at+Kenton,+Kenton+Lane,+Newcastle,+NE3+3RU&output=embed"
                  width="100%"
                  height="300"
                  style={{ border: 0, borderRadius: '8px' }}
                  allowFullScreen=""
                  loading="lazy"
                />
              </div>
            </div>
          </div>
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}
