#!/usr/bin/env bash
set -euo pipefail

codex_binary="${HOME}/.codex/packages/standalone/current/bin/codex"
if [[ ! -f "$codex_binary" || ! -x "$codex_binary" ]]; then
    printf 'Install Codex standalone on the host first: %s\n' "$codex_binary" >&2
    exit 1
fi
if ! "$codex_binary" --version >/dev/null; then
    printf 'Host Codex could not run: %s\n' "$codex_binary" >&2
    exit 1
fi

# Prepare bind sources without reading or replacing existing credentials.
umask 077
for auth_file in "${HOME}/.codex/auth.json" "${HOME}/.claude/.credentials.json"; do
    mkdir -p "$(dirname "$auth_file")"
    if [[ ! -e "$auth_file" ]]; then
        printf '{}\n' >"$auth_file"
    fi
    if [[ ! -f "$auth_file" ]]; then
        printf 'Auth path is not a regular file: %s\n' "$auth_file" >&2
        exit 1
    fi
    chmod 600 "$auth_file"
done
mkdir -p "${HOME}/.config/gh"
chmod 700 "${HOME}/.config/gh"
