import { z } from 'astro/zod';
import { LOCATION_BANDS, PRACTICE_TYPES } from '../../schemas/constants';

/** Spec 7.9: exactly these fields, in this order. Plus the page it came from and two spam traps. */
export const demoRequest = z.object({
  name: z.string().trim().min(2, { error: 'Please enter your name.' }).max(100),
  dialCode: z.string().regex(/^\+\d{1,4}$/, { error: 'Choose a country code.' }),
  phone: z
    .string()
    .trim()
    .regex(/^[\d\s()-]{6,20}$/, { error: 'Enter a phone number with digits only, for example 91477 70277.' }),
  email: z.email({ error: 'Enter an email address like name@clinic.com.' }).trim(),
  clinic: z.string().trim().min(2, { error: 'Please enter your clinic name.' }).max(120),
  practiceType: z.enum(PRACTICE_TYPES, { error: 'Choose the option closest to your practice.' }),
  locations: z.enum(LOCATION_BANDS, { error: 'Choose how many locations you run.' }),
  country: z.string().trim().min(2, { error: 'Choose your country.' }).max(60),
  page: z.string().startsWith('/').max(200).default('/'),
  pageCountry: z.string().max(4).optional(),
  /** Honeypot: humans never see this field. */
  website: z.string().max(0).optional().or(z.literal('')),
  startedAt: z.coerce.number().optional(),
});

export type DemoRequest = z.infer<typeof demoRequest>;

export const DEMO_COUNTRIES = [
  'India',
  'Kenya',
  'United Arab Emirates',
  'Nigeria',
  'Ghana',
  'Uganda',
  'Tanzania',
  'Rwanda',
  'South Africa',
  'Ethiopia',
  'Qatar',
  'Other',
] as const;

export const DIAL_CODES = [
  { code: '+91', label: 'India (+91)', country: 'in' },
  { code: '+254', label: 'Kenya (+254)', country: 'ke' },
  { code: '+971', label: 'UAE (+971)', country: 'ae' },
  { code: '+234', label: 'Nigeria (+234)', country: 'ng' },
  { code: '+233', label: 'Ghana (+233)' },
  { code: '+256', label: 'Uganda (+256)' },
  { code: '+255', label: 'Tanzania (+255)' },
  { code: '+250', label: 'Rwanda (+250)' },
  { code: '+27', label: 'South Africa (+27)' },
  { code: '+251', label: 'Ethiopia (+251)' },
  { code: '+974', label: 'Qatar (+974)' },
  { code: '+60', label: 'Malaysia (+60)' },
  { code: '+44', label: 'United Kingdom (+44)' },
  { code: '+1', label: 'US or Canada (+1)' },
] as const;
