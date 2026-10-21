"""Publica regras e Hosting com o token temporário da sessão gcloud.

Uso no Cloud Shell, após `gcloud auth login` e `npm run build` em front/:
    python3 scripts/deploy-firebase-rest.py

Não cria credenciais de serviço ou ADC e nunca imprime o token.
"""

from __future__ import annotations

import base64
import gzip
import hashlib
import json
import subprocess
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PROJECT = json.loads((ROOT / ".firebaserc").read_text(encoding="utf-8"))["projects"]["default"]
SITE = PROJECT
BUCKET = f"{PROJECT}.firebasestorage.app"
DIST = ROOT / "front" / "dist" / "front"
RULES_API = f"https://firebaserules.googleapis.com/v1/projects/{PROJECT}"
HOSTING_API = f"https://firebasehosting.googleapis.com/v1beta1/sites/{SITE}"


def access_token() -> str:
    result = subprocess.run(
        ["gcloud", "auth", "print-access-token"],
        capture_output=True,
        text=True,
        check=True,
    )
    token = result.stdout.strip()
    if not token:
        raise RuntimeError("A sessão gcloud não retornou token.")
    return token


TOKEN = ""


def api(method: str, url: str, payload: dict | bytes | None = None, binary: bool = False) -> dict:
    if isinstance(payload, dict):
        body = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    else:
        body = payload
    headers = {
        "Authorization": f"Bearer {TOKEN}",
        "x-goog-user-project": PROJECT,
        "Content-Type": "application/octet-stream" if binary else "application/json",
    }
    request = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(request, timeout=90) as response:
            data = response.read()
            return json.loads(data) if data and not binary else {}
    except urllib.error.HTTPError as error:
        detail = error.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"{method} {url}: HTTP {error.code}: {detail[:1500]}") from None


def release_rules(filename: str, release_name: str) -> None:
    source = (ROOT / filename).read_text(encoding="utf-8")
    fingerprint = base64.b64encode(hashlib.sha256(source.encode("utf-8")).digest()).decode("ascii")
    created = api(
        "POST",
        f"{RULES_API}/rulesets",
        {"source": {"files": [{"name": filename, "content": source, "fingerprint": fingerprint}]}},
    )
    ruleset_name = created["name"]
    api(
        "PATCH",
        f"https://firebaserules.googleapis.com/v1/{release_name}",
        {"release": {"name": release_name, "rulesetName": ruleset_name}, "updateMask": "rulesetName"},
    )
    current = api("GET", f"https://firebaserules.googleapis.com/v1/{release_name}")
    if current.get("rulesetName") != ruleset_name:
        raise RuntimeError(f"A atualização de {release_name} não foi confirmada.")
    print(f"Regras publicadas: {filename} -> {ruleset_name}", flush=True)


def hosting_config() -> dict:
    config = json.loads((ROOT / "firebase.json").read_text(encoding="utf-8"))["hosting"]
    rewrites = []
    for rule in config["rewrites"]:
        rewrite = {"glob": rule["source"]}
        if "run" in rule:
            rewrite["run"] = rule["run"]
        else:
            rewrite["path"] = rule["destination"]
        rewrites.append(rewrite)
    return {"rewrites": rewrites}


def files_to_upload() -> tuple[dict[str, str], dict[str, bytes]]:
    if not (DIST / "index.html").is_file():
        raise RuntimeError("Build ausente. Execute `cd front && npm ci && npm run build`.")
    files: dict[str, str] = {}
    blobs: dict[str, bytes] = {}
    for path in sorted(DIST.rglob("*")):
        if not path.is_file():
            continue
        public_path = "/" + path.relative_to(DIST).as_posix()
        compressed = gzip.compress(path.read_bytes(), mtime=0)
        digest = hashlib.sha256(compressed).hexdigest()
        files[public_path] = digest
        blobs[digest] = compressed
    return files, blobs


def release_hosting() -> None:
    files, blobs = files_to_upload()
    created = api("POST", f"{HOSTING_API}/versions", {"config": hosting_config()})
    version_name = created["name"]
    for offset in range(0, len(files), 1000):
        chunk = dict(list(files.items())[offset : offset + 1000])
        populated = api(
            "POST",
            f"https://firebasehosting.googleapis.com/v1beta1/{version_name}:populateFiles",
            {"files": chunk},
        )
        upload_url = populated["uploadUrl"].rstrip("/")
        for digest in populated.get("uploadRequiredHashes", []):
            api("POST", f"{upload_url}/{digest}", blobs[digest], binary=True)
    finalized = api(
        "PATCH",
        f"https://firebasehosting.googleapis.com/v1beta1/{version_name}?update_mask=status",
        {"status": "FINALIZED"},
    )
    if finalized.get("status") != "FINALIZED":
        raise RuntimeError(f"A versão {version_name} não foi finalizada.")
    url = f"{HOSTING_API}/releases?versionName={urllib.parse.quote(version_name, safe='/')}"
    release = api("POST", url, {})
    if release.get("version", {}).get("name") != version_name:
        raise RuntimeError("O release do Hosting não foi confirmado.")
    print(f"Hosting publicado: {len(files)} arquivos, {version_name}", flush=True)


def main() -> None:
    global TOKEN
    if len(sys.argv) > 1 and sys.argv[1] == "--check":
        files, _ = files_to_upload()
        print(f"Build pronto: {len(files)} arquivos; projeto {PROJECT}; site {SITE}")
        print(f"Rewrites: {json.dumps(hosting_config(), ensure_ascii=False)}")
        return
    TOKEN = access_token()
    releases = api("GET", f"{RULES_API}/releases").get("releases", [])
    available = {entry["name"] for entry in releases}
    firestore = f"projects/{PROJECT}/releases/cloud.firestore"
    storage = f"projects/{PROJECT}/releases/firebase.storage/{BUCKET}"
    if not {firestore, storage} <= available:
        raise RuntimeError("Releases atuais não correspondem ao projeto e bucket esperados.")
    release_rules("firestore.rules", firestore)
    release_rules("storage.rules", storage)
    release_hosting()


if __name__ == "__main__":
    main()
