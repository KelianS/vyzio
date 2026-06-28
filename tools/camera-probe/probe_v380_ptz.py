"""
V380 Pro — PTZ raw SOAP probe (same requests as OnvifPtzClient.cs)
Tests ContinuousMove+Stop (baseline), then RelativeMove, GetStatus, SetPreset, GotoPreset.

Usage:
    python probe_v380_ptz.py <IP> <user> <password> [onvif_port]
    Default ONVIF port: 8899
"""

import sys
import hashlib
import base64
import os
import datetime
import time
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


def extract_body(raw):
    try:
        root = ET.fromstring(raw)
        ns = {"s": "http://www.w3.org/2003/05/soap-envelope"}
        body = root.find("s:Body", ns)
        if body is not None:
            return ET.tostring(body, encoding="unicode")
    except Exception:
        pass
    return raw[:600]


def soap_post(url, username, password, body, label):
    envelope = build_envelope(username, password, body)
    req = urllib.request.Request(
        url,
        data=envelope.encode("utf-8"),
        headers={"Content-Type": "application/soap+xml; charset=utf-8"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=5) as resp:
            raw = resp.read().decode("utf-8", errors="replace")
            print(f"      [OK {resp.status}] {label}")
            print(f"      {extract_body(raw)}")
            return raw
    except urllib.error.HTTPError as e:
        raw = e.read().decode("utf-8", errors="replace")
        print(f"      [HTTP {e.code}] {label}")
        print(f"      {extract_body(raw)}")
        return None
    except Exception as e:
        print(f"      [ERR] {label}: {e}")
        return None


def run(host, user, password, port=8899):
    print(f"\n=== V380 Pro PTZ raw SOAP probe on {host}:{port} ===\n")
    media_url = f"http://{host}:{port}/onvif/media_service"
    ptz_url   = f"http://{host}:{port}/onvif/ptz_service"

    # ── Get profile token ──────────────────────────────────────────────────────
    print("[1/7] GetProfiles...")
    raw = soap_post(media_url, user, password,
        '<GetProfiles xmlns="http://www.onvif.org/ver10/media/wsdl"/>',
        "GetProfiles")
    token = "stream0_0"
    if raw and 'token="' in raw:
        token = raw.split('token="')[1].split('"')[0]
    print(f"      Using profile token: {token}\n")

    VELOCITY_SPACE = "http://www.onvif.org/ver10/tptz/PanTiltSpaces/VelocityGenericSpace"

    # ── Init : butée gauche ────────────────────────────────────────────────────
    print("[init] Butée GAUCHE (sans space)...")
    soap_post(ptz_url, user, password, f"""
        <ContinuousMove xmlns="http://www.onvif.org/ver20/ptz/wsdl">
          <ProfileToken>{token}</ProfileToken>
          <Velocity>
            <PanTilt x="-1.0" y="0.0" xmlns="http://www.onvif.org/ver10/schema"/>
          </Velocity>
        </ContinuousMove>""", "init gauche")
    time.sleep(3)
    soap_post(ptz_url, user, password, f"""
        <Stop xmlns="http://www.onvif.org/ver20/ptz/wsdl">
          <ProfileToken>{token}</ProfileToken>
          <PanTilt>true</PanTilt><Zoom>true</Zoom>
        </Stop>""", "Stop")
    time.sleep(1)

    # ── [A] AVEC space, x=1.0 (pleine vitesse), Timeout=PT1S ─────────────────
    print("\n[A] space + x=1.0 (pleine vitesse) + Timeout=PT1S")
    print("    → devrait bouger à fond pendant exactement 1s puis s'arrêter seule")
    soap_post(ptz_url, user, password, f"""
        <ContinuousMove xmlns="http://www.onvif.org/ver20/ptz/wsdl">
          <ProfileToken>{token}</ProfileToken>
          <Velocity>
            <PanTilt x="1.0" y="0.0" space="{VELOCITY_SPACE}" xmlns="http://www.onvif.org/ver10/schema"/>
          </Velocity>
          <Timeout>PT1S</Timeout>
        </ContinuousMove>""", "space + x=1.0 + Timeout=1s")
    time.sleep(4)

    # ── [B] AVEC space, x=1.0, Timeout=PT2S ──────────────────────────────────
    print("\n[B] space + x=-1.0 (gauche) + Timeout=PT2S")
    print("    → devrait bouger 2s puis s'arrêter. Amplitude = 2x celle de [A]")
    soap_post(ptz_url, user, password, f"""
        <ContinuousMove xmlns="http://www.onvif.org/ver20/ptz/wsdl">
          <ProfileToken>{token}</ProfileToken>
          <Velocity>
            <PanTilt x="-1.0" y="0.0" space="{VELOCITY_SPACE}" xmlns="http://www.onvif.org/ver10/schema"/>
          </Velocity>
          <Timeout>PT2S</Timeout>
        </ContinuousMove>""", "space + x=-1.0 + Timeout=2s")
    time.sleep(5)

    # ── GetStatus ──────────────────────────────────────────────────────────────
    print("\n[4/7] GetStatus...")
    soap_post(ptz_url, user, password, f"""
        <GetStatus xmlns="http://www.onvif.org/ver20/ptz/wsdl">
          <ProfileToken>{token}</ProfileToken>
        </GetStatus>""", "GetStatus")

    # ── RelativeMove ──────────────────────────────────────────────────────────
    print("\n[5/7] RelativeMove pan=0.05...")
    soap_post(ptz_url, user, password, f"""
        <RelativeMove xmlns="http://www.onvif.org/ver20/ptz/wsdl">
          <ProfileToken>{token}</ProfileToken>
          <Translation>
            <PanTilt x="0.0500" y="0.0000" xmlns="http://www.onvif.org/ver10/schema"/>
          </Translation>
        </RelativeMove>""", "RelativeMove")

    # ── SetPreset ──────────────────────────────────────────────────────────────
    print("\n[6/7] SetPreset token=1...")
    soap_post(ptz_url, user, password, f"""
        <SetPreset xmlns="http://www.onvif.org/ver20/ptz/wsdl">
          <ProfileToken>{token}</ProfileToken>
          <PresetToken>1</PresetToken>
          <PresetName>vyzio_home</PresetName>
        </SetPreset>""", "SetPreset")

    # ── GotoPreset ─────────────────────────────────────────────────────────────
    print("\n[7/7] GotoPreset token=1...")
    soap_post(ptz_url, user, password, f"""
        <GotoPreset xmlns="http://www.onvif.org/ver20/ptz/wsdl">
          <ProfileToken>{token}</ProfileToken>
          <PresetToken>1</PresetToken>
          <Speed>
            <PanTilt x="1.0" y="1.0" xmlns="http://www.onvif.org/ver10/schema"/>
          </Speed>
        </GotoPreset>""", "GotoPreset")

    print("\n=== Probe complete ===\n")


if __name__ == "__main__":
    if len(sys.argv) < 4:
        print("Usage: python probe_v380_ptz.py <IP> <user> <password> [onvif_port]")
        sys.exit(1)
    port = int(sys.argv[4]) if len(sys.argv) > 4 else 8899
    run(sys.argv[1], sys.argv[2], sys.argv[3], port)
