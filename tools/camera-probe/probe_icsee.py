"""
ICSee / XMEye / Xiongmai DVRIP — Privacy mode probe
Tests whether VideoEnable=False cuts the stream at sensor level.

Usage:
    python probe_icsee.py <IP> <user> <password>
"""

import sys
import json
import time

try:
    from dvrip import DVRIPCam
except ImportError:
    print("[ERR] python-dvr not installed. Run: pip install python-dvr")
    sys.exit(1)


def run(host, user, password):
    print(f"\n=== ICSee/DVRIP probe on {host} ===\n")

    cam = DVRIPCam(host, user=user, password=password)

    print("[1/6] Connecting...")
    if not cam.login():
        print("[ERR] Login failed. Check IP, username, password.")
        return

    print("      Login OK")

    # ── System info ──────────────────────────────────────────────────────────
    print("\n[2/6] System info...")
    try:
        info = cam.get_info("General.Version")
        print(f"      Firmware: {json.dumps(info, indent=2)}")
    except Exception as e:
        print(f"      (not available: {e})")

    # ── Read current encode config ────────────────────────────────────────────
    print("\n[3/6] Reading Simplify.Encode...")
    try:
        enc = cam.get_info("Simplify.Encode")
        print(f"      Full config:\n{json.dumps(enc, indent=2)}")

        video_enable_main = enc[0].get("MainFormat", {}).get("VideoEnable", "NOT FOUND")
        video_enable_extra = enc[0].get("ExtraFormat", {}).get("VideoEnable", "NOT FOUND")
        print(f"\n      VideoEnable MainFormat  = {video_enable_main}")
        print(f"      VideoEnable ExtraFormat = {video_enable_extra}")
    except Exception as e:
        print(f"      [ERR] Could not read Simplify.Encode: {e}")
        enc = None

    # ── Disable video ─────────────────────────────────────────────────────────
    if enc is None:
        print("\n[SKIP] Cannot test VideoEnable=False (config unreadable)")
    else:
        print("\n[4/6] Setting VideoEnable=False on both streams...")
        print("      → Open your RTSP stream NOW in VLC to observe the change")
        print(f"      → RTSP URL: rtsp://{user}:{password}@{host}:554/")
        input("      Press ENTER when you're watching the RTSP stream...")

        try:
            enc[0]['MainFormat']['VideoEnable'] = False
            enc[0]['ExtraFormat']['VideoEnable'] = False
            result = cam.set_info("Simplify.Encode", enc)
            print(f"      set_info result: {result}")
        except Exception as e:
            print(f"      [ERR] set_info failed: {e}")
            result = None

        if result is not None:
            print("\n      Waiting 5 seconds — observe your RTSP stream...")
            for i in range(5, 0, -1):
                print(f"      {i}...", end="\r")
                time.sleep(1)
            print()

            # Read back to confirm
            enc_after = cam.get_info("Simplify.Encode")
            ve_main = enc_after[0].get("MainFormat", {}).get("VideoEnable", "?")
            ve_extra = enc_after[0].get("ExtraFormat", {}).get("VideoEnable", "?")
            print(f"      Confirmed VideoEnable MainFormat  = {ve_main}")
            print(f"      Confirmed VideoEnable ExtraFormat = {ve_extra}")

            input("\n      What did you observe on the RTSP stream? Press ENTER to RESTORE video...")

            # ── Restore ───────────────────────────────────────────────────────
            print("\n[5/6] Restoring VideoEnable=True...")
            enc[0]['MainFormat']['VideoEnable'] = True
            enc[0]['ExtraFormat']['VideoEnable'] = True
            result2 = cam.set_info("Simplify.Encode", enc)
            print(f"      Restore result: {result2}")
            time.sleep(2)

            enc_restored = cam.get_info("Simplify.Encode")
            ve_main_r = enc_restored[0].get("MainFormat", {}).get("VideoEnable", "?")
            print(f"      VideoEnable MainFormat after restore = {ve_main_r}")

    # ── Explore other config paths ────────────────────────────────────────────
    print("\n[6/6] Exploring additional config paths...")
    paths = ["Camera.Param.[0]", "Encode.Video.[0]", "VideoColor.[0]", "OSDInfo.[0]"]
    for path in paths:
        try:
            val = cam.get_info(path)
            print(f"\n  {path}:\n{json.dumps(val, indent=2)}")
        except Exception as e:
            print(f"  {path}: not available ({e})")

    cam.close()
    print("\n=== Probe complete ===\n")


if __name__ == "__main__":
    if len(sys.argv) != 4:
        print("Usage: python probe_icsee.py <IP> <user> <password>")
        sys.exit(1)
    run(sys.argv[1], sys.argv[2], sys.argv[3])
