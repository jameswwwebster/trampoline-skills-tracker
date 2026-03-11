import React from 'react';
import PublicNav from './PublicNav';
import PublicFooter from './PublicFooter';
import './public.css';

const BG_LINKS = [
  { label: 'Health, Safety and Welfare Policy', url: 'http://www.bg-insurance.org/Resources/Health-Safety-Welfare-Policy' },
  { label: 'Equality Policy', url: 'http://www.bg-insurance.org/Resources/Equality-Policy' },
  { label: 'Safeguarding and Protecting Children Policy', url: 'http://www.bg-insurance.org/Resources/Safeguarding-Protecting-Children-Policy' },
  { label: 'Anti-Doping Guidance', url: 'https://www.british-gymnastics.org/technical-information/performance-gymnastics/anti-doping' },
  { label: 'Jewellery, Body Piercing & Adornments Policy', url: 'http://www.bg-insurance.org/Resources/Jewellery-Body-Piercing-Adornments-Policy' },
  { label: 'Younger Persons Guide to Working Together', url: 'https://cdn3.british-gymnastics.org/images/safeguarding/20170522-Younger_persons_guide_to_Working_Together_2015.pdf' },
  { label: 'Good Practice Guidelines on the Use of Social Networking Sites', url: 'https://www.british-gymnastics.org/clubs/club-membership/document-downloads/safeguarding-compliance/welfare-officer-support/3466-bg-good-practice-guidelines-on-the-use-of-social-networking-sites/file' },
  { label: 'Safeguarding Children - Safe Environment', url: 'https://www.british-gymnastics.org/documents/departments/membership/safeguarding-compliance/safeguarding-and-protecting-children/7769-safeguarding-children-safe-environment-06-2016/file' },
  { label: 'Safeguarding Children - Recognising & Responding to Abuse & Poor Practice', url: 'https://www.british-gymnastics.org/coaching/coach-membership/document-downloads/safeguarding-compliance/safeguarding-and-protecting-children/5726-safeguarding-children-abuse-poor-practice/file' },
  { label: 'Safeguarding Children - Safe Recruitment', url: 'https://www.british-gymnastics.org/coaching/coach-membership/document-downloads/safeguarding-compliance/safeguarding-and-protecting-children/5723-safeguarding-children-safe-recruitment/file' },
  { label: 'Health, Safety and Welfare Guidance - Safe Trips', url: 'https://www.british-gymnastics.org/about-us-documents/7982-h-s-guidance-safe-trips/file' },
  { label: 'Safe Coaching', url: 'https://www.british-gymnastics.org/about-us-documents/7980-h-s-guidance-safe-coaching/file' },
  { label: 'Live Streaming Policy', url: 'https://www.trampoline.life/_files/ugd/010c39_c655cd31a8474713816f220a1571328e.pdf' },
  { label: 'Privacy Policy', url: 'https://www.trampoline.life/_files/ugd/010c39_8149752e3d6d4e8da8152830870077aa.pdf' },
];

export default function PublicPolicies() {
  return (
    <div className="public-page">
      <PublicNav />
      <main className="pub-main pub-policies-main">
        <div className="pub-policies-inner">
          <h1 className="pub-policies-page-title">Club Policies</h1>

          <section className="pub-policy-section">
            <h2>Coaches</h2>
            <p className="pub-policy-intro">Coaches and other club officials are expected to:</p>
            <ul>
              <li>Consider the welfare of participants before the development of performance.</li>
              <li>Develop an appropriate working relationship with performers based on mutual trust and respect.</li>
              <li>Hold appropriate, valid qualifications and insurance cover.</li>
              <li>Make sure all activities are suitable for the performers age, ability and experience and that the gymnast is both physically and psychologically prepared.</li>
              <li>Display consistent high standards of behaviour, dress and language.</li>
              <li>Obtain parental permission for all extracurricular activities (e.g. club bowling trip).</li>
              <li>Promote fair play and good sportsmanship.</li>
              <li>Never have performers stay overnight at your home.</li>
              <li>Immediately report any incidences of any kind of abuse.</li>
              <li>Never condone violence or the use of prohibited substances.</li>
            </ul>
          </section>

          <section className="pub-policy-section">
            <h2>Participants</h2>
            <p className="pub-policy-intro">All participants are expected to:</p>
            <ul>
              <li>Respect coaches and other club officials and their decisions.</li>
              <li>Keep to agreed timings for training and competitions or inform their coach if circumstances change.</li>
              <li>Inform the coaches of any illness or injury that would affect performance.</li>
              <li>Treat equipment and facilities with respect.</li>
              <li>Wear suitable attire for training. Long hair should be tied back and all jewellery removed.</li>
              <li>Pay any fees for training or events promptly.</li>
              <li>Refrain from smoking, consuming alcohol or other substances whilst representing the club.</li>
              <li>Respect fellow members and treat each other with dignity. Discrimination, bullying and other inappropriate behaviour will not be tolerated.</li>
              <li>Minors should remain with coaches at the end of a session until collected by their parent or guardian.</li>
            </ul>
          </section>

          <section className="pub-policy-section">
            <h2>Parents &amp; Guardians</h2>
            <p className="pub-policy-intro">Parents and Guardians are expected to:</p>
            <ul>
              <li>Encourage your child to participate without forcing them to take part.</li>
              <li>Help your child to recognise good individual performance, not just competition results.</li>
              <li>Lead by example in showing good sportsmanship and applauding all good performances.</li>
              <li>Ensure your child is dressed appropriately for the activity and has plenty to drink.</li>
              <li>Ensure coaches are aware of any illness or injury that may affect training.</li>
              <li>Use correct and proper language at all times.</li>
              <li>Never punish or belittle a child for poor performance or making mistakes.</li>
              <li>We request that parents remain nearby if your child is aged 8 or younger.</li>
              <li>Always collect your child promptly at the end of a session. If your child will be collected by somebody who does not normally pick them up, please make sure the coach in charge of the session is aware of this.</li>
              <li>If you wish to raise a concern about any aspect of the club procedures or regarding a specific incident please contact the Welfare Officer (contact details on the home page).</li>
            </ul>
          </section>

          <section className="pub-policy-section">
            <h2>Photography</h2>
            <ul>
              <li>No photography or video recording equipment including photo and video imaging phones may be used during training sessions.</li>
              <li>Coaches and other club officials may employ photography or videos on occasion for the purposes of promoting the club or as a coaching aid. You will be given the chance to opt out of this via your account on this site.</li>
              <li>Please be aware that competition venues may have their own photography and imagery policies.</li>
              <li>Imagery posted to social media may mention first names, but we will not tag minors in posts.</li>
            </ul>
          </section>

          <section className="pub-policy-section">
            <h2>Other Policies</h2>
            <p>
              Trampoline Life abides by British Gymnastics policies. Should you have any queries
              regarding policies, or concerns about welfare issues please contact the Club Welfare
              Officer.
            </p>
            <h3 className="pub-policy-subheading">British Gymnastics Policies</h3>
            <ul className="pub-policy-links">
              {BG_LINKS.map(({ label, url }) => (
                <li key={url}>
                  <a href={url} target="_blank" rel="noopener noreferrer">{label}</a>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}
