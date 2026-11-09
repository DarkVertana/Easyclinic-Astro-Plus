# Admin insights: edge cases and what the Google docs say

Researched 6 November 2026, before `src/lib/admin/insights.ts` was written. Every external fact below names its source.
"Not documented" means the pages read did not state it. Nothing here has been run against a real Google account.

## Sources

| Short name | URL |
| --- | --- |
| runReport | https://developers.google.com/analytics/devguides/reporting/data/v1/rest/v1beta/properties/runReport |
| RunReportResponse | https://developers.google.com/analytics/devguides/reporting/data/v1/rest/v1beta/RunReportResponse |
| ResponseMetaData | https://developers.google.com/analytics/devguides/reporting/data/v1/rest/v1beta/ResponseMetaData |
| DateRange | https://developers.google.com/analytics/devguides/reporting/data/v1/rest/v1beta/DateRange |
| GA4 schema | https://developers.google.com/analytics/devguides/reporting/data/v1/api-schema |
| GA4 quotas | https://developers.google.com/analytics/devguides/reporting/data/v1/quotas |
| GA4 errors | https://developers.google.com/analytics/devguides/reporting/data/v1/errors |
| GA4 freshness | https://support.google.com/analytics/answer/11198161?hl=en |
| GA4 roles (MCP guide) | https://developers.google.com/analytics/devguides/MCP |
| SC query | https://developers.google.com/webmaster-tools/v1/searchanalytics/query |
| SC how-to | https://developers.google.com/webmaster-tools/v1/how-tos/all-your-data |
| SC limits | https://developers.google.com/webmaster-tools/limits |
| SC data help | https://support.google.com/webmasters/answer/96568?hl=en |
| SC deep dive (2022) | https://developers.google.com/search/blog/2022/10/performance-data-deep-dive |
| JWT flow | https://developers.google.com/identity/protocols/oauth2/service-account |

## The finding that changes the design: demo requests are not on the post's page

The brief asked for `eventCount` by `pagePath` for the demo event. That would show zero for every post:

- `demo_form_submitted` fires on `/demo/confirmation/` (`src/pages/demo/confirmation.astro`), so its `pagePath` is that page.
- The event's `form_page` parameter is the page holding the form. Post CTAs link to `/contact-us/#book-a-demo`, so it is
  normally `/contact-us/`, not the post. It would also need registering first: a request for an unregistered
  `customEvent:` dimension fails (GA4 schema).

Decision: count the event by `landingPage`, "the page path associated with the first pageview in a session" (GA4 schema).
A demo request is credited to the post the visitor's session started on. This is a different question from "the post the
visitor read last", and the page says so. It misses a reader who entered elsewhere and reached the post later. Better
attribution would need a change to the public site, which is outside this work.

Open: the docs read do not confirm that `landingPage` can be combined with `eventName` and `eventCount` in one report.
The query runs on its own, so if Google refuses it only the demo column shows "not available".

## Facts used

**GA4 runReport.** Default 10,000 rows, at most 250,000 per request, paged with `offset` (runReport). `rowCount` is the total
in the result whatever `limit` and `offset` are (RunReportResponse). Rows whose metrics are all 0 are left out unless
`keepEmptyRows` is set (runReport). Up to 4 date ranges (DateRange). `screenPageViews` and `eventCount` are the metric names
(GA4 schema). Scope: `analytics.readonly` (runReport). Results may be flagged with `dataLossFromOtherRow`,
`samplingMetadatas` and `subjectToThresholding` (ResponseMetaData).

**GA4 freshness.** Standard properties: intraday 2 to 6 hours, daily 12 hours, not a guarantee; late data can take up to 7 days
(GA4 freshness). So today is excluded, and the last days of a window can still grow slightly.

**GA4 quota.** Core: 200,000 tokens a day, 40,000 an hour, 14,000 per project per property an hour, 10 concurrent requests,
10 server errors per project per property an hour, after which all requests from that project to the property are blocked. An
empty token bucket returns `429 RESOURCE_EXHAUSTED`. Retry 429, 500 and 503 with truncated exponential backoff and a limit.
Daily quota resets at midnight Pacific (GA4 quotas). 401 means a new token is needed; 403 will not be fixed by retrying
(GA4 errors).

**Search Console.** `POST https://www.googleapis.com/webmasters/v3/sites/{siteUrl}/searchAnalytics/query` with `siteUrl`
URL-encoded, as `https://www.example.com/` or `sc-domain:example.com`. Scope `webmasters.readonly`. `rowLimit` default 1,000, at
most 25,000; page with `startRow`; past the end is a success with zero rows; only top rows are guaranteed. Dates are Pacific
Time. An omitted `dataState` or `final` returns finalized data only (SC query). Limit of 50,000 rows per day per site per search
type (SC deep dive, 2022; confirm if it ever matters). Data is typically available after 2 to 3 days; the latest available date
can be found with a query grouped by date over the past 10 days (SC how-to). New sites can take up to a week (SC data help).
Over quota returns "quota exceeded"; after a short-term overage wait 15 minutes (SC limits). The HTTP status for this is not
documented on that page.

**Service-account token.** RS256 only. Claims `iss`, `scope` (space-delimited), `aud` = `https://oauth2.googleapis.com/token`, `iat`,
`exp` at most 1 hour after `iat`. Form-encoded POST with `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer` and `assertion`.
Reuse the token for `expires_in` seconds, then sign a new JWT. Errors: `invalid_grant` "Invalid JWT Signature" (key deleted,
disabled, expired or not this account's), `invalid_grant` "Token must be a short-lived token" (usually clock skew),
`disabled_client`, `deleted_client`, `invalid_client`, `invalid_scope` (JWT flow).

**Access.** A service account needs at least the Viewer role on the GA4 property; a 403 means check that and that the Data API
is enabled (GA4 roles, written for Google's MCP server but about the same API).

**Not documented in what was read.** How Search Console attributes clicks across canonical URLs and fragments; whether a service
account email can be added as a Search Console user (widely done, unverified here); which status a removed Search Console user
gets (assumed 403).

## Cases and decisions

| Case | Decision |
| --- | --- |
| Trailing slash, host, query, fragment, case | `normalizePagePath` reduces every form to `/slug/`, and variants of one page are summed. Position is re-averaged weighted by impressions. |
| Other hosts in a Domain property | `sc-domain:` covers subdomains, so only `www.easyclinic.io` and `easyclinic.io` count. Other hosts are dropped, so `app.` traffic is not credited to a post. |
| `(not set)` page values | Dropped. |
| Zero or missing previous period | Change is `null`, shown as "new" or a dash. Never divide by zero, and never show +100%. |
| Search Console delay | Query the latest available date (SC how-to); the 28 days end there. Fallback: 3 days ago. Comparing an incomplete window would invent click losses. |
| Search data much older than expected | Warn when the latest date is over 7 days old. |
| GA4 versus Search Console windows | They end on different days by design; both are shown on the page. |
| Quota errors | No immediate retry on 429 (SC asks for 15 minutes). The failure is cached for 5 minutes and a plain message shown. |
| Server errors | One retry after a short wait. Few retries, because 10 server errors an hour blocks the project (GA4 quotas). |
| Expired token | Cached until 60 seconds before `expires_in`. A 401 clears it, signs a new one and retries once. |
| Revoked key or disabled account | Token endpoint error becomes a plain "Google refused the service account" message. Raw Google text is never passed on. |
| Access removed from one property | 403 on that source only. The other source still shows, and the page says what to check. |
| New post with no data | Rows are absent (`keepEmptyRows` off), so it shows 0, position is a dash, change is "new", and it is never "losing clicks". |
| Source failed versus real zero | A failed source gives `null` and a dash; only a working source gives 0. |
| Pagination | GA4: loop on `rowCount`. Search Console: loop until a short page. Both are capped, with a warning if the cap is hit. |
| Sampled, thresholded or `(other)` data | Warning on the page. Numbers are still shown. |
| Malformed `GOOGLE_SERVICE_ACCOUNT_JSON` | Plain config message. Escaped `\n` in the private key is accepted, as hosts often store it that way. |
| Small numbers | "Losing clicks" needs at least 10 clicks in the previous period, so 2 to 1 is not a 50% alarm. This threshold is our judgement, not Google's. |
| Time zone | Search Console dates are Pacific and GA4 dates follow the property's zone. Windows are computed from the UTC date, so the edge can differ by one day. Accepted for trend reading. |
