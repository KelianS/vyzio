"""
V380 Pro — Port 8800 : validation PTZ propriétaire.

Conclusions des tests précédents :
  - Le stream loop (lecture 12-byte headers + payload) est obligatoire pour que
    la caméra accepte les commandes PTZ.
  - La caméra CONTINUE de bouger après l'arrêt des paquets PTZ direction.
  - Un paquet STOP arrête le mouvement.
  - 0xea @ byte[8] = PAN DROITE (coords écran)
  - 0xe9 @ byte[8] = PAN GAUCHE (coords écran)
  - Tilt haut/bas et nombre minimal de paquets : à confirmer.

Usage :
    python probe_v380_ptz_8800.py
"""

import socket
import struct
import time
import string
import random
from Crypto.Cipher import AES

HOST = '192.168.1.135'
PORT = 8800
USER = 'admin'
PASS = 'Password1'
DEVICE_ID = 26970853
STATIC_KEY = b'macrovideo+*#!^@'
CHARSET = (string.ascii_letters + string.digits + '!@#$%^&*()_+-=').encode()

# ── PTZ 16-byte packets ───────────────────────────────────────────────────────
# Opcode 0xAA. bytes[8-9]=pan LE, bytes[10-11]=tilt LE (1000=neutral).
# Pan  : 0xe8=neutral | 0xea=droite(écran) | 0xe9=gauche(écran)
# Tilt : 0xe8=neutral | 0xeb=haut           | 0xec=bas
PTZ = {
    'stop':       bytes([0xaa,0x00,0x00,0x00, 0xe8,0x03,0xe8,0x03, 0xe8,0x03,0xe8,0x03, 0x00,0x00,0x01,0x00]),
    'right':      bytes([0xaa,0x00,0x00,0x00, 0xe8,0x03,0xe8,0x03, 0xea,0x03,0xe8,0x03, 0x00,0x00,0x01,0x00]),
    'left':       bytes([0xaa,0x00,0x00,0x00, 0xe8,0x03,0xe8,0x03, 0xe9,0x03,0xe8,0x03, 0x00,0x00,0x01,0x00]),
    'up':         bytes([0xaa,0x00,0x00,0x00, 0xe8,0x03,0xe8,0x03, 0xe8,0x03,0xeb,0x03, 0x00,0x00,0x01,0x00]),
    'down':       bytes([0xaa,0x00,0x00,0x00, 0xe8,0x03,0xe8,0x03, 0xe8,0x03,0xec,0x03, 0x00,0x00,0x01,0x00]),
    'up_right':   bytes([0xaa,0x00,0x00,0x00, 0xe8,0x03,0xe8,0x03, 0xea,0x03,0xeb,0x03, 0x00,0x00,0x01,0x00]),
    'up_left':    bytes([0xaa,0x00,0x00,0x00, 0xe8,0x03,0xe8,0x03, 0xe9,0x03,0xeb,0x03, 0x00,0x00,0x01,0x00]),
    'down_right': bytes([0xaa,0x00,0x00,0x00, 0xe8,0x03,0xe8,0x03, 0xea,0x03,0xec,0x03, 0x00,0x00,0x01,0x00]),
    'down_left':  bytes([0xaa,0x00,0x00,0x00, 0xe8,0x03,0xe8,0x03, 0xe9,0x03,0xec,0x03, 0x00,0x00,0x01,0x00]),
}


# ── Helpers ───────────────────────────────────────────────────────────────────

def generate_password(password):
    random_key = bytes(random.choice(CHARSET) for _ in range(16))
    padded = password.encode().ljust(16, b'\x00')[:16]
    c1 = AES.new(STATIC_KEY, AES.MODE_ECB); enc1 = c1.encrypt(padded)
    c2 = AES.new(random_key, AES.MODE_ECB); enc2 = c2.encrypt(enc1)
    return random_key + enc2


def recv_fixed(sock, n, timeout=5.0):
    sock.settimeout(timeout)
    data = b''
    while len(data) < n:
        c = sock.recv(n - len(data))
        if not c:
            raise ConnectionError('V380: connexion fermée')
        data += c
    return data


def connect_stream():
    """Auth + stream login + stream start. Retourne le socket stream."""
    pw = generate_password(PASS)
    buf = bytearray(256)
    struct.pack_into('<i', buf, 0, 1167); struct.pack_into('<I', buf, 4, 1022)
    buf[8] = 2; struct.pack_into('<I', buf, 9, 1); struct.pack_into('<I', buf, 13, DEVICE_ID)
    buf[49:49+len(USER)] = USER.encode(); buf[81:81+len(pw)] = pw
    s = socket.socket(); s.connect((HOST, PORT)); s.sendall(bytes(buf))
    resp = recv_fixed(s, 256); s.close()
    ticket = struct.unpack_from('<I', resp, 13)[0]

    buf2 = bytearray(256)
    struct.pack_into('<i', buf2, 0, 301); struct.pack_into('<I', buf2, 4, DEVICE_ID)
    struct.pack_into('<H', buf2, 12, 20); struct.pack_into('<I', buf2, 14, ticket)
    struct.pack_into('<I', buf2, 22, 4097); struct.pack_into('<I', buf2, 26, 1)
    sock = socket.socket(); sock.settimeout(10.0); sock.connect((HOST, PORT))
    sock.setsockopt(socket.IPPROTO_TCP, socket.TCP_NODELAY, 1); sock.sendall(bytes(buf2))
    r2 = recv_fixed(sock, 32)
    v21 = struct.unpack_from('<I', r2, 4)[0]
    buf3 = bytearray(256); struct.pack_into('<i', buf3, 0, 303); struct.pack_into('<I', buf3, 4, v21)
    sock.sendall(bytes(buf3))
    return sock


def read_frame(sock):
    """Lit un sub-frame (12-byte header + payload). Retourne True si c'est un frame vidéo."""
    hdr = recv_fixed(sock, 12)
    if hdr[0] == 0x7f:
        length = struct.unpack_from('<H', hdr, 7)[0]
        if length > 0:
            recv_fixed(sock, length)
        return True
    elif hdr[0] == 0x6f:
        time.sleep(0.02)
    return False


def drain_frames(sock, seconds):
    """Lit le flux pendant N secondes sans envoyer de PTZ."""
    t_end = time.time() + seconds
    while time.time() < t_end:
        read_frame(sock)


def send_after_n_frames(sock, direction, n_frames=1):
    """
    Lit n_frames sub-frames puis envoie 1 paquet PTZ.
    Hypothèse : la caméra continue de bouger après ce 1 paquet.
    """
    sent = 0
    while sent < n_frames:
        if read_frame(sock):
            sent += 1
    sock.sendall(PTZ[direction])
    print(f'  >> PTZ "{direction}" envoye (apres {n_frames} frames lus)')


# ── Tests ─────────────────────────────────────────────────────────────────────

def test_min_packets(direction, n_packets, move_wait_s=2.0):
    """
    Envoie exactement n_packets paquets PTZ, attend move_wait_s sans envoyer,
    puis envoie 1 STOP. Vérifie le nombre minimal de paquets pour déclencher le mouvement.
    """
    print(f'\n[TEST] {n_packets} paquet(s) "{direction}", attente {move_wait_s}s autonome, puis STOP')
    sock = connect_stream()

    for _ in range(n_packets):
        send_after_n_frames(sock, direction, n_frames=1)

    print(f'  Attente {move_wait_s}s (caméra devrait bouger seule)...')
    drain_frames(sock, move_wait_s)

    print('  Envoi STOP...')
    send_after_n_frames(sock, 'stop', n_frames=1)
    time.sleep(0.3)
    sock.close()


def test_directions(wait_s=1.5):
    """Teste toutes les directions de base : droite, gauche, haut, bas."""
    directions = ['right', 'left', 'up', 'down']
    for d in directions:
        print(f'\n[TEST DIR] {d} — {wait_s}s puis STOP')
        sock = connect_stream()
        send_after_n_frames(sock, d, n_frames=1)
        print(f'  Mouvement "{d}" en cours ({wait_s}s)...')
        drain_frames(sock, wait_s)
        send_after_n_frames(sock, 'stop', n_frames=1)
        sock.close()
        time.sleep(0.5)


def test_step_duration():
    """
    Mesure la durée d'un step : envoie 1 paquet direction, puis RIEN pendant 3s
    (pas même un STOP), et ferme la connexion. L'utilisateur chronomètre le mouvement.
    """
    print('\n[TEST STEP DURATION] 1 paquet "right", puis silence 3s, puis fermeture')
    print('  -> Regarde et chronomètre combien de temps la caméra bouge.')
    sock = connect_stream()
    # Lit quelques frames pour stabiliser le stream, puis envoie 1 paquet
    send_after_n_frames(sock, 'right', n_frames=5)
    print('  Paquet envoyé. Chronomètre maintenant...')
    drain_frames(sock, 3.0)
    sock.close()
    print('  (connexion fermée)')


def test_frequency(gap_ms_list, direction='right', move_s=1.5):
    """
    Teste différents intervalles entre paquets pour trouver la fréquence minimale
    qui donne un mouvement continu. On envoie des paquets à intervalle fixe de gap_ms ms.
    """
    for gap_ms in gap_ms_list:
        print(f'\n[TEST FREQ] gap={gap_ms}ms entre paquets, dur={move_s}s')
        sock = connect_stream()
        t_end = time.time() + move_s
        n_sent = 0
        last_sent = 0.0

        while time.time() < t_end:
            if read_frame(sock):
                now = time.time()
                if now - last_sent >= gap_ms / 1000.0:
                    sock.sendall(PTZ[direction])
                    n_sent += 1
                    last_sent = now

        sock.sendall(PTZ['stop'])
        drain_frames(sock, 0.3)
        sock.close()
        print(f'  {n_sent} paquets envoyés sur {move_s}s (1 paquet toutes les {gap_ms}ms)')
        print(f'  -> Mouvement continu ou saccadé ?')
        time.sleep(1.0)


if __name__ == '__main__':
    # Étape 1 : mesure durée d'un seul step (sans stop)
    test_step_duration()
    input('\n  Appuie sur Entrée quand tu as noté la durée du step...\n')

    # Étape 2 : trouve la fréquence minimale pour mouvement continu
    # On part de 500ms (très lent) → 200ms → 100ms → 50ms
    test_frequency([500, 200, 100, 50])

    print('\nDone.')

