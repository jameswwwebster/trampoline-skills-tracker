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
            <div className="pub-hero-actions">
              <a href="/booking" className="pub-hero-cta">Book a session</a>
              <a href="/login" className="pub-hero-login">Log in →</a>
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

        {/* Team */}
        <section className="pub-section pub-team">
          <div className="pub-section-inner">
            <h2 className="pub-section-title" style={{ textAlign: 'center' }}>Meet the Team</h2>
            <div className="pub-team-grid">
              <div className="pub-team-card">
                <img src="/james-coach.png" alt="James" className="pub-team-photo" />
                <p className="pub-team-role">Lead Coach</p>
                <h3 className="pub-team-name">James</h3>
                <ul className="pub-team-quals">
                  <li>Trampoline: PC</li>
                  <li>DMT: HPC</li>
                  <li>Regional Judge</li>
                </ul>
              </div>
              <div className="pub-team-card">
                <img
                  src="https://static.wixstatic.com/media/010c39_065755d1a67a488f9578ad6d1f265f3e~mv2.png/v1/fill/w_475,h_475,al_c,lg_1,q_85,enc_avif,quality_auto/010c39_065755d1a67a488f9578ad6d1f265f3e~mv2.png"
                  alt="Leo"
                  className="pub-team-photo"
                />
                <p className="pub-team-role">Coach</p>
                <h3 className="pub-team-name">Leo</h3>
                <ul className="pub-team-quals">
                  <li>Trampoline Level 3.3</li>
                  <li>DMT Club Coach</li>
                  <li>Regional Judge</li>
                </ul>
              </div>
              <div className="pub-team-card">
                <img
                  src="https://static.wixstatic.com/media/010c39_4c6a1e1fa4ac4748a5bf2c12d6d492e6~mv2.jpg/v1/fill/w_506,h_506,al_c,q_80,usm_0.66_1.00_0.01,enc_avif,quality_auto/010c39_4c6a1e1fa4ac4748a5bf2c12d6d492e6~mv2.jpg"
                  alt="Lucy"
                  className="pub-team-photo"
                />
                <p className="pub-team-role">Coach</p>
                <h3 className="pub-team-name">Lucy</h3>
                <ul className="pub-team-quals">
                  <li>Trampoline Level 3.2</li>
                  <li>DMT Club Coach</li>
                </ul>
              </div>
              <div className="pub-team-card">
                <img
                  src="https://static.wixstatic.com/media/010c39_0dc74357e2cb4848806f93e84723d3b6~mv2.jpg/v1/fill/w_632,h_632,al_c,q_85,usm_0.66_1.00_0.01,enc_avif,quality_auto/010c39_0dc74357e2cb4848806f93e84723d3b6~mv2.jpg"
                  alt="Wendy"
                  className="pub-team-photo"
                />
                <p className="pub-team-role">Welfare Officer</p>
                <h3 className="pub-team-name">Wendy</h3>
                <a href="mailto:welfare@trampoline.life" className="pub-team-contact">welfare@trampoline.life</a>
              </div>
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
                <div className="pub-contact-item">
                  <p className="pub-contact-label">WhatsApp</p>
                  <a
                    href="https://wa.me/447700149040"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="pub-contact-whatsapp-btn"
                  >
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                    </svg>
                    Message us on WhatsApp
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
