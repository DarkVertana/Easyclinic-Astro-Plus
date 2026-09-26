# EasyClinic live URL inventory for the redirect map and blog pruning

Checked 2026-09-26 with `curl`. Every URL on live is `https://www.easyclinic.io`, and all paths below are relative to it.

Most important finding: the live site publishes **two sitemap sets**. The one listed in robots.txt is stale (last updated 2026-08-07). A second set, still being updated up to 2026-09-25, has 21 extra pages. The redirect map has to use both.

## 1. Sitemap and robots files

| URL | Result |
|---|---|
| /robots.txt | 200. `Allow: /`; disallows `/wp-admin/` (except admin-ajax.php), `/wp-login.php`, `/xmlrpc.php`, `/?s=`, `/search/`. Points to `Sitemap: https://www.easyclinic.io/sitemap_index.xml` |
| /sitemap.xml | 301 to /sitemap_index.xml |
| **/sitemap_index.xml** | **200. This is the index**, made by the "thinkrank" plugin. Every child lastmod is 2026-08-07T20:18:26. It lists sitemap-posts.xml, sitemap-posts-2.xml, sitemap-posts-3.xml, sitemap-pages.xml, sitemap-e-floating-buttons.xml (empty) and local-sitemap.xml (just `/`) |
| /wp-sitemap.xml | 301 to /sitemap_index.xml |
| /sitemap-pages.xml | 200, 100 URLs |
| /sitemap-posts.xml | 200, 200 URLs |
| /sitemap-posts-2.xml | 200, 200 URLs |
| /sitemap-posts-3.xml | 200, 3 URLs |
| **/page-sitemap.xml** | 200, **118 URLs**. This is a second, older-style sitemap (Yoast or Rank Math style, `main-sitemap.xsl`). The index doesn't link to it, but it is **more current**: lastmods go up to 2026-09-25 |
| /post-sitemap.xml | 301 to /post-sitemap1.xml. post-sitemap1, 2 and 3 have 200 + 200 + 3 URLs, the **same 403 posts** as the thinkrank set, with newer lastmods (up to 2026-09-10) |
| category-sitemap.xml, post_tag-sitemap.xml, sitemap-categories.xml, sitemap-tags.xml, sitemap-category.xml, sitemap-post_tag.xml, sitemap-doctors.xml, sitemap-clinics.xml | all 404 |

## 2. Non-post pages: 121 unique URLs

This is the union of page-sitemap.xml (118) and sitemap-pages.xml (100). Lastmod dates come from page-sitemap.xml, which is the fresher one. HTTP status is 200 unless noted.

Markers:
- `[PS-only]` = only in page-sitemap.xml (21 pages)
- `[TR-only]` = only in the thinkrank sitemap-pages.xml (3 pages)

```
/ 2026-08-07
/about-us/ 2026-07-28
/aesthetic-emr-software/ 2026-05-14
/ai/ 2026-04-20
/allergy-emr-software/ 2026-05-14
/alternative-medicine/ 2026-05-15
/appointment-scheduling-at-easy-clinic/ 2026-05-15
/ayurveda-emr-software/ 2026-08-06
/best-clinic-management-software-ethiopia/ 2026-09-09 [PS-only]
/best-clinic-management-software-fiji/ 2026-09-09 [PS-only]
/best-clinic-management-software-ghana/ 2026-08-25 [PS-only]
/best-clinic-management-software-india-new/ 2026-09-22 [PS-only]
/best-clinic-management-software-india/ 2026-08-25 [PS-only]
/best-clinic-management-software-kenya-new/ 2026-09-25 [PS-only]
/best-clinic-management-software-kenya/ 2026-08-08
/best-clinic-management-software-malaysia/ 2026-09-14 [PS-only]
/best-clinic-management-software-maldives/ 2026-09-01 [PS-only]
/best-clinic-management-software-mauritius/ 2026-08-25 [PS-only]
/best-clinic-management-software-nigeria/ 2026-09-01 [PS-only]
/best-clinic-management-software-qatar/ 2026-09-12 [PS-only]
/best-clinic-management-software-rwanda/ 2026-08-25 [PS-only]
/best-clinic-management-software-seychelles/ 2026-09-09 [PS-only]
/best-clinic-management-software-somalia/ 2026-09-12 [PS-only]
/best-clinic-management-software-south-africa/ 2026-09-09 [PS-only]
/best-clinic-management-software-suriname/ 2026-09-12 [PS-only]
/best-clinic-management-software-tanzania/ 2026-09-09 [PS-only]
/best-clinic-management-software-trinidad-and-tobago/ 2026-09-09 [PS-only]
/best-clinic-management-software-uae/ 2026-09-12 [PS-only]
/best-clinic-management-software-uganda/ 2026-08-25 [PS-only]
/blogs/ 2026-07-23
/cardiology-emr/ 2026-05-15
/careers/ 2026-07-28
/ceo-landing-page/ 2025-01-19
/cfo-landing-page/ 2025-01-19
/clinic-chain-software/ 2026-05-15
/cmo-landing-page/ 2025-01-19
/contact-us/ 2026-08-08
/cosmetology-emr-software/ 2026-08-06
/curapilot-ai/ 2026-06-10
/curapilot/ 2026-07-25
/custom-healthcare-software-development/ 2026-07-28
/demo-form-embed/ 2026-05-28
/dental-emr-software/ 2026-05-14
/dermatology-emr-software/ 2026-05-14
/diabetology-emr-software/ 2026-08-06
/doctor-clinic-software/ 2026-08-06
/emr-landing-page/ 2025-01-31
/emr-software-in-bangalore/ 2026-07-20
/emr-software-in-chennai/ 2026-07-20
/emr-software-in-delhi-ncr/ 2026-07-20
/emr-software-in-ethiopia/ 2026-08-06
/emr-software-in-fiji/ 2026-07-27
/emr-software-in-ghana/ 2026-08-06
/emr-software-in-hyderabad/ 2026-07-20
/emr-software-in-india/ 2026-07-28
/emr-software-in-kenya/ 2026-08-08
/emr-software-in-malaysia/ 2026-08-06
/emr-software-in-maldives/ 2026-07-27
/emr-software-in-mauritius/ 2026-08-06
/emr-software-in-mumbai/ 2026-07-20
/emr-software-in-nigeria/ 2026-08-01
/emr-software-in-qatar/ 2026-07-27
/emr-software-in-rwanda/ 2026-07-27
/emr-software-in-seychelles/ 2026-07-27
/emr-software-in-somalia/ 2026-07-27
/emr-software-in-south-africa/ 2026-07-27
/emr-software-in-suriname/ 2026-07-28
/emr-software-in-tanzania/ 2026-07-28
/emr-software-in-trinidad-and-tobago/ 2026-07-28
/emr-software-in-uae/ 2026-07-28
/emr-software-in-uganda/ 2026-07-28
/endocrinology-emr-software/ 2026-05-14   (301 -> /endocrinology/ -> back: REDIRECT LOOP)
/ent-emr-software/ 2026-05-14
/family-physician-emr/ 2026-05-15
/features/ 2026-05-15
/gastroenterology-emr/ 2026-08-06
/general-practitioner-emr/ 2026-05-15
/general-surgery-emr/ 2026-05-15
/hematology-emr/ 2026-05-15   (301 -> /hematology/ -> back: REDIRECT LOOP)
/hospital-opd-nursing-home-software/ 2026-05-15
/immunology-emr/ 2026-05-15
/ivf-emr/ 2026-05-15
/jarico/ 2025-09-11
/kenyademo/ 2026-05-30
/knowledgebase/ 2026-07-28
/mental-health/ 2025-01-29
/nephrology-emr/ 2026-05-15
/neurology-emr/ 2026-05-15
/new-emr-software-in-maldives/ 2026-07-10 [TR-only] (404)
/new-emr-software-in-mauritius/ 2026-07-02 [TR-only] (404)
/newsletter/ 2025-11-05
/ngo-landing-page/ 2025-06-07
/obgyn-emr-software/ 2026-05-15
/oncology-emr/ 2026-05-15
/ophthalmology-emr/ 2026-05-15
/orthopedic-emr/ 2026-05-15
/partner-with-ec/ 2026-07-28
/pathology-emr/ 2026-05-15
/patient-engagement-at-easyclinic/ 2026-05-15
/payor-management/ 2026-05-15
/pediatric-emr/ 2026-05-15
/physiotherapy-emr-software/ 2026-09-01 [PS-only]
/physiotherapy-emr/ 2026-05-15 [TR-only] (301 -> /physiotherapy-emr-software/)
/polyclinic-software/ 2026-08-06
/pricing/ 2026-06-09
/privacy-policy/ 2026-09-22
/psychiatry-emr/ 2026-05-15
/psychology-emr/ 2026-05-15
/pulmonology-emr/ 2026-05-15
/radiology-emr/ 2026-05-15
/reports-and-dashboards/ 2026-05-15
/resources/ 2025-02-21
/revenue-management/ 2026-05-15
/rheumatology-emr/ 2026-05-15   (301 -> /rheumatology/ -> back: REDIRECT LOOP)
/sexology-emr/ 2026-05-15
/siliconindia/ 2026-08-05
/terms-of-service/ 2025-03-21
/testimonials/ 2026-04-20
/thank-you/ 2024-02-08
/trichology-emr/ 2026-05-15   (301 -> /trichology/ -> 301 -> /trichology-clinic-management-software/, which is a POST)
/urology-emr/ 2026-05-15
```

Notes on the pages:
- **Live bugs, found with `curl -L --max-redirs 6`:** `/rheumatology-emr/`, `/hematology-emr/` and `/endocrinology-emr-software/` redirect in a loop. They are still listed in both sitemaps.
- The thinkrank sitemap shows older lastmods for some pages. For example it has /privacy-policy/ at 2024-02-08 and /contact-us/ at 2026-08-06.
- These pages look like utility or test pages to check before rebuilding: /demo-form-embed/, /thank-you/, /kenyademo/, /jarico/, the three `*-landing-page/` pages, /emr-landing-page/, /ngo-landing-page/, and both `*-new/` pages.

## 3. Posts: 403 total

- sitemap-posts.xml has 200, sitemap-posts-2.xml has 200, sitemap-posts-3.xml has 3. All 403 are unique, and post-sitemap1–3 contains the same set.
- **Posts sit at the site root** (`/slug/`), not under `/blog/`.
- Status check on all 403: 401 return 200 and 2 already redirect:
  - `/clinic-automation-in-uganda/` → 301 to `/emr-software-in-uganda/`
  - `/insurance-claim-management-system/` → 301 to `/payor-management/`
- I classified posts by slug and title only; I did not read the post bodies.
- The four groups below together are the complete list of 403 posts. I checked by script that there are 0 missing and 0 duplicates: KEEP 181 + MERGE 113 + DROP 48 + UNSURE 61 = 403. Within each group, paths are roughly in sitemap order.

### KEEP-buyer (181)
```
/clinic-cash-flow/
/lab-report-management/
/clinic-workflow-automation/
/clinic-compliance-checklist/
/ai-emr-software-vs-traditional-emr/
/clinic-legal-mistakes/
/abdm-compliance/
/patient-data-privacy-mistakes/
/clinic-compliance-laws-in-india/
/rural-healthcare-market-in-india/
/malaysia-healthcare-boom/
/kenya-vs-nigeria-clinic/
/starting-a-clinic-in-dubai/
/clinic-growth-in-africa/
/clinic-business-in-tier-2-cities/
/clinic-break-even-point/
/clinic-financial-mistakes/
/profitable-clinic-setup/
/clinic-setup-cost-in-india/
/whatsapp-groups-for-patient-care/
/whatsapp-referrals-for-clinics/
/paperless-clinic-workflow/
/easyclinic-emr-vs-traditional-emr/
/easyclinic-vs-practo/
/easyclinic-vs-healthplix/
/easyclinic-vs-kenyaemr/
/whatsapp-patient-journey/
/whatsapp-follow-up-automation/
/whatsapp-triage-for-clinics/
/personalised-whatsapp-messages/
/whatsapp-no-show-reduction/
/whatsapp-post-surgery-care/
/radiology-clinic-software/
/whatsapp-patient-compliance-tracking/
/whatsapp-clinic-automation/
/healthcare-compliance-software/
/billing-fraud-detection-for-clinics/
/insurance-claim-management-system/
/clinical-governance-software/
/clinic-software-migration/
/clinic-inventory-management-system/
/healthcare-dashboard-software/
/online-appointment-booking-system/
/medical-transcription-software/
/payor-management-system/
/patient-engagement-software/
/emr-software-for-cardiology/
/pulmonology-ai-clinic-software/
/clinic-management-software-for-psychology/
/ai-surgery-clinic-software/
/trichology-clinic-management-software/
/clinic-management-software-for-rheumatology/
/physiotherapy-clinic-management-software/
/pathology-clinic-management-software/
/oncology-clinic-management-software/
/ophthalmology-clinic-management-software/
/clinic-management-software-for-general-practitioners/
/immunology-clinic-management-software/
/haematology-clinic-management-software/
/alternative-medicine-clinic-management-software/
/ayurveda-clinic-management-software/
/ai-allergy-clinic-software/
/clinic-management-system-for-endocrinologists/
/clinic-management-system-for-aesthetic-clinics/
/clinic-management-system-for-ivf-clinics/
/clinic-management-system-for-cosmetologists/
/ai-clinic-management-systems-for-diabetologists/
/clinic-management-systems-for-ophthalmologists/
/clinic-management-for-gastroenterologists/
/clinic-management-systems-for-cardiologists/
/clinic-management-systems-for-dermatologists/
/clinic-management-system-for-radiologists/
/clinic-management-system-for-general-medicine/
/ent-clinic-management-systems/
/ai-clinic-automation-for-nephrologists/
/clinic-automation-for-gynaecologists/
/clinic-management-software-for-paediatric/
/clinic-management-software-for-neurologists/
/clinic-management-software-for-orthopaedic/
/clinic-management-software-for-gynaecology/
/bi-and-reporting-software-for-clinics/
/easyclinic-ai-automation-software/
/easyclinic-emr-software-in-india/
/clinic-management-software/
/healthcare-management-in-rwanda/
/mobile-payments-for-ugandan-clinics/
/simplifying-healthcare-financing/
/simplifying-ethiopias-healthcare-supply-chain/
/cloud-based-emr-for-nigerian-clinics/
/clinic-automation-in-uganda/
/clinic-efficiency-in-malaysia/
/multilingual-digital-prescriptions/
/multilingual-capabilities-in-malaysia/
/patient-data-management-in-ethiopia/
/ndhm-compliance-in-india/
/inventory-management-for-rural-clinics/
/integrated-pharmacy-management/
/healthcare-in-uganda/
/pdpa-compliance-audit/
/ai-emr-solutions-rwanda/
/telemedicine-in-india/
/visual-data-analytics-in-ethiopian-clinics/
/inventory-management-in-rwanda/
/clinic-management-in-india/
/easyclinics-role-in-rwandas-digital-health-transformation/
/digitizing-ethiopias-rural-health-facilities-the-benefits-of-easyclinics-integrated-emr/
/compliance-made-easy-adhering-to-nigerian-healthcare-regulations-with-easyclinic/
/automated-compliance-and-reporting-solutions-aligning-with-rwandas-healthcare-standards/
/advanced-financial-analytics-improving-profitability-of-malaysian-healthcare-practices/
/visual-lab-results-easy-interpretation-of-diagnostic-data/
/visual-health-intelligence-making-patient-data-work-for-african-clinics/
/unified-scheduling-for-scalable-clinic-networks-in-africa/
/strengthening-patient-clinic-relationships-through-automated-communication/
/streamlining-medical-logistics-timely-deliveries-for-multi-location-clinics/
/streamlined-lab-operations-quick-and-accurate-diagnostics-with-easyclinic/
/smart-inventory-management-with-ai-how-easyclinic-optimises-medical-supplies/
/simplified-third-party-billing-boosting-revenue-for-african-clinics/
/securing-your-clinic-user-access-control-simplified/
/seamless-prescription-transfers-elevating-pharmacy-efficiency-with-digital-integration/
/scaling-your-clinic-operations-across-africa-with-easyclinic/
/real-time-stock-management-avoiding-medical-supply-shortages-in-clinics/
/maximise-clinic-efficiency-with-smart-hr-management-systems/
/managing-insurance-claims-effortlessly-with-easyclinic/
/making-smarter-decisions-with-easyclinics-analytics-and-reports/
/how-easyclinic-integrations-improve-healthcare-delivery/
/expiry-and-stock-alerts-safeguarding-patients-and-cutting-waste-in-clinics/
/ensuring-financial-integrity-with-advanced-clinic-accounting/
/emr-customisation-with-easyclinic-tailor-workflows-improve-care/
/empowering-patients-with-easyclinics-patient-portal-and-mobile-app/
/effortless-teleconsultations-bridging-the-healthcare-gap-in-rural-africa/
/digital-payment-integration-for-telemedicine-simplifying-remote-consultations/
/custom-built-for-african-specialists-why-customisable-emr-is-the-future-of-healthcare-in-africa/
/cross-location-analytics-for-clinic-chains-a-complete-overview/
/consistent-patient-experiences-across-multiple-clinic-sites/
/one-click-billing-revolutionising-clinic-billing-processes-in-africa/
/top-strategies-for-reducing-patient-no-shows/
/the-essential-rcm-guide-mastering-revenue-cycle-management-for-private-clinics/
/strengthening-patient-connections-implementing-crm-systems-for-better-relations/
/smarter-stocks-bigger-savings-how-clinic-inventory-management-helps-cut-costs/
/smarter-scheduling-happier-patients-elevating-healthcare-operations-through-optimized-appointments/
/simplifying-clinic-workflows-digitally-streamlining-patient-intake-forms/
/self-service-appointment-booking-empowering-patients-streamlining-clinics/
/scaling-with-structure-managing-multi-location-clinics-efficiently/
/modern-convenience-how-online-payments-improve-the-patient-experience-in-clinics/
/measuring-what-matters-using-healthcare-kpis-to-track-and-improve-clinic-performance/
/leveraging-sms-and-whatsapp-for-patient-engagement/
/launch-with-confidence-a-complete-checklist-for-setting-up-a-new-clinic-in-2025/
/future-proofing-your-practice-task-automation-tools-every-clinic-should-consider/
/choosing-the-right-practice-management-software-a-clinics-guide-to-streamlined-success/
/avoiding-revenue-leaks-top-billing-mistakes-clinics-must-avoid/
/benefits-of-offering-online-patient-portals/
/best-healthcare-crm-systems-for-healthcare-providers/
/healthcare-cybersecurity-protecting-clinics-and-hospitals-in-the-digital-age/
/telemedicine-guide-navigating-the-future-of-virtual-care-in-clinical-practice/
/tax-benefits-for-medical-startups-in-kenya/
/patient-data-privacy-laws-in-india/
/data-privacy-laws-in-kenya/
/clinic-in-malaysia/
/telemedicine-in-india-2/
/telemedicine-in-kenya-2025/
/clinic-in-india/
/clinic-in-ethiopia/
/clinic-in-rwanda/
/clinic-in-uganda/
/clinic-in-nigeria/
/healthcare-startup-in-kenya/
/nhif-in-kenya/
/new-clinic-in-kenya/
/open-a-clinic-in-india/
/how-to-get-approval-from-the-medical-practitioners-and-dentists-council-in-india-nmc-dci/
/how-do-i-get-approval-from-the-kmpdc-in-kenya/
/how-much-does-it-cost-to-open-a-clinic-in-mumbai/
/how-do-i-start-a-private-clinic-in-india/
/what-are-the-registration-and-licensing-requirements-for-doctors-in-kenya/
/how-much-does-it-cost-to-open-a-clinic-in-nairobi/
/what-are-the-best-locations-to-open-a-clinic-in-kenya/
/the-ultimate-guide-to-starting-a-clinic-in-kenya/
/questions-to-ask-your-clinic-emr-software-provider/
/features-that-your-telemedicine-software-should-have/
/faqs-on-emr-medical-software/
/why-clinic-management-solution-is-must-for-clinics/
```
Notes on KEEP:
- **35 of these are specialty-software posts.** They run from /radiology-clinic-software/ through /clinic-management-software-for-gynaecology/, plus /pulmonology-ai-clinic-software/ and /ai-surgery-clinic-software/. They compete with the `*-emr` specialty pages for the same searches, and should probably be merged into those pages or 301-redirected to them.
- Obvious duplicate pairs:
  - telemedicine-in-india vs telemedicine-in-india-2
  - ophthalmology-clinic-management-software vs clinic-management-systems-for-ophthalmologists
  - radiology-clinic-software vs clinic-management-system-for-radiologists
  - emr-software-for-cardiology vs clinic-management-systems-for-cardiologists
  - clinic-management-software-for-gynaecology vs clinic-automation-for-gynaecologists
  - payor-management-system vs insurance-claim-management-system

### MERGE-ai-explainer (113)
```
/ai-in-ivf/
/ai-driven-inventory-management/
/ai-informed-patients/
/ai-patient-intake/
/predictive-analytics-for-clinics/
/ai-appointment-scheduling/
/ai-receptionist-for-clinics/
/ai-clinical-decision-support/
/ai-in-chronic-disease/
/ai-in-telemedicine/
/ai-for-clinic-growth/
/ai-medical-records/
/ai-medical-billing/
/ai-patient-engagement/
/ai-tools-for-doctors/
/multimodal-ai-in-healthcare/
/ai-in-healthcare-specialities/
/ai-patient-portals/
/ai-medical-imaging/
/ai-medical-scribes/
/ai-virtual-assistants-for-clinics/
/smart-clinics/
/ai-in-radiology/
/ai-prescription-errors/
/smart-emr-for-clinics/
/ai-emr-revenue-growth/
/ai-in-clinics-2026/
/agentic-ai-for-oncology/
/ai-in-paediatric-clinic/
/ai-billing-automation-for-surgery/
/ai-precision-treatment-in-gynaecology/
/ai-chatbots-for-pediatric/
/predictive-analytics-for-dental/
/automated-documentation-for-dermatology/
/automated-workflows-for-cosmetic/
/predictive-analytics-for-nephrology/
/ai-copilots-for-endocrinology/
/ai-remote-monitoring-for-ivf/
/ai-chatbots-for-ophthalmology/
/ai-driven-dental-automation/
/generative-ai-for-gynaecology/
/ai-diagnostics-radiology-2026/
/ai-for-urology-clinics/
/ai-automation-in-radiology/
/ai-software-for-pulmonology-clinics/
/ai-tools-for-neurology-clinics/
/ai-tools-for-nephrology-clinics/
/ai-tools-for-gynaecology-and-fertility-clinics/
/ai-software-for-urology-clinics/
/ai-software-for-pediatric-clinics/
/ai-software-for-dental-clinics/
/ai-software-for-ent-clinics/
/ai-software-for-ophthalmology-clinics/
/ai-software-for-orthopaedic-clinics/
/ai-software-for-aesthetic-clinics/
/ai-tools-in-pathology/
/ai-tools-for-diabetology-clinics/
/advanced-ai-tools-for-cardiology-clinics/
/ai-software-for-dermatology-clinics/
/ai-emr-software-for-radiology-clinics/
/predictive-orthodontics-in-india/
/ai-in-orthodontics/
/ai-in-healthcare/
/ai-in-cardiology-clinics/
/ai-in-echocardiography/
/ai-driven-predictive-analytics-for-chronic-disease-management-in-india/
/ai-in-maternal-health-reducing-maternal-mortality-rates-in-uganda/
/ai-for-malaria-and-infectious-disease-management-empowering-nigerian-healthcare-providers/
/leveraging-ai-for-efficient-clinic-operations-in-africa/
/ai-powered-scheduling-transforming-clinic-efficiency-and-reducing-wait-times/
/ai-driven-diagnostic-support-transforming-patient-outcomes/
/reimagining-care-how-ai-recommendations-are-enhancing-patient-engagement/
/chatbots-for-patient-pre-screening-benefits-and-challenges/
/ai-in-imaging-diagnostics-transforming-accuracy-and-speed-in-patient-care/
/ai-personalized-healthcare-delivering-tailored-treatment-plans-for-every-patient/
/intelligent-triage-begins-here-how-ai-healthcare-chatbots-are-transforming-clinics/
/how-predictive-healthcare-analytics-is-improving-outcomes-and-empowering-clinics/
/virtual-assistant-for-doctors-a-game-changer-in-clinical-efficiency/
/hospital-automation-redefining-innovation-and-efficiency-in-modern-healthcare/
/voice-recognition-tools-reshaping-emr-documentation-in-clinics/
/how-ai-smart-clinics-are-redefining-the-modern-patient-experience/
/smarter-practice-with-ai-emr-transforming-clinic-efficiency-and-patient-care/
/ai-in-health-care-diagnosis/
/ai-cancer-detection/
/ai-in-follow-up-automation-improving-patient-adherence/
/ai-in-dermatology-emr-simplifying-skin-care-records/
/ai-in-psychiatric-emr-supporting-mental-wellness/
/ai-in-clinic-data-security-protecting-patient-privacy/
/ai-in-paperless-clinics-cutting-administrative-clutter/
/ai-in-cardiology-emr-precision-heart-care/
/ai-in-clinic-staff-coordination-optimizing-teamwork/
/ai-in-multi-location-clinics-streamlining-operations-across-branches/
/ai-in-orthopedic-emr-enhancing-bone-health-care/
/ai-in-surgical-emr-streamlining-operative-care/
/ai-in-preventive-care-analytics-predicting-health-risks/
/ai-in-referral-management-enhancing-care-coordination-for-better-patient-outcomes/
/ai-in-pediatric-emr-tracking-child-health-made-easy/
/how-ai-in-clinic-inventory-management-boosts-efficiency/
/ai-in-patient-triage-speeding-up-emergency-care/
/ai-in-chronic-care-managing-long-term-conditions/
/ai-in-gynecology-emr-empowering-womens-health/
/ai-in-diagnostic-accuracy-reducing-clinical-errors/
/ai-in-multilingual-prescriptions-bridging-language-gaps/
/ai-in-radiology-workflows-enhancing-imaging-efficiency/
/ai-for-dental-clinic-management-revolutionizing-patient-care-with-easy-clinic/
/ai-for-diabetologists-the-future-of-diabetes-care-with-advanced-technology/
/how-ai-contributes-to-minimizing-medical-billing-errors/
/how-ai-powered-emr-software-is-transforming-clinic-management/
/how-ai-for-doctors-is-transforming-clinical-practice/
/ai-enabled-telemedicine-solutions-the-future-of-digital-healthcare/
/ai-in-health-data-analytics-smarter-insights-for-clinics/
/easy-clinic-patient-engagement-with-ai-smart-healthcare-solutions/
/ai-powered-medical-billing-software-transforming-healthcare-finance/
```
Suggested merge targets:
- The AI billing posts (ai-medical-billing, ai-billing-automation-for-surgery, how-ai-contributes-to-minimizing-medical-billing-errors, ai-powered-medical-billing-software-…) could go to the billing or revenue pages.
- The scribe and voice posts (ai-medical-scribes, voice-recognition-tools-…) could go to /curapilot/.

### DROP-frontier (48)
```
/robotic-rehabilitation/
/point-of-care-diagnostics/
/humanoid-robots/
/robotic-surgery-in-healthcare/
/ai-and-robotics-in-healthcare/
/autonomous-healthcare-robots/
/robotic-telemedicine/
/robotic-surgery-for-clinics/
/surgical-robotics-for-endocrinology/
/virtual-hospitals-for-cancer-clinics/
/ar-glasses-for-ivf-clinics/
/vr-data-visualisation-for-orthopaedics/
/augmented-healthcare-for-surgery/
/ai-assisted-surgery-for-diabetes/
/robotics-in-ent-clinics/
/ai-robotics-software-for-gynaecology/
/robotics-in-orthopaedics-clinics/
/robotics-in-urology-clinics/
/dental-robotics-in-india/
/robotics-in-dermatology-clinics/
/future-of-robotic-surgery-in-india/
/robotic-radiology-equipment-in-india/
/ai-in-eye-surgery/
/ai-vs-traditional-eye-surgery/
/future-of-eye-surgery-in-india/
/wearables-in-diagnostics-how-predictive-monitoring-is-reshaping-healthcareembracing-the-power-of-health-wearables-for-predictive-care-as-healthcare-evolves-toward-proactive-and-patient-centered-care/
/vr-medical-training-the-future-of-immersive-medical-education/
/wearable-devices-and-remote-health-monitoring-empowering-clinics-and-patients/
/why-blockchain-healthcare-technology-is-reshaping-medical-data-security/
/advancing-surgical-precision-how-ar-surgery-is-shaping-healthcare-innovation/
/iot-healthcare-powering-the-connected-care-revolution/
/5g-telehealth-transforming-virtual-care-with-speed-and-accessibility/
/wearable-technology-in-predictive-diagnostics-transforming-health-monitoring/
/understanding-epigenetics-and-its-medical-potential-a-new-frontier-in-healthcare/
/the-role-of-immunotherapy-in-transforming-modern-medicine/
/3d-printing-medicine-in-action-advancing-personalized-healthcare-solutions/
/the-future-of-regenerative-medicine-shaping-tomorrows-healthcare/
/telepathology-remote-diagnosis-trends-shaping-the-future-of-healthcare/
/gene-therapy-pioneering-the-future-of-personalized-medicine/
/crispr-technology-transforming-gene-editing-healthcare/
/ai-clinical-trials-transforming-the-future-of-medical-research/
/stem-cell-therapy-innovations-advancing-the-future-of-regenerative-medicine/
/robotics-in-surgery-advancing-safer-and-faster-operations/
/nanomedicine-tiny-innovations-in-nano-healthcare-technologies/
/mrna-technology-paving-the-future-of-healthcare-biotechnology/
/revolutionary-medical-advancements/
/microbiome-health-research/
/ai-drug-discovery/
```

### UNSURE (61)
These fall into four kinds of topic: general clinic operations, HR and marketing tips (about 40); medical equipment and product reviews (11); clinical topics (about 6); and doctor-lifestyle posts (about 4). Traffic data should decide these.
```
/diabetic-retinopathy-screening/
/language-barriers/
/staff-scheduling/
/physician-burnout/
/online-reputation-management/
/medication-management/
/preventive-healthcare/
/remote-patient-monitoring-system/
/ophthalmology-clinic-technology/
/dental-clinic-equipment-list/
/health-camps-lead-generation/
/digital-presence-for-clinics/
/clinic-growth-without-discounts/
/doctor-personal-branding/
/google-reviews-for-clinics/
/100-meter-clinic-marketing/
/clinic-branding/
/patient-stories-marketing/
/clinic-marketing-strategy/
/data-centric-pathology-clinics/
/ai-gynaecology-equipment-in-india/
/ai-radiology-equipment-suppliers-in-india/
/ge-vs-siemens-ai-radiology/
/ai-radiology-equipment-in-india/
/best-dental-equipment-in-india/
/dental-implants-future-in-india/
/digital-dentistry-in-india/
/latest-lasik-technology-india/
/advanced-eye-surgery-machines-in-india/
/bpl-cardiart-9108d-vs-mindray-m7/
/remote-cardiac-monitoring/
/cardiology-equipment-in-india/
/why-doctors-should-care-about-patient-journey-mapping/
/using-surveys-to-improve-patient-satisfaction/
/understanding-the-psychology-behind-patient-compliance-and-how-to-improve-it/
/top-10-ways-to-improve-patient-retention/
/strategic-efficiency-should-your-clinic-outsource-non-core-tasks/
/role-of-empathy-in-patient-care/
/revolutionizing-care-delivery-remote-patient-monitoring-for-clinics/
/mastering-efficiency-7-essential-tips-for-streamlined-clinic-management/
/maintaining-trust-how-to-handle-negative-reviews-in-healthcare-professionally/
/enhance-clinic-outcomes-improving-patient-engagement-with-digital-tools/
/importance-of-timely-follow-ups-in-patient-satisfaction/
/how-personalized-care-enhances-patient-experience/
/gamification-in-action-engaging-patients-for-better-compliance/
/fostering-doctor-patient-trust-through-digital-healthcare-communication/
/empowering-your-team-the-importance-of-staff-training-and-development-in-clinics/
/empowering-excellence-building-a-culture-of-efficiency-in-your-clinic/
/empowering-clinic-success-how-proper-data-management-improves-operations/
/effective-patient-communication-techniques/
/educating-patients-through-digital-content-elevating-understanding-and-outcomes/
/building-clinical-consistency-must-have-sops-for-efficient-healthcare-operations/
/building-a-strong-team-top-hr-strategies-for-clinic-staff-retention/
/breaking-the-burnout-cycle-how-clinic-automation-helps-doctors-reclaim-time-and-focus/
/top-10-doctor-apps-every-physician-should-use/
/mhealth-apps-and-mobile-health-innovations-doctors-must-know-in-2025/
/top-medical-journals-every-doctor-should-follow-for-healthcare-research/
/essential-updates-on-clinical-guidelines-2025-what-doctors-must-know/
/top-strategies-to-boost-patient-acquisition-in-2024/
/how-to-make-your-waiting-room-more-patient-friendly/
/tips-to-help-you-deliver-professional-care-online/
```

## 4. URL conventions and taxonomy

- **Trailing slashes:** every `<loc>` in every live sitemap ends with `/`, with no exceptions. Requests without the slash get a 301 to the slashed URL (e.g. `/about-us` → `/about-us/`, `/pricing` → `/pricing/`).
- **Canonical host:** `https://easyclinic.io/` and `http://www.easyclinic.io/` both 301 to `https://www.easyclinic.io/`.
- **Blog paths:** posts live at the root. `/blog/` 301s to `/blogs/`, which is the listing page.
- **No category, tag or author sitemaps** (all 404), but the archive pages themselves are live and indexable. I found these links on a post page (/clinic-setup-cost-in-india/), and every one returns 200:
  - Categories: /category/ai/, /category/bi-software/, /category/billing-software/, /category/cardiology-equipments/, /category/clinic-management-software/, /category/clinic-marketing/, /category/dental-equipments/, /category/easyclinic/, /category/emr-medical-software/, /category/eye-surgery-equipments/, /category/guides/, /category/radiology-emr/, /category/telemedicine-software/, /category/whatsapp-clinic/
  - Author: /author/akshaychandel/
  - Tag: /tag/ai/ (title "AI - Easy Clinic")
  - These return 404: /category/uncategorized/, /category/blog/, /author/admin/
- **RSS:** /feed/ returns 200 as application/rss+xml.
- **/doctors/ and /clinics/:** neither appears in any live sitemap, and both 301 to `/` on live. **/doctors/ does appear in the staging sitemap.**

## 5. Staging sitemap (https://staging-easyclinic.vercel.app)

- /sitemap-index.xml returns 200 and points to `https://www.easyclinic.io/sitemap-0.xml`. The index uses the production host, not the staging host.
- /sitemap-0.xml returns 200 with **122 URLs**, all on `https://www.easyclinic.io`, with no lastmod.
- /sitemap.xml and /robots.txt both return 404 on staging.
- The page reports `generator` as Astro v7.2.1.

Full staging list:
```
/
/about-us/
/aesthetic-emr-software/
/ai/
/allergy-emr-software/
/alternative-medicine/
/appointment-scheduling-at-easy-clinic/
/ayurveda-emr-software/
/best-clinic-management-software-ethiopia/
/best-clinic-management-software-fiji/
/best-clinic-management-software-ghana/
/best-clinic-management-software-india/
/best-clinic-management-software-kenya/
/best-clinic-management-software-maldives/
/best-clinic-management-software-mauritius/
/best-clinic-management-software-nigeria/
/best-clinic-management-software-qatar/
/best-clinic-management-software-rwanda/
/best-clinic-management-software-seychelles/
/best-clinic-management-software-somalia/
/best-clinic-management-software-south-africa/
/best-clinic-management-software-suriname/
/best-clinic-management-software-tanzania/
/best-clinic-management-software-trinidad-and-tobago/
/best-clinic-management-software-uae/
/best-clinic-management-software-uganda/
/blogs/
/blogs/billing-that-balances-the-till/
/blogs/cura-ai-copilot-for-busy-clinicians/
/blogs/cut-no-shows-with-smarter-scheduling/
/blogs/go-paperless-without-losing-speed/
/blogs/inventory-and-pharmacy-without-stockouts/
/blogs/patient-engagement-beyond-appointment-sms/
/cardiology-emr/
/careers/
/ceo-landing-page/
/cfo-landing-page/
/cmo-landing-page/
/contact-us/
/cosmetology-emr-software/
/curapilot/
/custom-healthcare-software-development/
/dental-emr-software/
/dermatology-emr-software/
/devlabs/
/devlabs/dashboard/
/diabetology-emr-software/
/doctors/
/easyclinic-emr-vs-traditional-emr/
/easyclinic-vs-healthplix/
/easyclinic-vs-kenyaemr/
/easyclinic-vs-practo/
/emr-landing-page/
/emr-software-in-bangalore/
/emr-software-in-chennai/
/emr-software-in-delhi-ncr/
/emr-software-in-ethiopia/
/emr-software-in-fiji/
/emr-software-in-ghana/
/emr-software-in-hyderabad/
/emr-software-in-india/
/emr-software-in-kenya/
/emr-software-in-malaysia/
/emr-software-in-maldives/
/emr-software-in-mauritius/
/emr-software-in-mumbai/
/emr-software-in-nigeria/
/emr-software-in-qatar/
/emr-software-in-rwanda/
/emr-software-in-seychelles/
/emr-software-in-somalia/
/emr-software-in-south-africa/
/emr-software-in-suriname/
/emr-software-in-tanzania/
/emr-software-in-trinidad-and-tobago/
/emr-software-in-uae/
/emr-software-in-uganda/
/endocrinology-emr-software/
/ent-emr-software/
/family-physician-emr/
/features/
/gastroenterology-emr/
/general-practitioner-emr/
/general-surgery-emr/
/hematology-emr/
/immunology-emr/
/ivf-emr/
/knowledgebase/
/mental-health/
/nephrology-emr/
/neurology-emr/
/ngo-landing-page/
/obgyn-emr-software/
/oncology-emr/
/ophthalmology-emr/
/orthopedic-emr/
/partner-with-ec/
/pathology-emr/
/patient-engagement-at-easyclinic/
/payor-management/
/pediatric-emr/
/physiotherapy-emr/
/pricing/
/privacy/
/psychiatry-emr/
/psychology-emr/
/pulmonology-emr/
/radiology-emr/
/reports-and-dashboards/
/resources/
/revenue-management/
/rheumatology-emr/
/sexology-emr/
/solutions/
/solutions/clinic-chain/
/solutions/doctor-clinic/
/solutions/hospital-opd/
/solutions/polyclinic/
/terms/
/testimonials/
/trichology-emr-software/
/urology-emr/
```

**Staging vs live pages (live side = page-sitemap.xml).**

On staging but not live (22):
- The 6 `/blogs/<slug>/` posts, which is a new nested blog path
- /devlabs/ and /devlabs/dashboard/, which should probably not be in a public sitemap
- /doctors/
- The 4 comparison posts, served at the root as pages: /easyclinic-emr-vs-traditional-emr/, /easyclinic-vs-healthplix/, /easyclinic-vs-kenyaemr/, /easyclinic-vs-practo/
- /physiotherapy-emr/ (live 301s this to -software)
- /privacy/ (live uses /privacy-policy/)
- /solutions/ plus 4 child pages
- /terms/ (live uses /terms-of-service/)
- /trichology-emr-software/ (live uses /trichology-emr/)

On live but missing from staging (18), each needing a page or a 301:
- /best-clinic-management-software-india-new/
- /best-clinic-management-software-kenya-new/
- /best-clinic-management-software-malaysia/
- /clinic-chain-software/ → /solutions/clinic-chain/
- /curapilot-ai/
- /demo-form-embed/
- /doctor-clinic-software/ → /solutions/doctor-clinic/
- /hospital-opd-nursing-home-software/ → /solutions/hospital-opd/
- /jarico/
- /kenyademo/
- /newsletter/
- /physiotherapy-emr-software/
- /polyclinic-software/ → /solutions/polyclinic/
- /privacy-policy/
- /siliconindia/
- /terms-of-service/
- /thank-you/
- /trichology-emr/

The staging sitemap also leaves out the 3 thinkrank-only pages (the two `/new-emr-software-in-*` pages, which already 404 on live, and /physiotherapy-emr/, which staging does include) and all 399 remaining root-level live posts.

Nothing was truncated: the pages list has 121 unique URLs, the posts total 403 (181 + 113 + 48 + 61), and staging has 122 URLs.