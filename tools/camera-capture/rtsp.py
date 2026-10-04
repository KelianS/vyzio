"""RTSP scenarios: the OPTIONS fingerprint and the DESCRIBE login of RtspLogin. No SETUP, so no media."""

import base64
import hashlib
import re
import socket
from urllib.parse import urlparse

from recording import FIXTURE_ACCOUNT, NEUTRAL_VALUES, Account, record_failure

PORT = 554


def md5_hex(value):
    return hashlib.md5(value.encode("utf-8")).hexdigest()


def authorization(challenge, account, uri):
    realm = re.search(r'WWW-Authenticate:\s*Digest\s+[^\r\n]*realm="([^"]*)"', challenge, re.IGNORECASE)
    if not realm:
        return "Basic " + base64.b64encode(f"{account.username}:{account.password}".encode()).decode()
    nonce = re.search(r'WWW-Authenticate:\s*Digest\s+[^\r\n]*nonce="([^"]*)"', challenge, re.IGNORECASE).group(1)
    response = md5_hex(f"{md5_hex(f'{account.username}:{realm.group(1)}:{account.password}')}:{nonce}:{md5_hex(f'DESCRIBE:{uri}')}")
    return (f'Digest username="{account.username}", realm="{realm.group(1)}", nonce="{nonce}", '
            f'uri="{uri}", response="{response}"')


def describe(uri, sequence, auth=None):
    request = f"DESCRIBE {uri} RTSP/1.0\r\nCSeq: {sequence}\r\nAccept: application/sdp\r\nUser-Agent: Vyzio\r\n"
    if auth:
        request += f"Authorization: {auth}\r\n"
    return request + "\r\n"


def read_answer(sock):
    data = b""
    while b"\r\n\r\n" not in data:
        chunk = sock.recv(4096)
        if not chunk:
            return data.decode("latin-1")
        data += chunk
    head, _, body = data.partition(b"\r\n\r\n")
    length = re.search(rb"Content-Length:\s*(\d+)", head, re.IGNORECASE)
    while length and len(body) < int(length.group(1)):
        chunk = sock.recv(4096)
        if not chunk:
            break
        body += chunk
    return (head + b"\r\n\r\n" + body).decode("latin-1")


class Conversation:
    def __init__(self, context, transcript):
        self.transcript = transcript
        self.sock = socket.create_connection((context.host, PORT), timeout=context.timeout)

    def send(self, sent, recorded):
        self.transcript.add(direction="sent", text=recorded)
        self.sock.sendall(sent.encode("latin-1"))
        try:
            answer = read_answer(self.sock)
        except OSError as error:
            record_failure(self.transcript, error)
            return None
        self.transcript.add(direction="received", text=answer)
        return answer

    def close(self):
        self.sock.close()


def run(context):
    neutral_host = NEUTRAL_VALUES["cameraHost"]
    t = context.transcript("rtsp", "discovery-options", "The path-agnostic OPTIONS fingerprint of discovery.")
    try:
        conversation = Conversation(context, t)
        conversation.send(f"OPTIONS rtsp://{context.host}:{PORT} RTSP/1.0\r\nCSeq: 1\r\nUser-Agent: Vyzio\r\n\r\n",
                          f"OPTIONS rtsp://{neutral_host}:{PORT} RTSP/1.0\r\nCSeq: 1\r\nUser-Agent: Vyzio\r\n\r\n")
        conversation.close()
    except OSError as error:
        record_failure(t, error)
        context.fail("rtsp", "port closed")
        return

    if not context.stream_uri:
        context.fail("rtsp", "no stream address from ONVIF GetStreamUri")
        return
    stream = urlparse(context.stream_uri)
    path = stream.path + (f"?{stream.query}" if stream.query else "")
    real = context.account
    # A path carrying the account inline (ICSee) is recorded with the fixture account instead.
    recorded_path = path.replace(real.password, FIXTURE_ACCOUNT.password) if real.password else path
    recorded_path = re.sub(rf"(user=){re.escape(real.username)}(?=[&_])", rf"\g<1>{FIXTURE_ACCOUNT.username}", recorded_path)

    challenged = False
    for scenario, password, description in (
        ("describe-login", real.password, "DESCRIBE unauthenticated, then answered with the account: the SDP."),
        ("describe-refused", NEUTRAL_VALUES["refusedPassword"], "DESCRIBE answered with a wrong password."),
    ):
        if scenario == "describe-refused" and not challenged:
            context.note("rtsp: no login asked, no refusal to record")
            break
        t = context.transcript("rtsp", scenario, description)
        uri = f"rtsp://{context.host}:{PORT}{path}"
        recorded_uri = f"rtsp://{neutral_host}:{PORT}{recorded_path}"
        try:
            conversation = Conversation(context, t)
            first = conversation.send(describe(uri, 1), describe(recorded_uri, 1))
            challenged = bool(first and " 401 " in first)
            if challenged:
                account = Account(real.username, password)
                recorded_account = FIXTURE_ACCOUNT if password == real.password else Account(FIXTURE_ACCOUNT.username, password)
                conversation.send(describe(uri, 2, authorization(first, account, uri)),
                                  describe(recorded_uri, 2, authorization(first, recorded_account, recorded_uri)))
            conversation.close()
        except OSError as error:
            record_failure(t, error)
