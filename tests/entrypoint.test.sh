#!/bin/sh
# Shell unit tests for entrypoint.sh auth logic.
# Exercises the config-selection and htpasswd-generation paths without starting nginx or bun.

set -e

PASS=0
FAIL=0

_pass() { PASS=$((PASS + 1)); printf 'PASS  %s\n' "$1"; }
_fail() { FAIL=$((FAIL + 1)); printf 'FAIL  %s\n' "$1"; }

# ---------------------------------------------------------------------------
# Harness: runs the S3-validation + auth-selection blocks of entrypoint.sh
# in a temp workspace. Arguments are KEY=VALUE pairs to export.
# Prints: "<tmpdir> <exit_code>"
# ---------------------------------------------------------------------------
run_entrypoint_block() {
    _tmpdir="$(mktemp -d)"
    _confdir="$_tmpdir/conf.d"
    mkdir -p "$_confdir"

    printf 'noauth-config\n' > "$_confdir/nginx.conf.noauth"
    printf 'auth-config\n'   > "$_confdir/nginx.conf.auth"

    for kv in "$@"; do
        export "$kv"
    done

    _exit=0
    (
        # --- S3 required-var validation block (mirrored from entrypoint.sh) ---
        missing=""
        for var in S3_ACCESS_KEY_ID S3_SECRET_ACCESS_KEY S3_ENDPOINT S3_REGION; do
            eval "val=\$$var"
            if [ -z "$val" ]; then
                missing="$missing $var"
            fi
        done
        if [ -n "$missing" ]; then
            echo "Error: missing required environment variables:$missing" >&2
            exit 1
        fi

        # --- Auth guard blocks ---
        if [ -n "$AUTH_PASSWORD" ] && [ -z "$AUTH_USERNAME" ]; then
            echo "Error: AUTH_PASSWORD is set but AUTH_USERNAME is not" >&2
            exit 1
        fi

        if [ -n "$AUTH_USERNAME" ] && [ -z "$AUTH_PASSWORD" ]; then
            echo "Error: AUTH_USERNAME is set but AUTH_PASSWORD is not" >&2
            exit 1
        fi

        # --- Auth config-selection block ---
        if [ -n "$AUTH_PASSWORD" ]; then
            _auth_username="$AUTH_USERNAME"
            _auth_username_clean="$(printf '%s' "$_auth_username" | tr -d ':\r\n')"
            if [ "$_auth_username_clean" != "$_auth_username" ]; then
                echo "Error: AUTH_USERNAME must not contain ':', newline, or carriage return" >&2
                exit 1
            fi
            (umask 027; printf '%s:%s\n' "$_auth_username" "$(openssl passwd -apr1 "$AUTH_PASSWORD")" > "$_tmpdir/.htpasswd")
            cp "$_confdir/nginx.conf.auth" "$_confdir/default.conf"
        else
            cp "$_confdir/nginx.conf.noauth" "$_confdir/default.conf"
        fi
    ) 2>"$_tmpdir/stderr" || _exit=$?

    for kv in "$@"; do
        _key="${kv%%=*}"
        unset "$_key"
    done

    printf '%s %s\n' "$_tmpdir" "$_exit"
}

# ---------------------------------------------------------------------------
# S3 required-variable validation
# ---------------------------------------------------------------------------
_out="$(run_entrypoint_block)"
_dir="${_out% *}"; _code="${_out##* }"
if [ "$_code" -ne 0 ] && grep -q "S3_ACCESS_KEY_ID" "$_dir/stderr" 2>/dev/null; then
    _pass "missing all S3 vars → exit 1 with var names in message"
else
    _fail "missing all S3 vars → exit 1 with var names in message (exit=$_code)"
fi
rm -rf "$_dir"

_out="$(run_entrypoint_block "S3_ACCESS_KEY_ID=k" "S3_SECRET_ACCESS_KEY=s" "S3_ENDPOINT=e" "S3_REGION=r")"
_dir="${_out% *}"; _code="${_out##* }"
if [ "$_code" -eq 0 ]; then
    _pass "all S3 vars present → proceeds without error"
else
    _fail "all S3 vars present → proceeds without error (exit=$_code)"
fi
rm -rf "$_dir"

_out="$(run_entrypoint_block "S3_ACCESS_KEY_ID=k" "S3_ENDPOINT=e" "S3_REGION=r")"
_dir="${_out% *}"; _code="${_out##* }"
if [ "$_code" -ne 0 ] && grep -q "S3_SECRET_ACCESS_KEY" "$_dir/stderr" 2>/dev/null; then
    _pass "missing one S3 var → exit 1 naming the missing var"
else
    _fail "missing one S3 var → exit 1 naming the missing var (exit=$_code)"
fi
rm -rf "$_dir"

# ---------------------------------------------------------------------------
# AUTH_PASSWORD without AUTH_USERNAME fails fast
# ---------------------------------------------------------------------------
_out="$(run_entrypoint_block "S3_ACCESS_KEY_ID=k" "S3_SECRET_ACCESS_KEY=s" "S3_ENDPOINT=e" "S3_REGION=r" "AUTH_PASSWORD=secret")"
_dir="${_out% *}"; _code="${_out##* }"
if [ "$_code" -ne 0 ] && grep -q "AUTH_USERNAME" "$_dir/stderr" 2>/dev/null; then
    _pass "AUTH_PASSWORD set without AUTH_USERNAME → exit 1"
else
    _fail "AUTH_PASSWORD set without AUTH_USERNAME → exit 1 (exit=$_code)"
fi
rm -rf "$_dir"

# ---------------------------------------------------------------------------
# AUTH_USERNAME without AUTH_PASSWORD fails fast
# ---------------------------------------------------------------------------
_out="$(run_entrypoint_block "S3_ACCESS_KEY_ID=k" "S3_SECRET_ACCESS_KEY=s" "S3_ENDPOINT=e" "S3_REGION=r" "AUTH_USERNAME=andri")"
_dir="${_out% *}"; _code="${_out##* }"
if [ "$_code" -ne 0 ] && grep -q "AUTH_PASSWORD" "$_dir/stderr" 2>/dev/null; then
    _pass "AUTH_USERNAME set without AUTH_PASSWORD → exit 1"
else
    _fail "AUTH_USERNAME set without AUTH_PASSWORD → exit 1 (exit=$_code)"
fi
rm -rf "$_dir"

# ---------------------------------------------------------------------------
# No AUTH_PASSWORD → noauth config selected
# ---------------------------------------------------------------------------
_out="$(run_entrypoint_block "S3_ACCESS_KEY_ID=k" "S3_SECRET_ACCESS_KEY=s" "S3_ENDPOINT=e" "S3_REGION=r")"
_dir="${_out% *}"; _code="${_out##* }"
if [ "$_code" -eq 0 ] && [ "$(cat "$_dir/conf.d/default.conf")" = "noauth-config" ]; then
    _pass "no auth vars → noauth config selected"
else
    _fail "no auth vars → noauth config selected (exit=$_code)"
fi
rm -rf "$_dir"

# ---------------------------------------------------------------------------
# AUTH_PASSWORD + AUTH_USERNAME → auth config selected + .htpasswd created
# ---------------------------------------------------------------------------
_out="$(run_entrypoint_block "S3_ACCESS_KEY_ID=k" "S3_SECRET_ACCESS_KEY=s" "S3_ENDPOINT=e" "S3_REGION=r" "AUTH_PASSWORD=secret" "AUTH_USERNAME=andri")"
_dir="${_out% *}"; _code="${_out##* }"
if [ "$_code" -eq 0 ] && [ "$(cat "$_dir/conf.d/default.conf")" = "auth-config" ]; then
    _pass "AUTH_PASSWORD + AUTH_USERNAME selects auth config"
else
    _fail "AUTH_PASSWORD + AUTH_USERNAME selects auth config (exit=$_code)"
fi
if [ -f "$_dir/.htpasswd" ]; then
    _pass "AUTH_PASSWORD + AUTH_USERNAME creates .htpasswd"
else
    _fail "AUTH_PASSWORD + AUTH_USERNAME creates .htpasswd"
fi
rm -rf "$_dir"

# ---------------------------------------------------------------------------
# AUTH_USERNAME used as htpasswd username
# ---------------------------------------------------------------------------
_out="$(run_entrypoint_block "S3_ACCESS_KEY_ID=k" "S3_SECRET_ACCESS_KEY=s" "S3_ENDPOINT=e" "S3_REGION=r" "AUTH_PASSWORD=secret" "AUTH_USERNAME=bob")"
_dir="${_out% *}"; _code="${_out##* }"
_line="$(cat "$_dir/.htpasswd" 2>/dev/null || echo '')"
case "$_line" in
    bob:*) _pass "AUTH_USERNAME used as htpasswd username" ;;
    *)     _fail "AUTH_USERNAME used as htpasswd username (got: $_line)" ;;
esac
rm -rf "$_dir"

# ---------------------------------------------------------------------------
# .htpasswd password is apr1-hashed
# ---------------------------------------------------------------------------
_out="$(run_entrypoint_block "S3_ACCESS_KEY_ID=k" "S3_SECRET_ACCESS_KEY=s" "S3_ENDPOINT=e" "S3_REGION=r" "AUTH_PASSWORD=secret" "AUTH_USERNAME=andri")"
_dir="${_out% *}"; _code="${_out##* }"
_line="$(cat "$_dir/.htpasswd" 2>/dev/null || echo '')"
_hash="${_line#*:}"
case "$_hash" in
    '$apr1$'*) _pass ".htpasswd password is apr1-hashed" ;;
    *)         _fail ".htpasswd password is apr1-hashed (got: $_hash)" ;;
esac
rm -rf "$_dir"

# ---------------------------------------------------------------------------
# .htpasswd is created with restricted permissions (umask 027 → mode 640)
# ---------------------------------------------------------------------------
_out="$(run_entrypoint_block "S3_ACCESS_KEY_ID=k" "S3_SECRET_ACCESS_KEY=s" "S3_ENDPOINT=e" "S3_REGION=r" "AUTH_PASSWORD=secret" "AUTH_USERNAME=andri")"
_dir="${_out% *}"; _code="${_out##* }"
_perms="$(stat -c '%a' "$_dir/.htpasswd" 2>/dev/null || stat -f '%OLp' "$_dir/.htpasswd" 2>/dev/null || echo 'unknown')"
if [ "$_perms" = "640" ]; then
    _pass ".htpasswd created with mode 640"
else
    _fail ".htpasswd created with mode 640 (got: $_perms)"
fi
rm -rf "$_dir"

# ---------------------------------------------------------------------------
# AUTH_USERNAME with colon → exit 1
# ---------------------------------------------------------------------------
_out="$(run_entrypoint_block "S3_ACCESS_KEY_ID=k" "S3_SECRET_ACCESS_KEY=s" "S3_ENDPOINT=e" "S3_REGION=r" "AUTH_PASSWORD=secret" "AUTH_USERNAME=foo:bar")"
_dir="${_out% *}"; _code="${_out##* }"
if [ "$_code" -ne 0 ]; then
    _pass "AUTH_USERNAME with colon → exit 1"
else
    _fail "AUTH_USERNAME with colon → exit 1 (exit=$_code)"
fi
rm -rf "$_dir"

# ---------------------------------------------------------------------------
# .htpasswd absent when no auth
# ---------------------------------------------------------------------------
_out="$(run_entrypoint_block "S3_ACCESS_KEY_ID=k" "S3_SECRET_ACCESS_KEY=s" "S3_ENDPOINT=e" "S3_REGION=r")"
_dir="${_out% *}"; _code="${_out##* }"
if [ ! -f "$_dir/.htpasswd" ]; then
    _pass "no auth vars → .htpasswd not created"
else
    _fail "no auth vars → .htpasswd not created"
fi
rm -rf "$_dir"

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
printf '\n%d passed, %d failed\n' "$PASS" "$FAIL"
[ "$FAIL" -eq 0 ]
