"""Transcripts, scrubbing and the folder writer shared by every protocol of the capture tool."""

import json
import re
import socket
import struct
from dataclasses import dataclass, field
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
FIXTURES_ROOT = REPO_ROOT / "src" / "vyzio" / "Vyzio.Tests" / "Contracts" / "Fixtures"
NEUTRAL_VALUES = json.loads((FIXTURES_ROOT / "neutral-values.json").read_text(encoding="utf-8"))

# Well-known defaults are not secrets, and replacing them everywhere would rewrite unrelated text.
DEFAULT_USERNAMES = {"", "admin", "root", "user", "guest"}

PRIVATE_IP = re.compile(
    r"(?<![\d.])(?:10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}"
    r"|192\.168\.\d{1,3}\.\d{1,3}|169\.254\.\d{1,3}\.\d{1,3})(?![\d])"
)
MAC = re.compile(r"(?<![0-9A-Fa-f:-])[0-9A-Fa-f]{2}([:-])(?:[0-9A-Fa-f]{2}\1){4}[0-9A-Fa-f]{2}(?![0-9A-Fa-f:-])")
UUID = re.compile(r"[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}")


@dataclass(frozen=True)
class Account:
    username: str
    password: str


FIXTURE_ACCOUNT = Account(NEUTRAL_VALUES["account"]["username"], NEUTRAL_VALUES["account"]["password"])


@dataclass
class Transcript:
    protocol: str
    scenario: str
    transport: str
    description: str
    writes: bool = False
    messages: list = field(default_factory=list)

    def add(self, **message):
        self.messages.append(message)

    def to_json(self):
        return {
            "protocol": self.protocol,
            "scenario": self.scenario,
            "description": self.description,
            "transport": self.transport,
            "writes": self.writes,
            "messages": self.messages,
        }


def recv_exact(sock, count):
    """Reads count bytes; returns what arrived before the peer closed."""
    data = b""
    while len(data) < count:
        chunk = sock.recv(count - len(data))
        if not chunk:
            break
        data += chunk
    return data


def record_failure(transcript, error):
    """A silent or closed peer is part of the exchange: replays reproduce it."""
    if isinstance(error, socket.timeout):
        transcript.add(direction="received", event="silence")
    elif isinstance(error, (ConnectionResetError, ConnectionAbortedError, BrokenPipeError)):
        transcript.add(direction="received", event="closed", error=type(error).__name__)
    else:
        transcript.add(direction="received", event="unreachable", error=type(error).__name__)


class Scrubber:
    """Replaces every identifying value with a stable neutral one (neutral-values.json)."""

    def __init__(self, real_host, real_account):
        self.real_account = real_account
        self.ip_map = {real_host: NEUTRAL_VALUES["cameraHost"]}
        self.mac_map = {}
        self.uuid_map = {}
        self.literals = {}
        self.binary = {}
        self.dvrip_sessions = {}

    # --- learning, before any replacement ---

    def learn_text(self, text):
        for match in MAC.finditer(text):
            self.learn_mac(match.group(0))
        for match in UUID.finditer(text):
            self._uuid(match.group(0))
        for match in PRIVATE_IP.finditer(text):
            self._ip(match.group(0))

    def learn_mac(self, mac):
        bare = re.sub(r"[:-]", "", mac).lower()
        if bare not in self.mac_map:
            neutral_prefix = NEUTRAL_VALUES["macPrefix"].replace(":", "").lower()
            self.mac_map[bare] = f"{neutral_prefix}{len(self.mac_map) + 1:02x}"

    def learn_serial(self, serial):
        serial = serial.strip()
        # A short value ("1.0") is a version, not an identifier: replacing it would rewrite unrelated text.
        if len(serial) < 6 or serial in self.literals:
            return
        self.literals[serial] = self._neutral_serial(serial)

    def learn_device_id(self, device_id):
        neutral = NEUTRAL_VALUES["v380DeviceId"]
        self.literals[str(device_id)] = str(neutral)
        self.binary[struct.pack("<I", device_id)] = struct.pack("<I", neutral)
        self.binary[struct.pack(">I", device_id)] = struct.pack(">I", neutral)

    def learn_v380_ticket(self, ticket):
        self.binary[struct.pack("<I", ticket)] = struct.pack("<I", NEUTRAL_VALUES["v380Ticket"])

    def learn_dvrip_session(self, session_hex):
        neutral = NEUTRAL_VALUES["dvripSessionId"]
        self.dvrip_sessions[int(session_hex, 16)] = int(neutral, 16)
        self.literals[session_hex] = neutral

    def _neutral_serial(self, serial):
        # A hex serial keeps its shape: the V380 device id is read from its bytes 2..5 (V380DeviceIdBootstrap).
        if re.fullmatch(r"[0-9A-Fa-f]{12,}", serial) and len(serial) % 2 == 0:
            head = "0000" + f"{NEUTRAL_VALUES['v380DeviceId']:08x}"
            neutral = (head + "0" * len(serial))[: len(serial)]
            return neutral.upper() if serial.isupper() else neutral
        return NEUTRAL_VALUES["serial"]

    def _ip(self, ip):
        if ip not in self.ip_map:
            self.ip_map[ip] = f"{NEUTRAL_VALUES['otherHostPrefix']}{100 + len(self.ip_map)}"
        return self.ip_map[ip]

    def _uuid(self, value):
        key = value.lower()
        if key not in self.uuid_map:
            self.uuid_map[key] = f"{NEUTRAL_VALUES['uuidPrefix']}{len(self.uuid_map) + 1:012d}"
        return self.uuid_map[key]

    def _mac(self, match):
        mac = match.group(0)
        self.learn_mac(mac)
        neutral = self.mac_map[re.sub(r"[:-]", "", mac).lower()]
        separator = match.group(1)
        pairs = [neutral[i : i + 2] for i in range(0, 12, 2)]
        text = separator.join(pairs)
        return text.upper() if mac.isupper() else text

    # --- replacement ---

    def _text_pairs(self):
        pairs = dict(self.literals)
        for bare, neutral in self.mac_map.items():
            pairs[bare] = neutral
            pairs[bare.upper()] = neutral.upper()
        for real, neutral in self.ip_map.items():
            pairs[real] = neutral
        password = self.real_account.password
        if password:
            pairs[password] = FIXTURE_ACCOUNT.password
        return sorted(pairs.items(), key=lambda pair: -len(pair[0]))

    def text(self, text, usernames=True):
        text = UUID.sub(lambda match: self._uuid(match.group(0)), text)
        text = MAC.sub(self._mac, text)
        for real, neutral in self._text_pairs():
            text = text.replace(real, neutral)
        text = PRIVATE_IP.sub(lambda match: self._ip(match.group(0)), text)
        # A sent message already carries the fixture account; its other names are Vyzio's own constants.
        return self._username(text) if usernames else text

    def _username(self, text):
        username = re.escape(self.real_account.username)
        if not username:
            return text
        neutral = FIXTURE_ACCOUNT.username
        context = rf"((?:user|username|UserName|User|name)\s*[=:]\s*\"?){username}(?=[&_;\"'\s<,}}]|$)"
        text = re.sub(context, lambda match: match.group(1) + neutral, text)
        text = re.sub(rf"(\"(?:UserName|Username|username|user)\"\s*:\s*\"){username}(?=\")",
                      lambda match: match.group(1) + neutral, text)
        text = re.sub(rf"(<(?:\w+:)?Username>){username}(</)", lambda match: match.group(1) + neutral + match.group(2), text)
        if self.real_account.username not in DEFAULT_USERNAMES:
            text = re.sub(rf"(?<![\w-]){username}(?![\w-])", neutral, text)
        return text

    def bytes(self, data):
        for real, neutral in self.binary.items():
            data = data.replace(real, neutral)
        for real, neutral in self._text_pairs() + self._username_pairs():
            real_bytes, neutral_bytes = real.encode(), neutral.encode()
            if len(real_bytes) < 4:
                continue
            # Fixed-size frames keep their length: the neutral value is NUL-padded or cut.
            data = data.replace(real_bytes, neutral_bytes.ljust(len(real_bytes), b"\0")[: len(real_bytes)])
        for real, neutral in self.ip_map.items():
            data = data.replace(socket.inet_aton(real), socket.inet_aton(neutral))
        return data

    def _username_pairs(self):
        username = self.real_account.username
        return [] if username in DEFAULT_USERNAMES else [(username, FIXTURE_ACCOUNT.username)]

    def dvrip_frame(self, header_hex, body_text, usernames):
        """Scrubs the JSON, then rewrites the header's session and length to match it."""
        body = self.text(body_text, usernames).encode("utf-8")
        header = bytearray(bytes.fromhex(header_hex))
        session = struct.unpack_from("<I", header, 4)[0]
        struct.pack_into("<I", header, 4, self.dvrip_sessions.get(session, session))
        struct.pack_into("<I", header, 16, len(body))
        return header.hex(), body.decode("utf-8")


def scrub_transcript(scrubber, transcript):
    for message in transcript.messages:
        received = message["direction"] in ("received", "response")
        if "header" in message and "body" in message:
            message["header"], message["body"] = scrubber.dvrip_frame(message["header"], message["body"], received)
            continue
        for key in ("body", "text", "path"):
            if isinstance(message.get(key), str):
                message[key] = scrubber.text(message[key], received)
        if "hex" in message:
            message["hex"] = scrubber.bytes(bytes.fromhex(message["hex"])).hex()
        if "headers" in message:
            message["headers"] = [[name, scrubber.text(value)] for name, value in message["headers"]]


def learn_from_transcript(scrubber, transcript):
    for message in transcript.messages:
        for key in ("body", "text", "path"):
            if isinstance(message.get(key), str):
                scrubber.learn_text(message[key])
        for _, value in message.get("headers", []):
            scrubber.learn_text(value)
        if "hex" in message:
            scrubber.learn_text(bytes.fromhex(message["hex"]).decode("latin-1"))


def slug(value):
    return re.sub(r"-{2,}", "-", re.sub(r"[^a-z0-9.]+", "-", value.lower())).strip("-.")


def write_folder(protocol, model, firmware, transcripts, manifest_base):
    folder = FIXTURES_ROOT / protocol / f"{slug(model)}-{slug(firmware)}"
    folder.mkdir(parents=True, exist_ok=True)
    for stale in folder.glob("*.json"):
        stale.unlink()
    for transcript in transcripts:
        (folder / f"{transcript.scenario}.json").write_text(
            json.dumps(transcript.to_json(), indent=2, ensure_ascii=False) + "\n", encoding="utf-8", newline="\n")
    manifest = dict(manifest_base)
    manifest.update({
        "protocol": protocol,
        "model": model,
        "firmware": firmware,
        "scenarios": [
            {"file": f"{t.scenario}.json", "description": t.description, "writes": t.writes} for t in transcripts
        ],
    })
    (folder / "manifest.json").write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8", newline="\n")
    return folder
