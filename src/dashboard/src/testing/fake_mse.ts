import { vi } from 'vitest'
import type { MseEnvironment } from '../infrastructure/live/mse_live_stream'

// What a test browser plays: H.264, AAC and FLAC, never H.265 nor Opus.
const PLAYABLE = /avc1|mp4a|flac/

export class FakeSourceBuffer extends EventTarget {
  updating = false
  mode = 'sequence'
  readonly appended: ArrayBuffer[] = []

  appendBuffer(data: ArrayBuffer) {
    this.appended.push(data)
    this.updating = true
    queueMicrotask(() => {
      this.updating = false
      this.dispatchEvent(new Event('updateend'))
    })
  }

  remove() {
    // Nothing kept to trim.
  }
}

export class FakeMediaSource extends EventTarget {
  static isTypeSupported(mime: string) {
    return PLAYABLE.test(mime)
  }

  mime: string | null = null
  buffer: FakeSourceBuffer | null = null

  addSourceBuffer(mime: string) {
    this.mime = mime
    this.buffer = new FakeSourceBuffer()
    return this.buffer
  }

  open() {
    this.dispatchEvent(new Event('sourceopen'))
  }
}

/** A socket the test drives from the go2rtc side. */
export class FakeSocket {
  static opened: FakeSocket[] = []

  binaryType = 'blob'
  readonly sent: string[] = []
  closed = false
  onopen: (() => void) | null = null
  onmessage: ((event: { data: string | ArrayBuffer }) => void) | null = null
  onclose: ((event: { code: number; reason: string }) => void) | null = null

  constructor(readonly url: string) {
    FakeSocket.opened.push(this)
  }

  static latest(): FakeSocket {
    const socket = FakeSocket.opened.at(-1)
    if (!socket) throw new Error('no live socket opened')
    return socket
  }

  send(data: string) {
    this.sent.push(data)
  }

  close() {
    this.closed = true
  }

  open() {
    this.onopen?.()
  }

  answer(mime: string) {
    this.onmessage?.({ data: JSON.stringify({ type: 'mse', value: mime }) })
  }

  error(value: string) {
    this.onmessage?.({ data: JSON.stringify({ type: 'error', value }) })
  }

  segment() {
    this.onmessage?.({ data: new ArrayBuffer(8) })
  }

  hangUp(code: number, reason = '') {
    this.onclose?.({ code, reason })
  }
}

/** A video element the test can make fail, as the browser does on a decode error. */
export type FakeVideo = HTMLVideoElement & { fail(code: number, message: string): void }

/** A video element reduced to what the stream touches; a range makes it hold that much picture. */
export function fakeVideo(range?: { start: number; end: number; currentTime: number }): FakeVideo {
  const listeners = new Map<string, () => void>()
  const video = {
    buffered: range
      ? { length: 1, start: () => range.start, end: () => range.end }
      : { length: 0, start: () => 0, end: () => 0 },
    currentTime: range?.currentTime ?? 0,
    srcObject: null,
    error: null as { code: number; message: string } | null,
    play: vi.fn(() => Promise.resolve()),
    removeAttribute: vi.fn(),
    addEventListener: (type: string, listener: () => void) => listeners.set(type, listener),
    removeEventListener: (type: string) => listeners.delete(type),
    fail: (code: number, message: string) => {
      video.error = { code, message }
      listeners.get('error')?.()
    },
  }
  return video as unknown as FakeVideo
}

export function fakeEnvironment(source = new FakeMediaSource()): MseEnvironment & {
  source: FakeMediaSource
} {
  return {
    source,
    createSocket: (url) => new FakeSocket(url) as unknown as WebSocket,
    createMediaSource: () => ({ source: source as unknown as MediaSource, managed: false }),
    isTypeSupported: (mime) => FakeMediaSource.isTypeSupported(mime),
    attach: () => source.open(),
    pageUrl: () => 'http://hub.lan/',
  }
}

/** Puts the fakes in the browser's place, for a screen that opens the stream itself. */
export function stubBrowserMse() {
  FakeSocket.opened = []
  vi.stubGlobal('MediaSource', FakeMediaSource)
  vi.stubGlobal('WebSocket', FakeSocket)
  URL.createObjectURL = (source: Blob | MediaSource) => {
    queueMicrotask(() => (source as unknown as FakeMediaSource).open())
    return 'blob:live'
  }
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined)
}
