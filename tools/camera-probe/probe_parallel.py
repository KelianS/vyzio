"""
V380 Pro — test connexions TCP parallèles ONVIF.
Envoie ContinuousMove et Stop simultanément sur deux connexions séparées.
Si la caméra accepte les connexions parallèles, Stop sera exécuté pendant le traitement de Move.

Usage:
    python probe_parallel.py <IP> <user> <password> [port]
"""

import sys
import hashlib
import base64
import os
import datetime
import time
import threading
import urllib.request
import urllib.error


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


def send(url, user, password, body, label, results, timeout=6):
    t0 = time.time()
    envelope = build_envelope(user, password, body)
    req = urllib.request.Request(
        url,
        data=envelope.encode("utf-8"),
        headers={"Content-Type": "application/soap+xml; charset=utf-8", "Connection": "close"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            elapsed = (time.time() - t0) * 1000
            results[label] = f"[OK {resp.status}] in {elapsed:.0f}ms"
    except urllib.error.HTTPError as e:
        elapsed = (time.time() - t0) * 1000
        results[label] = f"[HTTP {e.code}] in {elapsed:.0f}ms"
    except Exception as e:
        elapsed = (time.time() - t0) * 1000
        results[label] = f"[ERR {elapsed:.0f}ms] {e}"


def run(host, user, password, port=8899):
    ptz_url = f"http://{host}:{port}/onvif/ptz_service"
    media_url = f"http://{host}:{port}/onvif/media_service"

    print(f"\n=== Parallel connection test — {host}:{port} ===\n")

    # Get profile token first
    results = {}
    send(media_url, user, password,
         '<GetProfiles xmlns="http://www.onvif.org/ver10/media/wsdl"/>',
         "GetProfiles", results)
    print(f"GetProfiles: {results.get('GetProfiles')}")
    token = "stream0_0"

    move_body = f"""
        <ContinuousMove xmlns="http://www.onvif.org/ver20/ptz/wsdl">
          <ProfileToken>{token}</ProfileToken>
          <Velocity>
            <PanTilt x="1.0" y="0.0" xmlns="http://www.onvif.org/ver10/schema"/>
          </Velocity>
        </ContinuousMove>"""

    stop_body = f"""
        <Stop xmlns="http://www.onvif.org/ver20/ptz/wsdl">
          <ProfileToken>{token}</ProfileToken>
          <PanTilt>true</PanTilt>
          <Zoom>true</Zoom>
        </Stop>"""

    # ── Test 1 : Move séquentiel puis Stop (comportement actuel) ──────────────
    print("\n[Test 1] Move puis Stop séquentiels (comportement actuel)")
    print("  → Si caméra sérialise : Stop arrive ~2.7s après Move → bouger longtemps")
    results = {}
    t0 = time.time()
    send(ptz_url, user, password, move_body, "Move", results, timeout=6)
    print(f"  Move: {results.get('Move')} (t={int((time.time()-t0)*1000)}ms)")
    time.sleep(0.1)
    send(ptz_url, user, password, stop_body, "Stop", results, timeout=6)
    print(f"  Stop: {results.get('Stop')} (t={int((time.time()-t0)*1000)}ms)")
    print("  → Observer si la caméra a bougé longtemps")
    input("  Appuie sur Entrée quand tu as observé...")
    time.sleep(2)

    # ── Test 2 : Move et Stop en parallèle sur deux threads ───────────────────
    print("\n[Test 2] Move et Stop SIMULTANÉS sur deux connexions TCP parallèles")
    print("  → Si caméra accepte 2 connexions : Stop exécuté en parallèle → mouvement court")
    print("  → Si caméra rejette 2ème connexion : Stop en queue → même comportement que Test 1")
    results = {}
    t0 = time.time()

    delay_before_stop = 0.1  # 100ms

    def do_move():
        send(ptz_url, user, password, move_body, "Move", results, timeout=6)
        print(f"  Move response: {results.get('Move')} (t={int((time.time()-t0)*1000)}ms)")

    def do_stop():
        time.sleep(delay_before_stop)
        send(ptz_url, user, password, stop_body, "Stop", results, timeout=6)
        print(f"  Stop response: {results.get('Stop')} (t={int((time.time()-t0)*1000)}ms)")

    t_move = threading.Thread(target=do_move)
    t_stop = threading.Thread(target=do_stop)

    t_move.start()
    t_stop.start()
    t_move.join()
    t_stop.join()

    print("  → Observer si la caméra a fait un step court ou a bougé longtemps")
    print("\n=== Probe complete ===\n")


if __name__ == "__main__":
    if len(sys.argv) < 4:
        print("Usage: python probe_parallel.py <IP> <user> <password> [port]")
        sys.exit(1)
    port = int(sys.argv[4]) if len(sys.argv) > 4 else 8899
    run(sys.argv[1], sys.argv[2], sys.argv[3], port)
