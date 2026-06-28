"""
V380 Pro — test keep-alive vs nouvelle connexion sur ptz_service.
Vérifie si la latence de 3s vient du handshake TCP ou du traitement firmware.

Usage:
    python probe_keepalive.py <IP> <user> <password> [port]
"""

import sys
import hashlib
import base64
import os
import datetime
import time
import http.client
import xml.etree.ElementTree as ET


def make_digest(password):
    nonce_bytes = os.urandom(16)
    nonce_b64 = base64.b64encode(nonce_bytes).decode()
    created = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    digest_input = nonce_bytes + created.encode() + password.encode()
    digest = base64.b64encode(hashlib.sha1(digest_input).digest()).decode()
    return nonce_b64, created, digest


def build_envelope(username, password, body):
    nonce_b64, created, digest = make_digest(password)
    return f"""<?xml version="1.0" encoding="utf-8"?>
<s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope"
            xmlns:wsse="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd"
            xmlns:wsu="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-utility-1.0.xsd">
  <s:Header><wsse:Security><wsse:UsernameToken>
    <wsse:Username>{username}</wsse:Username>
    <wsse:Password Type="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-username-token-profile-1.0#PasswordDigest">{digest}</wsse:Password>
    <wsse:Nonce EncodingType="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-soap-message-security-1.0#Base64Binary">{nonce_b64}</wsse:Nonce>
    <wsu:Created>{created}</wsu:Created>
  </wsse:UsernameToken></wsse:Security></s:Header>
  <s:Body>{body}</s:Body>
</s:Envelope>"""


def send_on_conn(conn, path, username, password, body, label, t0):
    """Envoie une requête sur une connexion existante (keep-alive)."""
    envelope = build_envelope(username, password, body)
    t_send = time.time()
    conn.request("POST", path,
                 body=envelope.encode("utf-8"),
                 headers={"Content-Type": "application/soap+xml; charset=utf-8"})
    try:
        resp = conn.getresponse()
        raw = resp.read()  # vider le buffer pour réutiliser la connexion
        elapsed = int((time.time() - t_send) * 1000)
        total = int((time.time() - t0) * 1000)
        print(f"  [{label}] HTTP {resp.status} — réponse en {elapsed}ms (t={total}ms)")
        return resp.status, raw.decode("utf-8", errors="replace")
    except Exception as e:
        elapsed = int((time.time() - t_send) * 1000)
        print(f"  [{label}] ERREUR après {elapsed}ms : {e}")
        return None, None


def run(host, user, password, port=8899):
    print(f"\n=== Keep-alive vs nouvelle connexion — {host}:{port} ===\n")
    t0 = time.time()

    token = "stream0_0"

    move_r = f"""<ContinuousMove xmlns="http://www.onvif.org/ver20/ptz/wsdl">
          <ProfileToken>{token}</ProfileToken>
          <Velocity><PanTilt x="1.0" y="0.0" xmlns="http://www.onvif.org/ver10/schema"/></Velocity>
        </ContinuousMove>"""

    stop_r = f"""<Stop xmlns="http://www.onvif.org/ver20/ptz/wsdl">
          <ProfileToken>{token}</ProfileToken>
          <PanTilt>true</PanTilt><Zoom>true</Zoom>
        </Stop>"""

    cfg_r = f"""<GetConfigurationOptions xmlns="http://www.onvif.org/ver20/ptz/wsdl">
          <ConfigurationToken>Anv_ptz_0</ConfigurationToken>
        </GetConfigurationOptions>"""

    # ── Test A : connexion fraîche pour chaque commande ───────────────────────
    print("[Test A] Nouvelle connexion TCP à chaque commande")
    for label, body in [("GetConfigOpts", cfg_r), ("ContinuousMove", move_r), ("Stop", stop_r)]:
        t0 = time.time()
        conn = http.client.HTTPConnection(host, port, timeout=8)
        try:
            send_on_conn(conn, "/onvif/ptz_service", user, password, body, label, t0)
        finally:
            conn.close()
        time.sleep(0.1)

    time.sleep(3)

    # ── Test B : même connexion TCP pour toutes les commandes ─────────────────
    print("\n[Test B] Connexion TCP unique (keep-alive) pour toutes les commandes")
    print("  → Si les 2ème/3ème commandes sont rapides : overhead = TCP connection init")
    print("  → Si toutes prennent 3s : overhead = traitement firmware PTZ")
    t0 = time.time()
    conn = http.client.HTTPConnection(host, port, timeout=10)
    try:
        send_on_conn(conn, "/onvif/ptz_service", user, password, cfg_r,  "GetConfigOpts (1er, warmup)", t0)
        send_on_conn(conn, "/onvif/ptz_service", user, password, move_r, "ContinuousMove (2ème)", t0)
        time.sleep(0.1)
        send_on_conn(conn, "/onvif/ptz_service", user, password, stop_r, "Stop (3ème, 100ms après Move)", t0)
    except Exception as e:
        print(f"  Connexion cassée : {e}")
    finally:
        conn.close()

    print("\n=== Probe complete ===\n")
    print("INTERPRÉTATION :")
    print("  Test A cmd 1 (GetConfigOpts) ≈ Test B cmd 1 (GetConfigOpts) → overhead = firmware, pas TCP")
    print("  Test B cmd 2/3 << Test A cmd 2/3 → keep-alive aide, overhead = TCP")
    print("  Test B cmd 2/3 ≈ Test A cmd 2/3 → keep-alive n'aide pas, overhead = firmware")


if __name__ == "__main__":
    if len(sys.argv) < 4:
        print("Usage: python probe_keepalive.py <IP> <user> <password> [port]")
        sys.exit(1)
    port = int(sys.argv[4]) if len(sys.argv) > 4 else 8899
    run(sys.argv[1], sys.argv[2], sys.argv[3], port)
