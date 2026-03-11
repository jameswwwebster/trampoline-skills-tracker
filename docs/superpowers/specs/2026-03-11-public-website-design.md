# Public Website Design Spec

## Goal

Add a public-facing website at `trampoline.life` — homepage and club policies page — hosted within the existing React app, replacing the current Wix site.

## Architecture

Two new public routes added to React Router before the auth wrapper: `/` (PublicHome) and `/policies` (PublicPolicies). No authentication required. The public pages share the existing design system (CSS variables, fonts, colours) but have their own nav and footer — no app sidebar or auth navigation.

## Tech Stack

React 18, React Router v6, existing CSS variables/design tokens. All content is static (no DB queries). Images served directly from Wix CDN URLs for now.

## Responsive Design

All pages must look good on both mobile and desktop. Mobile-first approach: single-column layout on small screens, expanding to multi-column where appropriate (e.g. session day grid, contact section with map). The nav collapses to a hamburger menu on mobile. Minimum supported width: 320px.

---

## File Structure

| File | Purpose |
|---|---|
| `frontend/src/pages/public/PublicNav.js` | Shared nav: brand, links, social icons, CTA button |
| `frontend/src/pages/public/PublicFooter.js` | Shared footer: copyright, social links |
| `frontend/src/pages/public/PublicHome.js` | Homepage — all sections |
| `frontend/src/pages/public/PublicPolicies.js` | Club policies page |
| `frontend/src/pages/public/public.css` | Public-site layout styles (imports existing CSS vars) |

Routing: modify `frontend/src/App.js` (or wherever routes are defined) to add `/` and `/policies` as public routes.

---

## PublicNav

- **Background:** `#1a1a2e` (dark)
- **Left:** "Trampoline Life" brand/logo
- **Centre:** text links — Sessions (smooth-scrolls to session section on homepage, or `/` on other pages) · Policies (`/policies`) · Shop (external SumUp link — placeholder URL, to be filled in)
- **Right:** social icons (Instagram, TikTok, Facebook, WhatsApp) + "Book a session" CTA button in purple (`#7c35e8`)
- Social icon URLs: placeholders — to be configured with real profile URLs

---

## Homepage Sections (in order)

### 1. Hero

- Full-width background image: `https://static.wixstatic.com/media/010c39_6310c1e27ecf44e199e0055176fcbb5a~mv2.png/v1/crop/x_0,y_9,w_1080,h_383,q_90,enc_avif,quality_auto/010c39_6310c1e27ecf44e199e0055176fcbb5a~mv2.png`
- Dark overlay for text legibility
- **Headline:** "The only <purple>trampoline</purple> and <purple>DMT</purple> club in Newcastle" — the words "trampoline" and "DMT" rendered in `#7c35e8`
- **Body:** "Trampoline Life offers recreational and competitive Trampoline and DMT training from qualified coaches in a safe environment. Come along and try it out for yourselves; young or old, everybody is welcome!"
- **CTA button:** "Book a session" — links to `/booking`

### 2. Session Information

- Dark background (matching original Wix design — `#1a1a2e` or similar)
- Section title: "Session Information"
- Sub-heading: "Trampoline and DMT"
- Price: "£6 per hour" in purple (`#7c35e8`)
- Age note: "Age 5+"
- Paragraph 1: "Our recreation sessions are suitable for all ages and abilities and concentrate on developing beginner trampoline skills. Coaching is provided but there is a period where participants will be expected to practice the skills on their own. It's best if attendees have a degree of independence."
- Paragraph 2: "Since the spaces in our sessions are limited we ask that people book in advance using our [booking system](/booking). These sessions are first come first serve."
- Three-column day/time grid:
  - **Tuesday:** 5–6pm, 6–7pm
  - **Wednesday:** 5–6pm, 6–7pm
  - **Thursday:** 5–6pm, 6–7pm, (16+ only) 7–8pm

### 3. Welfare Officer

- Photo: `https://static.wixstatic.com/media/010c39_0dc74357e2cb4848806f93e84723d3b6~mv2.jpg/v1/fill/w_632,h_632,al_c,q_85,usm_0.66_1.00_0.01,enc_avif,quality_auto/010c39_0dc74357e2cb4848806f93e84723d3b6~mv2.jpg`
- Name: **Wendy**
- Title: Welfare Officer
- Phone: `07761 185480` as a `tel:` link

### 4. Sponsors

- Section title: "Our Sponsors"
- British Engines logo: `https://static.wixstatic.com/media/010c39_504658f1638c4a6283d58ff8a756e724~mv2.jpg/v1/fill/w_340,h_340,al_c,q_80,usm_0.66_1.00_0.01,enc_avif,quality_auto/329757191_1482935178903653_4558575537921607617_n_jpg__nc_cat%3D110%26ccb%3D1-7%26_nc_sid%3D6ee11a%26_n.jpg`
- Logo links to `https://www.britishengines.com/`
- Alt text: "British Engines"

### 5. Contact Us

- Address: Sport@Kenton, Kenton Lane, NE3 3RU
- Email: `contact@trampoline.life` as a `mailto:` link
- Embedded Google Map centred on Sport@Kenton, Kenton Lane, NE3 3RU (iframe embed)

---

## Policies Page (`/policies`)

Uses PublicNav and PublicFooter. Five sections, all open by default (no accordion).

### Coaches

**Coaches and other club officials are expected to:**
- Consider the welfare of participants before the development of performance.
- Develop an appropriate working relationship with performers based on mutual trust and respect.
- Hold appropriate, valid qualifications and insurance cover.
- Make sure all activities are suitable for the performers age, ability and experience and that the gymnast is both physically and psychologically prepared.
- Display consistent high standards of behaviour, dress and language.
- Obtain parental permission for all extracurricular activities (e.g. club bowling trip).
- Promote fair play and good sportsmanship.
- Never have performers stay overnight at your home.
- Immediately report any incidences of any kind of abuse.
- Never condone violence or the use of prohibited substances.

### Participants

**All participants are expected to:**
- Respect coaches and other club officials and their decisions.
- Keep to agreed timings for training and competitions or inform their coach if circumstances change.
- Inform the coaches of any illness or injury that would affect performance.
- Treat equipment and facilities with respect.
- Wear suitable attire for training. Long hair should be tied back and all jewellery removed.
- Pay any fees for training or events promptly.
- Refrain from smoking, consuming alcohol or other substances whilst representing the club.
- Respect fellow members and treat each other with dignity. Discrimination, bullying and other inappropriate behaviour will not be tolerated.
- Minors should remain with coaches at the end of a session until collected by their parent or guardian.

### Parents & Guardians

**Parents and Guardians are expected to:**
- Encourage your child to participate without forcing them to take part.
- Help your child to recognise good individual performance, not just competition results.
- Lead by example in showing good sportsmanship and applauding all good performances.
- Ensure your child is dressed appropriately for the activity and has plenty to drink.
- Ensure coaches are aware of any illness or injury that may affect training.
- Use correct and proper language at all times.
- Never punish or belittle a child for poor performance or making mistakes.
- We request that parents remain nearby if your child is aged 8 or younger.
- Always collect your child promptly at the end of a session. If your child will be collected by somebody who does not normally pick them up, please make sure the coach in charge of the session is aware of this.
- If you wish to raise a concern about any aspect of the club procedures or regarding a specific incident please contact the Welfare Officer (contact details on the home page).

### Photography

- No photography or video recording equipment including photo and video imaging phones may be used during training sessions.
- Coaches and other club officials may employ photography or videos on occasion for the purposes of promoting the club or as a coaching aid. You will be given the chance to opt out of this via your account on this site.
- Please be aware that competition venues may have their own photography and imagery policies.
- Imagery posted to social media may mention first names, but we will not tag minors in posts.

### Other Policies

Trampoline Life abides by British Gymnastics policies. Should you have any queries regarding policies, or concerns about welfare issues please contact the Club Welfare Officer.

**British Gymnastics Policies:**
- [Health, Safety and Welfare Policy](http://www.bg-insurance.org/Resources/Health-Safety-Welfare-Policy)
- [Equality Policy](http://www.bg-insurance.org/Resources/Equality-Policy)
- [Safeguarding and Protecting Children Policy](http://www.bg-insurance.org/Resources/Safeguarding-Protecting-Children-Policy)
- [Anti-Doping Guidance](https://www.british-gymnastics.org/technical-information/performance-gymnastics/anti-doping)
- [Jewellery, Body Piercing & Adornments Policy](http://www.bg-insurance.org/Resources/Jewellery-Body-Piercing-Adornments-Policy)
- [Younger Persons Guide to Working Together](https://cdn3.british-gymnastics.org/images/safeguarding/20170522-Younger_persons_guide_to_Working_Together_2015.pdf)
- [Good Practice Guidelines on the Use of Social Networking Sites](https://www.british-gymnastics.org/clubs/club-membership/document-downloads/safeguarding-compliance/welfare-officer-support/3466-bg-good-practice-guidelines-on-the-use-of-social-networking-sites/file)
- [Safeguarding Children - Safe Environment](https://www.british-gymnastics.org/documents/departments/membership/safeguarding-compliance/safeguarding-and-protecting-children/7769-safeguarding-children-safe-environment-06-2016/file)
- [Safeguarding Children - Recognising & Responding to Abuse & Poor Practice](https://www.british-gymnastics.org/coaching/coach-membership/document-downloads/safeguarding-compliance/safeguarding-and-protecting-children/5726-safeguarding-children-abuse-poor-practice/file)
- [Safeguarding Children - Safe Recruitment](https://www.british-gymnastics.org/coaching/coach-membership/document-downloads/safeguarding-compliance/safeguarding-and-protecting-children/5723-safeguarding-children-safe-recruitment/file)
- [Health, Safety and Welfare Guidance - Safe Trips](https://www.british-gymnastics.org/about-us-documents/7982-h-s-guidance-safe-trips/file)
- [Safe Coaching](https://www.british-gymnastics.org/about-us-documents/7980-h-s-guidance-safe-coaching/file)
- [Live Streaming Policy](https://www.trampoline.life/_files/ugd/010c39_c655cd31a8474713816f220a1571328e.pdf)
- [Privacy Policy](https://www.trampoline.life/_files/ugd/010c39_8149752e3d6d4e8da8152830870077aa.pdf)

---

## PublicFooter

- © Trampoline Life (current year)
- Social links: Instagram, TikTok, Facebook, WhatsApp

---

## Open Placeholders

- Shop link URL (SumUp — to be added before go-live)
- Social media profile URLs (Instagram, TikTok, Facebook, WhatsApp — to be configured)
