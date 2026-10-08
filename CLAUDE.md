# KSTVET CPD Platform

Online CPD (Continuing Professional Development) platform for the Kenya School of TVET.
Applicants browse a CPD Calendar, apply online with documents, and receive a PDF admission
letter once the CPD Office approves them. CPD staff manage everything in an admin back office.

## Stack

- **api/** — Flask 3 (app factory + blueprints), Flask-SQLAlchemy 2.0-style models, Flask-Migrate (Alembic),
  PostgreSQL 18, Pydantic v2 for request/response validation, Flask-JWT-Extended (httpOnly cookie + CSRF),
  WeasyPrint for PDF letters, Python 3.14, virtualenv at `api/.venv`.
- **web/** — React 19 + TypeScript + Vite, React Router **v7** (pinned: react-admin 5 does not support v8),
  TanStack Query, React Hook Form + Zod, Tailwind CSS v4 for public pages, react-admin 5 + MUI for `/admin`.

## Commands

```bash
# Backend (from api/, with .venv activated)
flask --app wsgi run --debug --port 5000
flask --app wsgi db migrate -m "message" && flask --app wsgi db upgrade
flask --app wsgi seed            # sample programmes + default settings
flask --app wsgi create-admin
flask --app wsgi routes

# Frontend (from web/)
npm run dev                      # http://localhost:5173, proxies /api to :5000
npm run build                    # type-check + build; must pass before committing
```

## Layout

- `api/app/models.py` — all tables. `api/app/schemas.py` — Pydantic schemas.
- `api/app/routes/` — `public.py` (calendar), `applications.py` (submit), `track.py` (status + letter download),
  `admin_auth.py`, `admin_applications.py`, `admin_catalogue.py` (programmes, intakes, settings, reports).
- `api/app/services/` — `uploads.py` (file validation/storage), `letters.py` (PDF, email, download tokens), `mailer.py`.
- `api/app/templates/letters/admission.html` — admission letter template (Jinja2 → WeasyPrint).
- `web/src/pages/` — public pages. `web/src/admin/` — react-admin app (lazy-loaded at `/admin`).
- `web/src/types/api.ts` — TS types that mirror the Pydantic schemas.

## Conventions

- Every API error is JSON: `{"error", "message"}`; validation errors add `"fields": {name: message}` with HTTP 422.
- When changing a Pydantic schema, update the matching TS type in `web/src/types/api.ts` and the Zod schema
  in `web/src/lib/applicationSchema.ts` if it is the application form.
- Admin endpoints use `@roles_required()` (any admin) or `@roles_required("admin", "officer")` for writes.
  Write requests from the frontend must send the `X-CSRF-TOKEN` header (see `web/src/admin/http.ts`).
- Admin list endpoints return `{"data": [...], "total": n}` via `app.utils.paginate`.
- URLs exposed to applicants use `public_id` (UUID), never integer ids. ID numbers are never put in URLs.
- Uploaded files live under `api/storage/` and are served only through authorised endpoints.
- MUI: system props (`gap`, `flexWrap`, `fontWeight`, `display` on Stack/Typography) are not supported — use `sx`.
- Keep changes small and match the existing style; don't add new dependencies without asking.

## Business rules

- Reference numbers: `KSTVET/CPD/{year}/{id:04d}`; letter numbers: `KSTVET/CPD/ADM/{year}/{id:04d}`.
- Admission letters are issued **only after the CPD Office sets status to Admitted** (decided 7 Oct 2026).
  Once a letter exists the status is locked to Admitted.
- An intake auto-switches to `full` when admitted count reaches capacity.
- Email uses `MAIL_BACKEND=console` in development (writes `.eml` files to `api/storage/outbox/`).

## Do not

- Do not read or print `api/.env` or files under `api/storage/` (they contain secrets and applicants' personal data).
- Do not upgrade react-router to v8 or run `npm audit fix --force`.
- Do not edit existing Alembic migrations; create a new one.
