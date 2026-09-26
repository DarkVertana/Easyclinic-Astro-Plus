# EasyClinic brand and chrome extraction (live site vs staging)

The live site's real palette is blue `#0080F6`, teal `#04BDAF` and navy `#0A2540`, and it uses 4 fonts. The staging build has kept the colours but switched to a single font (Inter). There is no SVG logo on the live site, only PNGs. None of the footer, header or `/contact-us/` pages link a G2 badge.

All facts come from `curl -sL` of the raw HTML/CSS on 2026-09-26. Every fetch returned 200. Nothing was written to disk.

- **Live homepage:** https://www.easyclinic.io/ (WordPress, Astra 4.13.8, Elementor 4.3.2, LiteSpeed-optimised CSS)
- **Kit CSS (global tokens):** https://www.easyclinic.io/wp-content/litespeed/css/c5e44bb29c53f80ee0bdc7c366cb8230.css (`.elementor-kit-8`)
- **Header CSS:** …/litespeed/css/7cffd3d5b1092ebfbfbb938390f5d3f6.css (template 122)
- **Footer CSS:** …/litespeed/css/b77f898fa24f4e049eef920e64d6c392.css (template 131)
- **Homepage CSS:** …/litespeed/css/f725f0d22165bd49801700d57485d9a8.css (post 29413)

---

## 1. Live palette

Colours are ranked by how often they appear in the homepage, header, footer and kit CSS. "Refs" counts literal hex values plus `var(--e-global-color-*)` uses.

| Rank | Hex | Elementor global / role | Where it is used | Refs |
|---|---|---|---|---|
| 1 | `#0080F6` | `--e-global-color-accent` | Default button background, all links, header BOOK A DEMO, LOGIN ghost border/text, menu hover/active, mobile menu CTA, mega-menu icon tile background | ~20 literal + 17 var + 8 inline |
| 2 | `#000000` | `--e-global-color-primary` | h1–h6 and form label colour | 26 var |
| 3 | `#F2B01E` | (literal) | Testimonial star ratings | 45 |
| 4 | `#474747` | (literal) | `.elementor-image-box-title` on the homepage (feature box titles) | 25 |
| 5 | `#005BB0` | `--e-global-color-efde536` | Button hover/focus background, LOGIN hover, start/end of section gradients | 12 literal + 5 var |
| 6 | `#04BDAF` | `--e-global-color-secondary` | Section gradients: `linear-gradient(181deg,#005BB0 0%,#04BDAF 100%)` and `180deg #04BDAF→#005BB0`. Also the teal in the logo | 12 var + 4 literal |
| 7 | `#181818` | `--e-global-color-text` | Body text, nav item text, input text | 9 var + 5 literal |
| 8 | `#6B6B6B` | (literal) | Testimonial company/role text | 9 |
| 9 | `#FFFFFF` | `astglobalcolor5` | Header background, text on buttons, footer headings | many |
| 10 | `#FFB33E` | `--e-global-color-e3d254c` | Accent (homepage) | 4 var |
| 11 | `#F36A34` | `--e-global-color-8113212` | Accent (homepage) | 2 var |
| 12 | `#F95E56` | `--e-global-color-089295a` | Accent (homepage) | 1 var |
| — | `#090727` | (literal) | Footer background | footer |
| — | `#FFF9` (white at 60%) / `#FFFFFF24` | (literal) | Footer body text and link text / footer divider | footer |
| — | `#B5E1FF`, `#EFF7FF` | (literal) | Light-blue section backgrounds | homepage |
| — | `#FFF3EE` | (literal) | Inactive tab background (nested tabs) | homepage |
| — | `#6ED399` | (literal) | Check-list icons | 4 |
| — | `#3B99E8 → #1DC9A4` | (literal gradient) | "Cura AI" nav text gradient and the "NEW" pulse badge. Hover gradient is `#2477BF → #14A685` | header / custom CSS |
| — | `#425466` | inline style | Hero ratings line ("★ 4.9 Capterra · 4.8 Google…") | 1 |
| — | `#E7E7E7` | kit | Input border (1px, radius 8px) | kit |
| — | `#C13584`, `#3F3F3F` | (literal) | Footer social icon backgrounds: Instagram and X | footer |
| — | `#25D366` | (literal) | WhatsApp floating button | 1 |

**Defined in the kit but not referenced in the homepage, header or footer CSS I checked:** `#57D68D` (51cfb2a), `#FBE454` (89b7af2, appears 3× in the HTML), `#4C4F52` (01038b5), `#00C554` (c1e5fbe), `#0D8A6A` (0fe9097).

**Astra theme globals** (defaults, mostly unused): `#046bd2`, `#045cb4`, `#1e293b`, `#334155`, `#F0F5FA` (astglobalcolor4, 3 refs), `#FFFFFF`, `#ADB6BE`, `#111111`.

**Logo colours** (decoded from the PNG palette of `footer-logo-img-1.png`): wordmark navy `#0A2540`, blue `#3699FF`, teal `#04BDAF`.

**Kit component rules:**
- **Buttons:** background `#0080F6`, text white, Poppins 600 16px, radius 8px, padding 16px 38px. Hover background is `#005BB0`.
- **Containers:** max width 1280px (1024px on tablet, 767px on mobile).

## 2. Live fonts

Source: kit CSS plus the `<link>` tags in the homepage HTML.

| Role | Family | Size, weight, line height |
|---|---|---|
| h1 | Varela Round 600, colour `#000` | 60px/1em (tablet 52, mobile 32). A custom CSS rule forces mobile h1 to 32px/42px `!important` |
| h2 | Varela Round 600 | 47/1.2 (tablet 44, mobile 32) |
| h3 | Varela Round 600 | 40 (tablet 36, mobile 32) |
| h4 | Varela Round 600 | 27 (mobile 24) |
| h5 | Varela Round 600 | 21 (tablet 19, mobile 17) |
| h6 | Varela Round 600 | 17 |
| Extra heading style | Varela Round 600 | 52/1.2 (tablet 42, mobile 32) |
| Body (`--e-global-typography-text`) | Poppins 400 | 19px/32px (tablet 16, mobile 17/1.4em) |
| Buttons, labels, inputs (accent) | Poppins 600 | 16px (15 on tablet/mobile) |
| Style 9f3fa8c | Poppins 400 | 16px/25px |
| Secondary | Plus Jakarta Sans 500 | — |
| Plus Jakarta Sans styles | Plus Jakarta Sans 600 | 16/1em, 15/1em, 16, 26/1.6em, and 65/1em for stat numbers (tablet 56, mobile 50). Footer links use 15px/600 |
| Paragraph styles | Open Sans 400 | 18px/1.7em and 14px/1.7em (footer copyright) |

**How fonts are loaded:** Google Fonts CSS v1 `<link>`s, all weights 100–900 including italics, `display=swap`:
- `https://fonts.googleapis.com/css?family=Plus+Jakarta+Sans:100,…900italic&display=swap`
- `https://fonts.googleapis.com/css?family=Varela+Round:…&display=swap`
- `https://fonts.googleapis.com/css?family=Open+Sans:…&display=swap`

**Poppins is never loaded.** There is no Google Fonts link or `@font-face` for it in any homepage stylesheet. The only related file is `trustindex-google-widget.css`, which defines its own "Trustindex Poppins". Visitors without Poppins installed see the generic sans-serif fallback.

## 3. Live logo, favicon and OG assets

| Asset | URL | Size |
|---|---|---|
| Main logo (header, also the JSON-LD logo) | https://www.easyclinic.io/wp-content/uploads/2023/12/footer-logo-img-1.png | 400×79 PNG, 2.4 KB |
| Smaller variant | …/uploads/2023/12/footer-logo-img-1-300x59.png | 300×59 |
| White logo | https://www.easyclinic.io/wp-content/uploads/2026/05/easyclinic-logo-WHITE.png | 400×79. Only injected by JS on page-id-95040 |
| Icon mark master | https://www.easyclinic.io/wp-content/uploads/2023/12/footer-logo-img.png | 600×595 |
| Favicon 32 | …/uploads/2023/12/cropped-footer-logo-img-32x32.png | 32×32 |
| Favicon 192 | …/uploads/2023/12/cropped-footer-logo-img-192x192.png | 192×192 |
| Apple touch icon | …/uploads/2023/12/cropped-footer-logo-img-180x180.png | 180×180 (blue `#3699FF` and teal `#04BDAF`) |
| msapplication-TileImage | …/uploads/2023/12/cropped-footer-logo-img-270x270.png | 270×270 |
| `/favicon.ico` | https://www.easyclinic.io/favicon.ico | Actually a 32×32 PNG |
| og:image / twitter:image | https://www.easyclinic.io/wp-content/uploads/2026/05/image-4.png | 820×312, alt "Social Image" |
| JSON-LD primaryImageOfPage | …/uploads/2025/06/5.webp | Hero image, 603×613 |

- No SVG logo exists anywhere on the homepage.
- Twitter: `twitter:site` and `twitter:creator` are both `@easyclinic`, `twitter:card` is `summary_large_image`.
- `og:site_name` is "Easy Clinic".

## 4. Live header navigation

The header is white (`#FFF`) and sticky. Desktop uses an Elementor nested mega menu.

1. **Cura AI** → /curapilot/ (gradient text plus an animated "NEW" pill)
2. **Features** (dropdown, not a link). Each item has a 256×256 PNG icon on a `#0080F6` tile (radius 5px).
   - Individual Doctor & Specialist Clinic → /doctor-clinic-software/
   - Group Practice & Polyclinic → /polyclinic-software/
   - Multi-Location Clinic Chain → /clinic-chain-software/
   - Hospital OPD & Nursing Home → /hospital-opd-nursing-home-software/
   - [ALL FEATURES] → /features/
   - Patient Engagement → /patient-engagement-at-easyclinic/
   - Reports and Dashboards → /reports-and-dashboards/
   - Payor Management → /payor-management/
   - Revenue Management → /revenue-management/
   - Appointment Scheduling → /appointment-scheduling-at-easy-clinic/
3. **Pricing** → /pricing/
4. **About us** → /about-us/
5. **Resources** (dropdown)
   - Blogs → /blogs/
   - Knowledgebase → **https://help.easyclinic.io/** (the mobile menu uses /knowledgebase/ instead)
   - Testimonials → /testimonials/
6. **Contact us** → /contact-us/

**CTA buttons:**
- **BOOK A DEMO** → /contact-us/#demo-form. Solid `#0080F6`, 1px `#0080F6` border, radius 8px, padding 12px 22px, 16px text.
- **LOGIN** → https://app.easyclinic.io/. White background with `#0080F6` text and border. On hover the background turns `#005BB0` with white text.

**Mobile drawer** has the same links, grouped as "Features" and "Resources", with slightly different labels ("Individual Doctor Clinic", "Multi Location Clinic Chain", "Reports & Dashboards", "All Features", "About Us", "Contact Us"). At the bottom, Book a Demo is a solid `#0080f6` pill and Login is a white pill with a 2px `#0080f6` border.

**Menu icon URLs** (all under `https://www.easyclinic.io/wp-content/uploads/`):
- 2023/12/: doctor.png, group.png, feature-selection.png, patient.png, monitor.png, hand.png, increase.png, appointment.png, blog-writer.png, guidelines-1.png, testimonial.png
- 2024/01/: doctor.png, hospital.png

## 5. Live footer

Footer background is `#090727` with top padding of 80px. Group headings are Varela Round 21px white. Links are Plus Jakarta Sans 15/600 in white at 60%.

- **Brand block:** a "Easy Clinic" heading plus 2 description paragraphs, then "Connect with us:" and the social links:
  - Facebook: https://www.facebook.com/Easycliniconline/
  - X: https://twitter.com/easyclinic (JSON-LD uses https://x.com/easyclinic)
  - LinkedIn: https://www.linkedin.com/company/easy-clinic/
  - Instagram: https://instagram.com/easycliniconline
  - YouTube: https://www.youtube.com/@EasyClinicSoftware
- **Features by Clinic Type:**
  - Individual Doctor / Specialist Clinic → /doctor-clinic-software/
  - Group Practice / Polyclinic → /polyclinic-software/
  - Multi-Location Clinic Chain → /clinic-chain-software/
  - Hospital OPD → /hospital-opd-nursing-home-software/
  - Nursing Home → the same URL as Hospital OPD
  - ALL FEATURES → /features/
- **Features by Modules:**
  - Patient Engagement → /patient-engagement-at-easyclinic/
  - Reports and Dashboards → /reports-and-dashboards/
  - Payor Management → /payor-management/
  - Revenue Management → /revenue-management/
  - Appointment Scheduling → /appointment-scheduling-at-easy-clinic/
- **Speciality (36 links):**
  - Allergy → /allergy-emr-software (no trailing slash)
  - Aesthetic → /aesthetic-emr-software/
  - Alternative Medicine → /alternative-medicine/
  - Ayurveda → /ayurveda-emr-software/
  - Cardiology → /cardiology-emr/
  - Cosmetology → /cosmetology-emr-software/
  - Dentist → /dental-emr-software/
  - Dermatology → /dermatology-emr-software/
  - Diabetology → /diabetology-emr-software/
  - Endocrinology → /endocrinology-emr-software/
  - ENT → /ent-emr-software/
  - Family Physician → /family-physician-emr/
  - Gastroenterology → /gastroenterology/
  - General Practitioner → /general-practitioner-emr/
  - Hematology → /hematology-emr/
  - Immunology → /immunology-emr/
  - IVF → /ivf-emr/
  - Nephrology → /nephrology-emr/
  - Neurology → /neurology-emr/
  - Obstetrics and Gynaecology → /obgyn-emr-software/
  - Oncology → /oncology-emr/
  - Ophthalmology → /ophthalmology-emr/
  - Orthopedics → /orthopedic-emr/
  - Otolaryngology (ENT) → /ent/
  - Pediatrics → /pediatric/
  - Pathology → /pathology-emr/
  - Physiotherapy → /physiotherapy-emr/
  - Psychiatry → /psychiatry-emr-software/
  - Psychology → /psychology-emr/
  - Pulmonology → /pulmonology-emr/
  - Radiology → /radiology-emr/
  - Rheumatology → /rheumatology-emr/
  - Sexology → /sexology-emr/
  - Surgery → /general-surgery-emr/
  - Trichology → /trichology-emr/
  - Urology → /urology-emr/
- **Company:**
  - About Us → /about-us/
  - Careers → /careers/
  - Blogs → /blogs/
  - Easy Clinic AI → /ai/
  - Knowledgebase → /knowledgebase/
  - Pricing → /pricing/
  - Doctors → /doctors/
  - Contact Us → /contact-us/
  - Support → /contact-us/
  - Partner with us → /partner-with-ec/
  - Custom Healthcare Software Development → /custom-healthcare-software-development/
- **Trustindex badge:** "4.8 Top Rated Service 2026 verified by Trustindex" (Google reviews).
  - Link: https://www.trustindex.io/?a=sys&c=wp-top-rated-badge&url=/the-trustindex-verified-badge/
  - Icons: https://cdn.trustindex.io/assets/platform/Google/icon.svg and https://cdn.trustindex.io/assets/platform/Google/star/f.svg
- **Legal line:** "© 2026 Novel Medicare Solutions Pvt Ltd | Privacy Policy (/privacy-policy/) | Terms of Service (/terms-of-service/)"
- **Not in the footer:** no address, phone or email.

## 6. Contact details (live)

| Item | Value | Source |
|---|---|---|
| Legal entity | Novel Medicare Solutions Pvt Ltd | Footer |
| Email | hello@easyclinic.io | /contact-us/, homepage FAQ ("Contact support at") |
| Phone | +91 91477 70277 (`tel:+91 91477 70277`) | /contact-us/, JSON-LD contactPoint (customer service) |
| Address | 30 Circus Avenue, Kolkata - 700 017, India | https://www.easyclinic.io/contact-us/ |
| WhatsApp | `https://api.whatsapp.com/send?phone=919147770277&text=Hi%2C+I+was+browsing+your+website+and+I+want+to+know+more+about+Easy+Clinic.` | Floating 60px round button, sitewide |
| Kenya contact | +254 750 184 357, walter@easyclinic.io | Injected by JS only on page-id-95040 |
| App login | https://app.easyclinic.io/ | Header |
| Help centre | https://help.easyclinic.io/ | Header |

## 7. Review badges and trust logos (live)

- **Homepage hero text:** "★ 4.9 Capterra · 4.8 Google | 5000+ doctors · 18 countries · Since 2003". It has no links and is coloured `#425466`.
- **/testimonials/** (https://www.easyclinic.io/testimonials/) has these badges:

| Badge | Image | Links to |
|---|---|---|
| Capterra | https://brand-assets.capterra.com/badge/8cd98050-a66a-47c3-804d-2d6207c410ff.svg | https://www.capterra.com/p/10026882/Easy-Clinic/reviews/ |
| GetApp | https://brand-assets.getapp.com/badge/214f0d10-1648-440a-9863-b8cd2b831b4e.png | https://www.getapp.com/healthcare-pharmaceuticals-software/a/easy-clinic/reviews/ |
| Award SVG | …/uploads/2025/05/e9072545-49b2-4167-a7ff-28caf990b6b1.svg (669×625) | capterra.com/p/10026882/Easy-Clinic/ |
| Award SVG | …/uploads/2025/05/bd0658e0-b95f-4bbb-9ea4-c0db42bc0fd9.svg (800×625) | capterra.com/p/10026882/Easy-Clinic/ |
| Award SVG | …/uploads/2025/05/13195c27-f3c6-4a02-b25f-11684b5daeea.svg (800×625) | getapp.com/healthcare-pharmaceuticals-software/a/easy-clinic/ |
| Award PNG | …/uploads/2025/05/0162bf71-f327-443a-a3d3-de7420649f42.png (507×205) | https://www.softwareadvice.com/product/525635-Easy-Clinic/reviews/ |

- **No G2 badge** on the homepage, /testimonials/, /pricing/, /about-us/, /features/ or /curapilot/.
- **Other trust logos:**
  - SiliconIndia: https://www.easyclinic.io/wp-content/uploads/2026/08/siliconindia-1024x267.webp (also 768w and 2048w versions), links to /siliconindia/
  - Client logos under `…/uploads/2024/01/*a.jpg`: Caring Minds, German Osteo, Premier Hospital, Samonnoy Clinic, Sri Swasthyaa Clinic, Dayanand Education Society, FLAME University, Hand in Hand India, Prashanthi Super Clinic, Ross Clinics, Seth GS KEM Hospital, The Dale View, and several doctors
  - Data security image: …/uploads/2026/07/data-security.avif

---

## 8. Staging (https://staging-easyclinic.vercel.app/) and how it differs

Sources: the homepage HTML, `/_astro/Header.D9MAy_DW.css`, and `/_astro/index.Xsf269Ja.css` (empty of custom properties). The generator tag says **Astro v7.2.1**, not 7.3.5.

**`:root` tokens on staging**, with usage counts:

| Token | Hex | Refs | Used for |
|---|---|---|---|
| `--brand-blue` | `#0080f6` | 36 | Solid and ghost buttons, hovers, "more" links |
| `--brand-blue-dark` | `#006fd4` | — | Button hover. **Live uses `#005BB0`** |
| `--brand-teal` | `#04bdaf` | 6 | — |
| `--navy` | `#0a2540` | 39 | Headings, promo card, social hover. On live this colour is only in the logo wordmark, not the CSS |
| `--ink` | `#181818` | — | Text (same as live `text`) |
| `--muted` | `#474747` | 28 | Muted text |
| `--brand-amber` | `#f2b01e` | — | Stars |
| `--brand-red` | `#fb2c36` | — | — |
| `--surface` | `#fff` | — | — |
| `--surface-tint` | `#eff6ff` | — | — |
| `--border` | `#e5e7eb` | — | — |
| `--brand-wash` | `#e9f3fe` | — | Header and footer panel background |
| `--brand-wash-deep` | `#d7e8fc` | — | Banner and social icon background |
| `--page-max` | `1320px` | — | Live container is 1280px |

**Leftovers from the Astro blog starter:**
- `--accent: #2337ff` and `--accent-dark: #000d8a`. The global rule `a, a:hover { color: var(--accent) }` means default links are `#2337ff`, not brand blue.
- The body uses `rgb(var(--gray-dark))` (34, 41, 57), and h1–h6 use `rgb(var(--black))` (15, 18, 25) with a starter size scale (3.052em and down).

**Colour differences from live:**
- Staging has no Varela Round or Poppins look.
- The footer is light (`#e9f3fe` panel) on staging vs dark `#090727` on live.
- Headings are navy `#0a2540` vs black on live.
- Accent colours `#FFB33E`, `#F36A34` and `#F95E56` are missing on staging.
- Other hex values on staging: `#ff9d28`, `#e54747`, `#68c5ed`, `#044d80` (illustrations), and the Google logo colours `#4285f4`, `#34a853`, `#fbbc05`, `#ea4335`.

**Fonts:** Inter only, self-hosted through Astro's font system (`/_astro/fonts/e868cdf4720e9ea5.woff2`, preloaded), weights 400/500/600/700, with metric-adjusted Arial fallbacks. None of Varela Round, Poppins, Plus Jakarta Sans or Open Sans is used.

**Logo and icons:**
- Header and footer logo: `/_astro/footer-logo-img-1.D23z_hg-_Z2cOIiG.webp`, rendered at 182×36. It is converted from the live PNG. No SVG.
- `/favicon.ico` (a real ICO, 32×32), `/favicon-32.png`, `/favicon-192.png`, `/apple-touch-icon.png` (180×180). All return 200.

**Head and meta problems:**
- `canonical` and `og:url` both point to https://www.easyclinic.io/.
- **og:image is `https://www.easyclinic.io/_astro/blog-placeholder-1.Bx0Zcyzv.jpg`, which returns 404 on the live domain.** It is also a starter placeholder, not the live `image-4.png`.
- There are no twitter:site or creator tags.

**Header differences:**
- Background is `#e9f3fe` with a banner: "Ready to see EasyClinic in action? Book a demo of our AI EMR today."
- Clinic-type links move from `/doctor-clinic-software/` style to `/solutions/doctor-clinic`, `/solutions/polyclinic`, `/solutions/clinic-chain`, `/solutions/hospital-opd`.
- No trailing slashes anywhere.
- Knowledgebase goes to /knowledgebase, not help.easyclinic.io.
- The Features flyout adds a promo card: "See EasyClinic live — A free 30-minute demo on your own workflows" → /contact-us#demo-form.
- CTAs are "Book a Demo" → /contact-us#demo-form and "Login" → https://app.easyclinic.io/.

**Footer differences:**
- Tagline: "Helping healthcare practices run smoothly and grow confidently since 2003."
- Same 5 social URLs.
- The columns are regrouped:
  - **Product:** /features, /appointment-scheduling-at-easy-clinic, /patient-engagement-at-easyclinic, /reports-and-dashboards, /payor-management, /revenue-management, /curapilot, /ai, /pricing
  - **Solutions:** the 4 /solutions/* pages, /dental-emr-software, /dermatology-emr-software, **/pediatric-emr** (live is /pediatric/), /cardiology-emr, **/mental-health** (not on live), /resources#specialties
  - **Markets:** /emr-software-in-{india,kenya,uae,nigeria,malaysia}, /best-clinic-management-software-{india,kenya}, /easyclinic-vs-practo, /easyclinic-vs-healthplix, /resources#comparisons
  - **Resources:** /resources, /blogs, /knowledgebase, /testimonials, /doctors, /partner-with-ec
  - **Company:** /about-us, /custom-healthcare-software-development, /careers, /contact-us, /contact-us#demo-form
- Legal line: "© 2026 Novel Medicare Solutions Pvt Ltd. All rights reserved." Legal links are **/privacy** and **/terms**, while live uses /privacy-policy/ and /terms-of-service/.
- The staging footer has no Trustindex badge, no 36-item speciality list, and no phone, email, address or WhatsApp.

**Ratings:** the only rating is the text "Rated 4.9 on Capterra by doctors who use it daily", plus a Google rating label. No badge images or review-site links. The homepage has no tel:, mailto: or WhatsApp links.