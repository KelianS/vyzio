"""
V380 Pro — probe port 8800 (protocole propriétaire).
Teste : banner TCP, protocole DVRIP/Sofia, fallback HTTP.

Usage:
    python probe_8800.py <IP> <user> <password>
"""

import sys
import socket
import struct
import json
import hashlib
import time


def tcp_read(sock, n, timeout=2):
    sock.settimeout(timeout)
    data = b""
    try:
        while len(data) < n:
            chunk = sock.recv(n - len(data))
            if not chunk:
                break
            data += chunk
    except socket.timeout:
        pass
    return data


def dvrip_md5(password):
    """Sofia/DVRIP password hash."""
    raw = hashlib.md5(password.encode()).digest()
    chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"
    result = ""
    for i in range(0, 16, 2):
        val = (raw[i] + raw[i + 1]) % len(chars)
        result += chars[val]
    return result


def build_dvrip_packet(msg_type, session_id, seq, payload_bytes):
    """DVRIP packet: 20-byte header + JSON payload."""
    header = struct.pack(
        "<BBBBIIBBHI",
        0xFF, 0x00, 0x00, 0x00,  # magic
        session_id,
        seq,
        0x00,                    # channel
        0x00,                    # reserved
        msg_type,
        len(payload_bytes),
    )
    return header + payload_bytes


def try_dvrip(host, port, user, password):
    print("\n[DVRIP/Sofia protocol]")
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.settimeout(4)
        s.connect((host, port))
        print(f"  TCP connecté à {host}:{port}")

        # Read banner (some devices send something on connect)
        banner = tcp_read(s, 256, timeout=1)
        if banner:
            print(f"  Banner reçu ({len(banner)} bytes): {banner[:64].hex()}")
            try:
                print(f"  Banner ASCII: {banner[:64].decode('ascii', errors='replace')}")
            except Exception:
                pass
        else:
            print("  Pas de banner (connexion silencieuse)")

        # Try DVRIP login (msg type 0x2DC = 764)
        login_payload = json.dumps({
            "LoginType": "DVRIP-Web",
            "UserName": user,
            "PassWord": dvrip_md5(password),
            "EncryptType": "MD5"
        }, separators=(",", ":")).encode() + b"\x0a"

        pkt = build_dvrip_packet(0x02DC, 0, 0, login_payload)
        t0 = time.time()
        s.sendall(pkt)
        print(f"  Login DVRIP envoyé ({len(pkt)} bytes)")

        resp = tcp_read(s, 512, timeout=3)
        elapsed = int((time.time() - t0) * 1000)
        if resp:
            print(f"  Réponse ({len(resp)} bytes, {elapsed}ms)")
            # Hex dump complet
            for i in range(0, len(resp), 16):
                chunk = resp[i:i+16]
                hex_part = " ".join(f"{b:02x}" for b in chunk)
                ascii_part = "".join(chr(b) if 32 <= b < 127 else "." for b in chunk)
                print(f"  {i:04x}  {hex_part:<47}  {ascii_part}")
            # Try DVRIP header at offset 0
            if len(resp) >= 20:
                magic = resp[:4]
                session_id = struct.unpack_from("<I", resp, 4)[0]
                seq = struct.unpack_from("<I", resp, 8)[0]
                msg_type = struct.unpack_from("<H", resp, 14)[0]
                payload_len = struct.unpack_from("<I", resp, 16)[0]
                print(f"\n  [DVRIP header parse] magic={magic.hex()} session={session_id:#010x} seq={seq} type={msg_type:#06x} payload_len={payload_len}")
                if payload_len > 0 and len(resp) >= 20 + payload_len:
                    body = resp[20:20 + payload_len]
                    print(f"  Body: {body.decode('utf-8', errors='replace')}")
        else:
            print(f"  Pas de réponse après {elapsed}ms")

        s.close()
        return bool(resp)
    except Exception as e:
        print(f"  DVRIP échec: {e}")
        return False


def try_http(host, port, path="/"):
    print(f"\n[HTTP fallback — GET {path}]")
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.settimeout(4)
        s.connect((host, port))
        req = f"GET {path} HTTP/1.0\r\nHost: {host}\r\nConnection: close\r\n\r\n"
        t0 = time.time()
        s.sendall(req.encode())
        resp = tcp_read(s, 512, timeout=3)
        elapsed = int((time.time() - t0) * 1000)
        s.close()
        if resp:
            print(f"  Réponse ({len(resp)} bytes, {elapsed}ms):")
            print(f"  {resp[:200].decode('ascii', errors='replace')}")
            return True
        else:
            print(f"  Pas de réponse ({elapsed}ms)")
            return False
    except Exception as e:
        print(f"  HTTP échec: {e}")
        return False


def try_raw(host, port):
    print(f"\n[Raw TCP — envoi 0x00 x16]")
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.settimeout(4)
        s.connect((host, port))
        t0 = time.time()
        s.sendall(b"\x00" * 16)
        resp = tcp_read(s, 64, timeout=2)
        elapsed = int((time.time() - t0) * 1000)
        s.close()
        if resp:
            print(f"  Réponse à null bytes ({elapsed}ms): {resp.hex()}")
        else:
            print(f"  Pas de réponse ({elapsed}ms)")
        return bool(resp)
    except Exception as e:
        print(f"  Échec: {e}")
        return False


def run(host, user, password, port=8800):
    print(f"\n=== Probe port {port} — {host} ===")

    # Check port open
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.settimeout(2)
        s.connect((host, port))
        s.close()
        print(f"Port {port}: OUVERT")
    except Exception:
        print(f"Port {port}: FERMÉ ou filtré")
        return

    try_dvrip(host, port, user, password)
    try_http(host, port)
    try_http(host, port, "/index.html")
    try_raw(host, port)

    print("\n=== Probe complete ===")


if __name__ == "__main__":
    if len(sys.argv) < 4:
        print("Usage: python probe_8800.py <IP> <user> <password> [port]")
        sys.exit(1)
    port = int(sys.argv[4]) if len(sys.argv) > 4 else 8800
    run(sys.argv[1], sys.argv[2], sys.argv[3], port)
