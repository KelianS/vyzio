"""V380 port-8800 scenarios, framed the way V380Client frames them. No stream is opened: frames would be footage."""

import secrets
import socket
import struct

from Crypto.Cipher import AES

from recording import FIXTURE_ACCOUNT, NEUTRAL_VALUES, Account, recv_exact, record_failure

PORT = 8800
DISCOVERY_PORT = 10008
STATIC_KEY = b"macrovideo+*#!^@"
CHARSET = b"abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+-="


def encrypted_password(password, random_key):
    padded = password.encode("utf-8")[:16].ljust(16, b"\0")
    first = AES.new(STATIC_KEY, AES.MODE_ECB).encrypt(padded)
    return random_key + AES.new(random_key, AES.MODE_ECB).encrypt(first)


def auth_packet(account, device_id, random_key):
    packet = bytearray(256)
    struct.pack_into("<iI", packet, 0, 1167, 1022)
    packet[8] = 2
    struct.pack_into("<II", packet, 9, 1, device_id)
    username = account.username.encode("utf-8")[:32]
    packet[49:49 + len(username)] = username
    packet[81:113] = encrypted_password(account.password, random_key)
    return bytes(packet)


def exchange(context, transcript, sent, recorded):
    transcript.add(direction="sent", hex=recorded.hex())
    try:
        with socket.create_connection((context.host, PORT), timeout=context.timeout) as sock:
            sock.settimeout(context.timeout)
            sock.sendall(sent)
            answer = recv_exact(sock, 256)
    except OSError as error:
        record_failure(transcript, error)
        return None
    transcript.add(direction="received", hex=answer.hex())
    if len(answer) < 256:
        transcript.add(direction="received", event="closed")
    return answer


def discover_device_id(context, transcript):
    probe = b"NVDEVSEARCH^100"
    transcript.add(direction="sent", text=probe.decode())
    with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as udp:
        udp.settimeout(1.5)
        udp.sendto(probe, (context.host, DISCOVERY_PORT))
        try:
            data, _ = udp.recvfrom(4096)
        except OSError as error:
            record_failure(transcript, error)
            return None
    text = data.decode("latin-1")
    transcript.add(direction="received", text=text)
    fields = text.split("^")
    return int(fields[12]) if len(fields) > 12 and fields[12].isdigit() else None


def device_id_of_serial(serials):
    """Bytes 2..5 of a hex ONVIF serial, big-endian, as V380DeviceIdBootstrap reads them."""
    for serial in serials:
        try:
            raw = bytes.fromhex(serial.strip())
        except ValueError:
            continue
        if len(raw) >= 6 and struct.unpack(">I", raw[2:6])[0]:
            return struct.unpack(">I", raw[2:6])[0]
    return None


def run(context):
    t = context.transcript("v380", "discovery-nvdevsearch", "UDP NVDEVSEARCH: the answer carries the device number in field 12.")
    device_id = discover_device_id(context, t)
    if device_id is None:
        # Silence here may be the capturing host's firewall, not the camera: not worth a fixture.
        context.transcripts.remove(t)
        context.note("v380: no UDP discovery answer, device number taken elsewhere")
    device_id = device_id or context.v380_device_id or device_id_of_serial(context.serials)
    if device_id:
        context.v380_device_ids.append(device_id)

    t = context.transcript("v380", "discovery-fingerprint", "The credential-free auth frame of discovery, device number 0.")
    probe = struct.pack("<i", 1167) + bytes(252)
    if exchange(context, t, probe, probe) is None:
        context.fail("v380", "port 8800 silent")
        return

    if not device_id:
        context.fail("v380", "device number unknown: set VYZIO_CAPTURE_V380_DEVICE_ID")
        return

    for scenario, password, description in (
        ("auth", context.account.password, "The auth frame (cmd 1167) with the account: a non-zero ticket at offset 13."),
        ("auth-refused", NEUTRAL_VALUES["refusedPassword"], "The auth frame with a wrong password: ticket 0."),
    ):
        t = context.transcript("v380", scenario, description)
        key = bytes(secrets.choice(CHARSET) for _ in range(16))
        sent = auth_packet(Account(context.account.username, password), device_id, key)
        recorded_password = FIXTURE_ACCOUNT.password if password == context.account.password else password
        recorded = auth_packet(Account(FIXTURE_ACCOUNT.username, recorded_password), device_id, key)
        answer = exchange(context, t, sent, recorded)
        if answer and len(answer) >= 17:
            ticket = struct.unpack_from("<I", answer, 13)[0]
            if ticket:
                context.v380_tickets.append(ticket)
