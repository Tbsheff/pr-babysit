#!/usr/bin/env bash
set -euo pipefail

VERSION="${PR_BABYSIT_VERSION:-0.1.3}"
REPO="${PR_BABYSIT_REPO:-Tbsheff/pr-babysit}"
PACKAGE_URL="${PR_BABYSIT_PACKAGE_URL:-https://github.com/${REPO}/releases/download/v${VERSION}/pr-babysit-${VERSION}.tgz}"

first_writable_path_dir() {
  old_ifs="${IFS}"
  IFS=":"
  for dir in ${PATH}; do
    if [ -n "${dir}" ] && [ -d "${dir}" ] && [ -w "${dir}" ]; then
      IFS="${old_ifs}"
      echo "${dir}"
      return 0
    fi
  done
  IFS="${old_ifs}"
  return 0
}

if ! command -v npm >/dev/null 2>&1; then
  echo "npm is required to install pr-babysit." >&2
  exit 1
fi

if ! command -v node >/dev/null 2>&1; then
  echo "node is required to run pr-babysit." >&2
  exit 1
fi

node_major="$(node -p 'Number(process.versions.node.split(".")[0])')"
if [ "${node_major}" -lt 22 ]; then
  echo "pr-babysit requires Node 22 or newer. Current node: $(node -v)" >&2
  exit 1
fi

npm_prefix="$(npm config get prefix 2>/dev/null || true)"
if [ -z "${npm_prefix}" ] || [ "${npm_prefix}" = "null" ]; then
  npm_prefix="$(npm prefix -g)"
fi

case "$(uname -s)" in
  MINGW*|MSYS*|CYGWIN*)
    npm_bin="${npm_prefix}"
    ;;
  *)
    npm_bin="${npm_prefix}/bin"
    ;;
esac

echo "Installing pr-babysit ${VERSION} from ${PACKAGE_URL}"
npm install -g "${PACKAGE_URL}"

export PATH="${npm_bin}:${PATH}"

if ! command -v pr-babysit >/dev/null 2>&1; then
  target="${npm_bin}/pr-babysit"
  shim_dir="$(first_writable_path_dir)"
  if [ -n "${shim_dir}" ] && [ -f "${target}" ]; then
    ln -sf "${target}" "${shim_dir}/pr-babysit"
    export PATH="${shim_dir}:${PATH}"
  fi
fi

if ! command -v pr-babysit >/dev/null 2>&1; then
  echo "Installed pr-babysit, but it is not on PATH." >&2
  echo "Add this to your shell profile:" >&2
  echo "  export PATH=\"${npm_bin}:\$PATH\"" >&2
  exit 1
fi

if command -v gh >/dev/null 2>&1; then
  if ! gh extension list 2>/dev/null | grep -q "cli/gh-webhook"; then
    gh extension install cli/gh-webhook
  fi
else
  echo "gh was not found. Install GitHub CLI and run: gh auth login" >&2
fi

pr-babysit setup secret
pr-babysit skills install
pr-babysit --help >/dev/null

echo "Installed $(command -v pr-babysit)"
echo "Run: pr-babysit watch OWNER/REPO#123"
