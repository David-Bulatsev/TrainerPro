# SEO Audit

## Indexable pages

- `/` public landing page with product summary and structured content.

## Excluded from indexing

- `/login` authentication screen.
- `/app/dashboard` private dashboard.
- `/app/athletes` private athlete data.
- `/app/workouts` private workout plans and schedules.
- `/app/calendar` private session calendar.
- `/app/medical` private injury and medical records.
- `/app/reports` private analytics.
- API and documentation routes such as `/docs`, `/redoc`, `/openapi.json`.

## Priority pages for search results

1. `/` main public landing page and canonical search target for the MVP.

## Notes

- The project currently has one meaningful public page, so SEO is concentrated on that route.
- Private workspace routes use `noindex, nofollow` and are disallowed in `robots.txt`.
