"""DVRIP (Xiongmai "Sofia") scenarios, framed the way DvripClient frames them."""

import hashlib
import json
import socket
import struct

from recording import FIXTURE_ACCOUNT, NEUTRAL_VALUES, Account, recv_exact, record_failure

PORT = 34567
LOGIN, SYSTEM_INFO, CONFIG_GET, PTZ = 1000, 1020, 1042, 1400
PRESET_LIST = "Uart.PTZPreset.[0]"
FIRST_SPARE_SLOT, LAST_SLOT = 5, 255
# The credential-free discovery probe of AssistedCameraDiscoveryProbePipeline, sent as it is.
DISCOVERY_PROBE = '{"EncryptType":"MD5","LoginType":"DVRIP","PassWord":"tlJwpbo6","UserName":"admin"}'


def sofia_hash(password):
    md5 = hashlib.md5(password.encode("utf-8")).digest()
    out = ""
    for i in range(0, 16, 2):
        value = (md5[i] + md5[i + 1]) % 62
        out += chr(48 + value) if value < 10 else chr(55 + value) if value < 36 else chr(61 + value)
    return out


def compact(payload):
    return json.dumps(payload, separators=(",", ":"))


def login_payload(account):
    return compact({"LoginType": "DVRIP-Web", "UserName": account.username,
                    "PassWord": sofia_hash(account.password), "EncryptType": "MD5"})


def frame(cmd, body, sequence, session, version=0, terminate=True):
    data = (body + "\n\0").encode("utf-8") if terminate else body.encode("utf-8")
    header = bytearray(20)
    header[0], header[1] = 0xFF, version
    struct.pack_into("<IIxxHI", header, 4, session, sequence, cmd, len(data))
    return bytes(header), data


class DvripConnection:
    def __init__(self, host, timeout, transcript):
        self.transcript = transcript
        self.sock = socket.create_connection((host, PORT), timeout=timeout)
        self.sock.settimeout(timeout)

    def exchange(self, sent, recorded=None):
        """Sends one frame, records it (or its fixture-account twin), and records the answer."""
        header, body = recorded or sent
        self.transcript.add(direction="sent", header=header.hex(), body=body.decode("utf-8"))
        self.sock.sendall(sent[0] + sent[1])
        try:
            answer_header = recv_exact(self.sock, 20)
            if len(answer_header) < 20:
                self.transcript.add(direction="received", event="closed")
                return None
            length = struct.unpack_from("<I", answer_header, 16)[0]
            answer = recv_exact(self.sock, length)
            self.transcript.add(direction="received", header=answer_header.hex(), body=answer.decode("utf-8", errors="replace"))
            return json.loads(answer.rstrip(b"\0\n").decode("utf-8", errors="replace"))
        except (OSError, ValueError) as error:
            if isinstance(error, OSError):
                record_failure(self.transcript, error)
            return None

    def close(self):
        self.sock.close()


def open_session(context, transcript, account=None):
    """Logs in on a new connection; returns it with its session id, or None after recording why."""
    account = account or context.account
    refused = account.password != context.account.password
    recorded_account = Account(FIXTURE_ACCOUNT.username, account.password) if refused else FIXTURE_ACCOUNT
    try:
        connection = DvripConnection(context.host, context.timeout, transcript)
    except OSError as error:
        record_failure(transcript, error)
        return None, None
    answer = connection.exchange(frame(LOGIN, login_payload(account), 0, 0),
                                 frame(LOGIN, login_payload(recorded_account), 0, 0))
    session = answer.get("SessionID") if isinstance(answer, dict) and answer.get("Ret") == 100 else None
    if session:
        context.dvrip_sessions.append(session)
    return connection, session


class Commands:
    """Session commands, numbered from 2 as DvripSession numbers them."""

    def __init__(self, connection, session):
        self.connection, self.session, self.sequence = connection, session, 2

    def send(self, cmd, payload):
        sent = frame(cmd, compact(payload), self.sequence, int(self.session, 16))
        self.sequence += 1
        return self.connection.exchange(sent)


def run(context):
    t = context.transcript("dvrip", "discovery-banner", "The credential-free discovery probe and the first answer bytes.")
    try:
        connection = DvripConnection(context.host, context.timeout, t)
        connection.exchange(frame(LOGIN, DISCOVERY_PROBE, 0, 0, version=1, terminate=False))
        connection.close()
    except OSError as error:
        record_failure(t, error)
        context.fail("dvrip", "port closed")
        return

    t = context.transcript("dvrip", "login", "The login with the account: Ret 100 and a session id.")
    connection, session = open_session(context, t)
    if connection:
        connection.close()
    if not session:
        context.fail("dvrip", "login refused or silent")
        return

    t = context.transcript("dvrip", "login-refused", "The login with a wrong password.")
    connection, _ = open_session(context, t, Account(context.account.username, NEUTRAL_VALUES["refusedPassword"]))
    if connection:
        connection.close()

    t = context.transcript("dvrip", "system-info", "SystemInfo: hardware, firmware and serial.")
    connection, session = open_session(context, t)
    if session:
        answer = Commands(connection, session).send(SYSTEM_INFO, {"Name": "SystemInfo", "SessionID": session})
        info = (answer or {}).get("SystemInfo") or {}
        if info.get("SerialNo"):
            context.serials.append(info["SerialNo"])
    if connection:
        connection.close()

    t = context.transcript("dvrip", "ptz-preset-list", f"{PRESET_LIST}: the presets the camera keeps.")
    connection, session = open_session(context, t)
    stored = None
    if session:
        stored = preset_ids(Commands(connection, session).send(CONFIG_GET, {"Name": PRESET_LIST, "SessionID": session}))
    if connection:
        connection.close()

    if context.allow_writes and stored is not None:
        store_and_clear_preset(context, stored)


def preset_ids(answer):
    if not isinstance(answer, dict) or answer.get("Ret") != 100 or PRESET_LIST not in answer:
        return None
    return {preset["Id"] for preset in (answer[PRESET_LIST] or [])}


def ptz_payload(session, command, preset):
    return {"Name": "OPPTZControl", "SessionID": session, "OPPTZControl": {"Command": command, "Parameter": {
        "AUX": {"Number": 0, "Status": "On"}, "Channel": 0, "MenuOpts": "Enter", "Pattern": "Start",
        "Preset": preset, "Step": 0, "Tour": 0}}}


def store_and_clear_preset(context, stored):
    """The native preset proof of DvripPtzProvider: store on a spare slot, list, clear, list. The head does not move."""
    slot = next((s for s in range(LAST_SLOT, FIRST_SPARE_SLOT - 1, -1) if s not in stored), 0)
    if not slot:
        context.note("dvrip: no spare preset slot, write skipped")
        return
    t = context.transcript("dvrip", "ptz-preset-store-and-clear",
                           "A preset stored on a spare slot, listed, cleared, listed again: the native preset proof.")
    t.writes = True
    connection, session = open_session(context, t)
    if not session:
        return
    commands = Commands(connection, session)
    commands.send(PTZ, ptz_payload(session, "SetPreset", slot))
    commands.send(CONFIG_GET, {"Name": PRESET_LIST, "SessionID": session})
    commands.send(PTZ, ptz_payload(session, "ClearPreset", slot))
    after = preset_ids(commands.send(CONFIG_GET, {"Name": PRESET_LIST, "SessionID": session}))
    connection.close()
    context.note("dvrip preset stored and cleared" if after is not None and slot not in after
                 else "dvrip preset may still be stored: check the camera")
    context.moves.append("DVRIP SetPreset + ClearPreset on a spare slot (no head move)")
