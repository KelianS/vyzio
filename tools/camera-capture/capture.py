"""Records protocol exchanges with one camera as scrubbed contract fixtures. Procedure: README.md."""

import argparse
import datetime
import os
import re
import subprocess
import sys

import dvrip
import onvif
import rtsp
import v380
from recording import MAC, REPO_ROOT, Account, Scrubber, Transcript, learn_from_transcript, scrub_transcript, write_folder

PROTOCOLS = {"onvif": onvif.run, "dvrip": dvrip.run, "v380": v380.run, "rtsp": rtsp.run}
# ONVIF runs first whatever is asked: it names the firmware and gives RTSP its stream address.
ORDER = ["onvif", "dvrip", "v380", "rtsp"]
VARIABLES = ("VYZIO_CAPTURE_HOST", "VYZIO_CAPTURE_USERNAME", "VYZIO_CAPTURE_PASSWORD", "VYZIO_CAPTURE_V380_DEVICE_ID")


class Context:
    def __init__(self, host, account, args):
        self.host, self.account = host, account
        self.timeout = args.timeout
        self.allow_writes = args.allow_writes
        self.onvif_port = args.onvif_port
        self.firmware = args.firmware
        self.v380_device_id = None
        self.transcripts = []
        self.serials, self.dvrip_sessions, self.v380_device_ids, self.v380_tickets = [], [], [], []
        self.stream_uri = None
        self.failures, self.notes, self.moves = [], [], []

    def transcript(self, protocol, scenario, description):
        transcript = Transcript(protocol, scenario, "udp" if scenario == "discovery-nvdevsearch" else
                                "http" if protocol == "onvif" else "tcp", description)
        self.transcripts.append(transcript)
        print(f"  {protocol}/{scenario}")
        return transcript

    def fail(self, protocol, reason):
        self.failures.append(f"{protocol}: {reason}")
        print(f"  ! {protocol}: {reason}")

    def note(self, text):
        self.notes.append(text)
        print(f"  - {text}")


def read_settings(env_file):
    """Environment variables first, then KEY=VALUE lines of the env file; never printed."""
    settings = {name: os.environ.get(name) for name in VARIABLES}
    if env_file:
        with open(env_file, encoding="utf-8") as handle:
            for line in handle:
                key, sep, value = line.strip().partition("=")
                if sep and key in VARIABLES and not settings.get(key):
                    settings[key] = value.strip()
    missing = [name for name in VARIABLES[:3] if not settings.get(name)]
    if missing:
        sys.exit(f"missing settings: {', '.join(missing)}")
    return settings


def camera_mac(host):
    """The camera's MAC from the ARP cache, so the scrubber replaces it wherever it shows up."""
    try:
        table = subprocess.run(["arp", "-a"], capture_output=True, text=True, check=False).stdout
    except OSError:
        return None
    for line in table.splitlines():
        fields = line.split()
        # Windows lists "ip mac type", Linux "? (ip) at mac ...", an unresolved entry "<incomplete>".
        found = (fields[1] if len(fields) >= 2 and fields[0] == host
                 else fields[3] if len(fields) >= 4 and fields[1] == f"({host})" and fields[2] == "at" else None)
        if found and MAC.fullmatch(found):
            return found
    return None


def commit():
    result = subprocess.run(["git", "-C", str(REPO_ROOT), "rev-parse", "HEAD"], capture_output=True, text=True, check=False)
    return result.stdout.strip() or "unknown"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--model", required=True, help="model slug, as in docs/hardware (tapo-c200, icsee, v380-pro)")
    parser.add_argument("--protocols", default="onvif,rtsp", help="comma-separated: onvif, dvrip, v380, rtsp")
    parser.add_argument("--env-file", help="KEY=VALUE file outside the repository holding the VYZIO_CAPTURE_* settings")
    parser.add_argument("--allow-writes", action="store_true", help="also run the preset scenarios that store then remove a preset")
    parser.add_argument("--onvif-port", type=int, help="skip the ONVIF port sweep")
    parser.add_argument("--firmware", help="firmware name when ONVIF does not give one")
    parser.add_argument("--timeout", type=float, default=10.0, help="seconds to wait for an answer (a V380 takes seconds)")
    args = parser.parse_args()

    settings = read_settings(args.env_file)
    host = settings["VYZIO_CAPTURE_HOST"]
    account = Account(settings["VYZIO_CAPTURE_USERNAME"], settings["VYZIO_CAPTURE_PASSWORD"])
    asked = [name.strip() for name in args.protocols.split(",") if name.strip()]
    unknown = [name for name in asked if name not in PROTOCOLS]
    if unknown:
        sys.exit(f"unknown protocols: {', '.join(unknown)}")

    context = Context(host, account, args)
    if settings.get("VYZIO_CAPTURE_V380_DEVICE_ID"):
        context.v380_device_id = int(settings["VYZIO_CAPTURE_V380_DEVICE_ID"])
    print(f"capturing {args.model}")
    for protocol in ORDER:
        if protocol in asked or protocol == "onvif":
            PROTOCOLS[protocol](context)

    if not context.firmware:
        sys.exit("firmware unknown: pass --firmware")

    scrubber = Scrubber(host, account)
    mac = camera_mac(host)
    if mac:
        scrubber.learn_mac(mac)
    else:
        context.note("camera MAC not in the ARP cache: check the fixtures for it by hand")
    for serial in context.serials:
        scrubber.learn_serial(serial)
    for session in context.dvrip_sessions:
        scrubber.learn_dvrip_session(session)
    for device_id in context.v380_device_ids:
        scrubber.learn_device_id(device_id)
    for ticket in context.v380_tickets:
        scrubber.learn_v380_ticket(ticket)
    for transcript in context.transcripts:
        learn_from_transcript(scrubber, transcript)
    for transcript in context.transcripts:
        scrub_transcript(scrubber, transcript)

    manifest = {
        "captured": datetime.date.today().isoformat(),
        "script": "python tools/camera-capture/capture.py " + " ".join(
            arg for arg in sys.argv[1:] if not re.match(r"--env-file", arg) and arg != args.env_file),
        "commit": commit(),
    }
    for protocol in asked:
        transcripts = [t for t in context.transcripts if t.protocol == protocol]
        if transcripts:
            folder = write_folder(protocol, args.model, context.firmware, transcripts, manifest)
            print(f"wrote {folder.relative_to(REPO_ROOT)}")
    for line in context.failures:
        print(f"failed: {line}")
    for line in context.moves:
        print(f"write: {line}")


if __name__ == "__main__":
    main()
