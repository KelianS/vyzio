"""
V380 Pro — ONVIF & port probe
Tests what ONVIF services are available, especially ImagingService.

Usage:
    python probe_v380.py <IP> <user> <password> [onvif_port]
    Default ONVIF port: 8899
"""

import sys
import socket
import json

try:
    from onvif import ONVIFCamera
    import zeep
except ImportError:
    print("[ERR] onvif-zeep not installed. Run: pip install onvif-zeep")
    sys.exit(1)


def check_port(host, port, timeout=2):
    try:
        with socket.create_connection((host, port), timeout=timeout):
            return True
    except (socket.timeout, ConnectionRefusedError, OSError):
        return False


def run(host, user, password, onvif_port=8899):
    print(f"\n=== V380 Pro probe on {host} ===\n")

    # ── Port scan ─────────────────────────────────────────────────────────────
    print("[1/4] Port scan...")
    ports = [80, 554, 5050, 5051, 7050, 8800, 8899, 8080, 9000, 34567]
    open_ports = []
    for p in ports:
        status = check_port(host, p)
        tag = "OPEN" if status else "closed"
        print(f"      {p:5d} — {tag}")
        if status:
            open_ports.append(p)

    if onvif_port not in open_ports:
        print(f"\n[WARN] ONVIF port {onvif_port} is not open.")
        alt = input("       Enter another ONVIF port to try (or press ENTER to skip ONVIF): ").strip()
        if alt.isdigit():
            onvif_port = int(alt)
        else:
            onvif_port = None

    # ── ONVIF Device info ─────────────────────────────────────────────────────
    if onvif_port:
        print(f"\n[2/4] ONVIF device info (port {onvif_port})...")
        try:
            cam = ONVIFCamera(host, onvif_port, user, password)
            device = cam.create_devicemgmt_service()

            info = device.GetDeviceInformation()
            print(f"      Manufacturer : {info.Manufacturer}")
            print(f"      Model        : {info.Model}")
            print(f"      Firmware     : {info.FirmwareVersion}")
            print(f"      Serial       : {info.SerialNumber}")

            caps = device.GetCapabilities({"Category": "All"})
            print(f"\n      Capabilities:")
            print(f"        Media   : {caps.Media is not None}")
            print(f"        PTZ     : {caps.PTZ is not None}")
            print(f"        Imaging : {caps.Imaging is not None}")
            print(f"        Events  : {caps.Events is not None}")
            print(f"        Analytics: {caps.Analytics is not None}")
            if caps.Imaging:
                print(f"        ImagingService URL: {caps.Imaging.XAddr}")

        except Exception as e:
            print(f"      [ERR] ONVIF device init failed: {e}")
            caps = None
            cam = None
    else:
        caps = None
        cam = None

    # ── ONVIF Imaging service ─────────────────────────────────────────────────
    if cam and caps and caps.Imaging:
        print("\n[3/4] ONVIF ImagingService...")
        try:
            media = cam.create_media_service()
            profiles = media.GetProfiles()
            print(f"      Profiles found: {len(profiles)}")
            for p in profiles:
                print(f"        - {p.Name} (token={p.token})")

            imaging = cam.create_imaging_service()
            source_token = profiles[0].VideoSourceConfiguration.SourceToken

            settings = imaging.GetImagingSettings({"VideoSourceToken": source_token})
            print(f"\n      ImagingSettings:\n{zeep.helpers.serialize_object(settings)}")

            # Check for exposure controls
            options = imaging.GetOptions({"VideoSourceToken": source_token})
            print(f"\n      ImagingOptions:\n{zeep.helpers.serialize_object(options)}")

        except Exception as e:
            print(f"      [ERR] ImagingService failed: {e}")
    else:
        print("\n[3/4] Imaging service: not available or ONVIF not reachable")

    # ── ONVIF Media profiles & PTZ ────────────────────────────────────────────
    if cam:
        print("\n[4/4] ONVIF Media + PTZ...")
        try:
            media = cam.create_media_service()
            profiles = media.GetProfiles()
            for p in profiles:
                uris = media.GetStreamUri({
                    "StreamSetup": {"Stream": "RTP-Unicast", "Transport": {"Protocol": "RTSP"}},
                    "ProfileToken": p.token
                })
                print(f"      Stream [{p.Name}]: {uris.Uri}")
        except Exception as e:
            print(f"      [ERR] Media/PTZ: {e}")

    print("\n=== Probe complete ===\n")


if __name__ == "__main__":
    if len(sys.argv) < 4:
        print("Usage: python probe_v380.py <IP> <user> <password> [onvif_port]")
        sys.exit(1)
    port = int(sys.argv[4]) if len(sys.argv) > 4 else 8899
    run(sys.argv[1], sys.argv[2], sys.argv[3], port)
