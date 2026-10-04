"""ONVIF scenarios: SOAP over HTTP, the envelopes built the way OnvifEnvelope builds them."""

import base64
import datetime
import hashlib
import http.client
import os
import socket
import xml.etree.ElementTree as ET
from urllib.parse import urlparse

from recording import FIXTURE_ACCOUNT, NEUTRAL_VALUES, Account, Transcript, record_failure

PORTS = [80, 2020, 8000, 8080, 8899]
PATHS = ["/onvif/device_service", "/onvif/service", "/device_service"]
DEVICE_NS = "http://www.onvif.org/ver10/device/wsdl"
MEDIA_NS = "http://www.onvif.org/ver10/media/wsdl"
PTZ_NS = "http://www.onvif.org/ver20/ptz/wsdl"
IMAGING_NS = "http://www.onvif.org/ver20/imaging/wsdl"
SERVICE_OF_NAMESPACE = {DEVICE_NS: "device", MEDIA_NS: "media", PTZ_NS: "ptz", IMAGING_NS: "imaging"}
REFUSED = Account(FIXTURE_ACCOUNT.username, NEUTRAL_VALUES["refusedPassword"])


def anonymous(body):
    return ('<?xml version="1.0" encoding="utf-8"?><s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope">'
            f"<s:Body>{body}</s:Body></s:Envelope>")


def secured(account, body, nonce, created):
    digest = base64.b64encode(hashlib.sha1(nonce + created.encode() + account.password.encode()).digest()).decode()
    nonce64 = base64.b64encode(nonce).decode()
    return f"""<?xml version="1.0" encoding="utf-8"?>
<s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope"
            xmlns:wsse="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd"
            xmlns:wsu="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-utility-1.0.xsd">
  <s:Header>
    <wsse:Security>
      <wsse:UsernameToken>
        <wsse:Username>{account.username}</wsse:Username>
        <wsse:Password Type="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-username-token-profile-1.0#PasswordDigest">{digest}</wsse:Password>
        <wsse:Nonce EncodingType="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-soap-message-security-1.0#Base64Binary">{nonce64}</wsse:Nonce>
        <wsu:Created>{created}</wsu:Created>
      </wsse:UsernameToken>
    </wsse:Security>
  </s:Header>
  <s:Body>
    {body}
  </s:Body>
</s:Envelope>"""


def local(tag):
    return tag.rsplit("}", 1)[-1]


def descendants(xml, name):
    if not xml:
        return []
    try:
        root = ET.fromstring(xml)
    except ET.ParseError:
        return []
    return [element for element in root.iter() if local(element.tag) == name]


class OnvifSession:
    def __init__(self, host, port, account, timeout):
        self.host, self.port, self.account, self.timeout = host, port, account, timeout
        self.paths = {}

    def post(self, transcript, path, body, sign_as=None, action=None):
        """Sends with the real account, records the same request signed by the fixture account."""
        if sign_as is None:
            sent = recorded = anonymous(body)
        else:
            nonce = os.urandom(16)
            created = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
            sent = secured(sign_as, body, nonce, created)
            recorded_account = REFUSED if sign_as.password != self.account.password else FIXTURE_ACCOUNT
            recorded = secured(recorded_account, body, nonce, created)
        content_type = "application/soap+xml; charset=utf-8" + (f'; action="{action}"' if action else "")
        transcript.add(direction="request", method="POST", path=path,
                       headers=[["Content-Type", content_type]], body=recorded)
        connection = http.client.HTTPConnection(self.host, self.port, timeout=self.timeout)
        try:
            connection.request("POST", path, body=sent.encode("utf-8"), headers={"Content-Type": content_type})
            response = connection.getresponse()
            text = response.read().decode("utf-8", errors="replace")
            transcript.add(direction="response", status=response.status, reason=response.reason,
                           headers=[[name, value] for name, value in response.getheaders()], body=text)
            return response.status, text
        except http.client.HTTPException as error:
            transcript.add(direction="response", event="malformed", error=type(error).__name__)
        except OSError as error:
            record_failure(transcript, error)
        finally:
            connection.close()
        return None, None

    def path_of(self, service):
        return self.paths.get(service, self.paths["device"])


def identifies(status, body):
    if status is None or status == 404:
        return False
    text = (body or "").lower()
    return "onvif" in text and ("envelope" in text or status == 401)


def find_port(host, preferred):
    for port in ([preferred] if preferred else PORTS):
        try:
            with socket.create_connection((host, port), timeout=2):
                return port
        except OSError:
            continue
    return None


def run(context):
    """Read-only first; the preset write runs only with --allow-writes and removes what it stored."""
    port = find_port(context.host, context.onvif_port)
    if port is None:
        context.fail("onvif", "no ONVIF port open")
        return
    session = OnvifSession(context.host, port, context.account, context.timeout)
    real = context.account

    t = context.transcript("onvif", "discovery-get-system-date-and-time",
                           "The credential-free fingerprint, asked on each candidate path until one answers ONVIF.")
    for path in PATHS:
        status, body = session.post(t, path, f'<GetSystemDateAndTime xmlns="{DEVICE_NS}"/>')
        if identifies(status, body):
            session.paths["device"] = path
            break
    if "device" not in session.paths:
        context.fail("onvif", "no path answered ONVIF")
        return
    device = session.paths["device"]

    t = context.transcript("onvif", "get-services", "Where each service lives: anonymous first, the account only on a 401.")
    get_services = f'<GetServices xmlns="{DEVICE_NS}"><IncludeCapability>false</IncludeCapability></GetServices>'
    status, body = session.post(t, device, get_services)
    if status == 401:
        status, body = session.post(t, device, get_services, sign_as=real)
    if status == 200:
        for service in descendants(body, "Service"):
            fields = {local(child.tag): (child.text or "") for child in service}
            name = SERVICE_OF_NAMESPACE.get(fields.get("Namespace"))
            if name and fields.get("XAddr"):
                session.paths[name] = urlparse(fields["XAddr"]).path or device

    t = context.transcript("onvif", "get-capabilities", "Every capability the device announces.")
    session.post(t, device, f'<GetCapabilities xmlns="{DEVICE_NS}"><Category>All</Category></GetCapabilities>', sign_as=real)

    t = context.transcript("onvif", "get-device-information", "The login check and the identity: model, firmware, serial.")
    status, body = session.post(t, device, f'<GetDeviceInformation xmlns="{DEVICE_NS}"/>', sign_as=real)
    if status == 200:
        info = {name: (descendants(body, name) or [None])[0] for name in ("Model", "FirmwareVersion", "SerialNumber", "HardwareId")}
        context.firmware = context.firmware or (info["FirmwareVersion"].text if info["FirmwareVersion"] is not None else None)
        for name in ("SerialNumber", "HardwareId"):
            if info[name] is not None and info[name].text:
                context.serials.append(info[name].text)

    t = context.transcript("onvif", "get-device-information-refused", "The same login with a wrong password.")
    session.post(t, device, f'<GetDeviceInformation xmlns="{DEVICE_NS}"/>', sign_as=Account(real.username, REFUSED.password))

    t = context.transcript("onvif", "get-profiles", "The media profiles, their sources, encoders and PTZ configuration.")
    status, body = session.post(t, session.path_of("media"), f'<GetProfiles xmlns="{MEDIA_NS}"/>', sign_as=real,
                                action=f"{MEDIA_NS}/GetProfiles")
    profiles = descendants(body, "Profiles") if status == 200 else []
    profile_token = profiles[0].get("token") if profiles else "profile1"
    ptz_config = None
    source_token = None
    if profiles:
        ptz = [e for e in profiles[0].iter() if local(e.tag) == "PTZConfiguration"]
        ptz_config = ptz[0].get("token") if ptz else None
        sources = [e for e in profiles[0].iter() if local(e.tag) == "SourceToken"]
        source_token = sources[0].text if sources else None

    t = context.transcript("onvif", "get-stream-uri", "The RTSP address of the first profile.")
    status, body = session.post(t, session.path_of("media"), f"""<GetStreamUri xmlns="{MEDIA_NS}">
  <StreamSetup>
    <Stream xmlns="http://www.onvif.org/ver10/schema">RTP-Unicast</Stream>
    <Transport xmlns="http://www.onvif.org/ver10/schema">
      <Protocol>RTSP</Protocol>
    </Transport>
  </StreamSetup>
  <ProfileToken>{profile_token}</ProfileToken>
</GetStreamUri>""", sign_as=real, action=f"{MEDIA_NS}/GetStreamUri")
    uris = descendants(body, "Uri") if status == 200 else []
    if uris and uris[0].text:
        context.stream_uri = uris[0].text

    if ptz_config:
        t = context.transcript("onvif", "ptz-get-configuration-options", "The PTZ ranges of the first profile's configuration.")
        session.post(t, session.path_of("ptz"), f"""<GetConfigurationOptions xmlns="{PTZ_NS}">
  <ConfigurationToken>{ptz_config}</ConfigurationToken>
</GetConfigurationOptions>""", sign_as=real)
        t = context.transcript("onvif", "ptz-get-status", "Where the head points.")
        session.post(t, session.path_of("ptz"), f"""<GetStatus xmlns="{PTZ_NS}">
  <ProfileToken>{profile_token}</ProfileToken>
</GetStatus>""", sign_as=real)

    t = context.transcript("onvif", "ptz-get-presets",
                           "The stored presets, asked even when the profile has no PTZ configuration.")
    presets = get_presets(session, t, profile_token, real)

    if source_token:
        t = context.transcript("onvif", "imaging-get-imaging-settings", "The image settings of the first video source.")
        session.post(t, session.path_of("imaging"), f"""<GetImagingSettings xmlns="{IMAGING_NS}">
  <VideoSourceToken>{source_token}</VideoSourceToken>
</GetImagingSettings>""", sign_as=real, action=f"{IMAGING_NS}/GetImagingSettings")

    if context.allow_writes and ptz_config and presets is not None:
        store_and_remove_preset(context, session, profile_token, presets, real)


def get_presets(session, transcript, profile_token, account):
    status, body = session.post(transcript, session.path_of("ptz"), f"""<GetPresets xmlns="{PTZ_NS}">
  <ProfileToken>{profile_token}</ProfileToken>
</GetPresets>""", sign_as=account)
    return [preset.get("token") for preset in descendants(body, "Preset")] if status == 200 else None


def store_and_remove_preset(context, session, profile_token, presets, account):
    """Stores a preset where the head already points, then removes it: the camera ends as it started."""
    t = context.transcript("onvif", "ptz-set-preset-and-remove",
                           "Presets listed, one stored on a free token without moving, listed again, removed, listed again.")
    t.writes = True
    free = next(str(token) for token in range(5, 256) if str(token) not in presets)
    path = session.path_of("ptz")
    set_preset = f"""<SetPreset xmlns="{PTZ_NS}">
  <ProfileToken>{profile_token}</ProfileToken>
  <PresetToken>{free}</PresetToken>
  <PresetName>vyzio_home</PresetName>
</SetPreset>"""
    status, body = session.post(t, path, set_preset, sign_as=account)
    if status != 200:
        # Some firmwares only create a preset under a token they choose themselves.
        status, body = session.post(t, path, f"""<SetPreset xmlns="{PTZ_NS}">
  <ProfileToken>{profile_token}</ProfileToken>
  <PresetName>vyzio_home</PresetName>
</SetPreset>""", sign_as=account)
    if status != 200:
        context.note("onvif preset write refused, nothing to remove")
        return
    tokens = descendants(body, "PresetToken")
    stored = tokens[0].text if tokens and tokens[0].text else free
    get_presets(session, t, profile_token, account)
    session.post(t, path, f"""<RemovePreset xmlns="{PTZ_NS}">
  <ProfileToken>{profile_token}</ProfileToken>
  <PresetToken>{stored}</PresetToken>
</RemovePreset>""", sign_as=account)
    after = get_presets(session, t, profile_token, account)
    context.note("onvif preset stored and removed" if after is not None and stored not in after
                 else "onvif preset may still be stored: check the camera")
    context.moves.append("ONVIF SetPreset + RemovePreset (no head move)")
