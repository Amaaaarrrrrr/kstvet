#!/bin/sh
set -e
flask --app wsgi db upgrade
flask --app wsgi seed
if [ -n "$ADMIN_EMAIL" ] && [ -n "$ADMIN_PASSWORD" ]; then
  flask --app wsgi create-admin --email "$ADMIN_EMAIL" --name "${ADMIN_NAME:-CPD Admin}" --password "$ADMIN_PASSWORD"
fi
exec gunicorn --bind "0.0.0.0:${PORT:-10000}" --workers 2 --timeout 120 wsgi:app