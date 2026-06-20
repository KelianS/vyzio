"""
ONVIF capability probe — identifie ce que la caméra supporte pour PtzStepAsync.
Teste: GetProfiles → PTZ config token → GetConfigurationOptions → GetStatus.
Reproduit exactement la logique de GetPtzCapabilitiesAsync dans OnvifPtzClient.cs.

Usage:
    python probe_capabilities.py <IP> <user> <password> [onvif_port]
    Default ONVIF port: 8899
"""

import sys
import hashlib
import base64
import os
import datetime
import urllib.request
import urllib.error
import xml.etree.ElementTree as ET


def build_envelope(username, password, body):
    nonce_bytes = os.urandom(16)
    nonce_b64 = base64.b64encode(nonce_bytes).decode()
    created = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    digest_input = nonce_bytes + created.encode() + password.encode()
    digest = base64.b64encode(hashlib.sha1(digest_input).digest()).decode()
    return f"""<?xml version="1.0" encoding="utf-8"?>
<s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope"
            xmlns:wsse="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd"
            xmlns:wsu="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-utility-1.0.xsd">
  <s:Header>
    <wsse:Security>
      <wsse:UsernameToken>
        <wsse:Username>{username}</wsse:Username>
        <wsse:Password Type="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-username-token-profile-1.0#PasswordDigest">{digest}</wsse:Password>
        <wsse:Nonce EncodingType="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-soap-message-security-1.0#Base64Binary">{nonce_b64}</wsse:Nonce>
        <wsu:Created>{created}</wsu:Created>
      </wsse:UsernameToken>
    </wsse:Security>
  </s:Header>
  <s:Body>
    {body}
  </s:Body>
</s:Envelope>"""


def soap_post(url, username, password, body, label, timeout=5):
    envelope = build_envelope(username, password, body)
    req = urllib.request.Request(
        url,
        data=envelope.encode("utf-8"),
        headers={"Content-Type": "application/soap+xml; charset=utf-8"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read().decode("utf-8", errors="replace")
            print(f"  [OK {resp.status}] {label}")
            return raw
    except urllib.error.HTTPError as e:
        raw = e.read().decode("utf-8", errors="replace")
        print(f"  [HTTP {e.code}] {label}")
        return None
    except Exception as e:
        print(f"  [ERR] {label}: {e}")
        return None


def find_all_local(xml_str, local_name):
    """Find all elements with a given local name, ignoring namespace."""
    try:
        root = ET.fromstring(xml_str)
        return [e for e in root.iter() if e.tag.split("}")[-1] == local_name]
    except Exception:
        return []


def run(host, user, password, port=8899):
    print(f"\n=== ONVIF capability probe — {host}:{port} ===")
    print("Reproduces OnvifPtzClient.GetPtzCapabilitiesAsync logic\n")

    media_url = f"http://{host}:{port}/onvif/media_service"
    ptz_url   = f"http://{host}:{port}/onvif/ptz_service"

    # ── Step 1: GetProfiles → profile token + PTZ config token ────────────────
    print("[1] GetProfiles (media_service)...")
    raw = soap_post(media_url, user, password,
        '<GetProfiles xmlns="http://www.onvif.org/ver10/media/wsdl"/>',
        "GetProfiles")

    profile_token = "stream0_0"
    ptz_config_token = "ptz_config_0"

    if raw:
        profiles = find_all_local(raw, "Profiles")
        if profiles:
            profile_token = profiles[0].get("token", profile_token)
            ptz_cfgs = [e for e in profiles[0].iter() if e.tag.split("}")[-1] == "PTZConfiguration"]
            if ptz_cfgs:
                ptz_config_token = ptz_cfgs[0].get("token", ptz_config_token)

    print(f"     Profile token    : {profile_token}")
    print(f"     PTZ config token : {ptz_config_token}\n")

    # ── Step 2: GetConfigurationOptions ───────────────────────────────────────
    print("[2] GetConfigurationOptions (ptz_service) — THE KEY CALL...")
    raw_opts = soap_post(ptz_url, user, password, f"""
        <GetConfigurationOptions xmlns="http://www.onvif.org/ver20/ptz/wsdl">
          <ConfigurationToken>{ptz_config_token}</ConfigurationToken>
        </GetConfigurationOptions>""",
        "GetConfigurationOptions")

    if raw_opts is None:
        print("     → response: null (HTTP error or timeout)")
        supports_relative = False
        supports_timeout = False
    else:
        print(f"     → raw response ({len(raw_opts)} chars):")
        print(f"       {raw_opts[:1200]}")

        rel_spaces = find_all_local(raw_opts, "RelativePanTiltTranslationSpace")
        timeout_els = find_all_local(raw_opts, "PTZTimeout")
        supports_relative = len(rel_spaces) > 0
        supports_timeout = len(timeout_els) > 0

        if rel_spaces:
            print(f"\n     RelativePanTiltTranslationSpace elements found: {len(rel_spaces)}")
            for el in rel_spaces:
                print(f"       {ET.tostring(el, encoding='unicode')}")
        if timeout_els:
            print(f"\n     PTZTimeout elements found: {len(timeout_els)}")
            for el in timeout_els:
                print(f"       {ET.tostring(el, encoding='unicode')}")

    print()
    print("=" * 60)
    print(f"  SupportsRelativeMove : {supports_relative}")
    print(f"  SupportsTimeout      : {supports_timeout}")
    if supports_relative:
        print("  → PtzStepAsync branch: RelativeMove (best, no overshoot)")
    elif supports_timeout:
        print("  → PtzStepAsync branch: ContinuousMove + Timeout (no Stop call!)")
        print("  ⚠ If camera ignores Timeout, it will go to end stop!")
    else:
        print("  → PtzStepAsync branch: ContinuousMove + Task.Delay + Stop (V380 fallback)")
    print("=" * 60)

    # ── Step 3: GetStatus (bonus) ─────────────────────────────────────────────
    print(f"\n[3] GetStatus (bonus — does camera report position?)...")
    soap_post(ptz_url, user, password, f"""
        <GetStatus xmlns="http://www.onvif.org/ver20/ptz/wsdl">
          <ProfileToken>{profile_token}</ProfileToken>
        </GetStatus>""",
        "GetStatus")

    print("\n=== Probe complete ===\n")


if __name__ == "__main__":
    if len(sys.argv) < 4:
        print("Usage: python probe_capabilities.py <IP> <user> <password> [onvif_port]")
        sys.exit(1)
    port = int(sys.argv[4]) if len(sys.argv) > 4 else 8899
    run(sys.argv[1], sys.argv[2], sys.argv[3], port)
