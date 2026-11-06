#!/bin/sh
# Hosts such as Render mount the persistent disk at /data owned by root, which the unprivileged "app" user cannot write to.
# Start as root, fix ownership of the data folder, then drop privileges before running the server.
# If the platform already starts us as a non-root user (e.g. Hugging Face), just run the command as-is.
set -e
if [ "$(id -u)" = "0" ]; then
    mkdir -p "${DATA_DIR:-/data}"
    chown -R app:app "${DATA_DIR:-/data}" 2>/dev/null || true
    exec gosu app "$@"
fi
# Non-root start: if the data folder is not writable, fall back to a temporary one so the app still boots.
D="${DATA_DIR:-/data}"
if ! mkdir -p "$D" 2>/dev/null || [ ! -w "$D" ]; then
    export DATA_DIR=/tmp/tactiq-data
    mkdir -p "$DATA_DIR"
fi
exec "$@"
