import { afterEach, describe, expect, it, vi } from 'vitest'
import type { LivePlayback } from '../../domain/entities/live_playback.entity'
import { FakeSocket, fakeEnvironment, fakeVideo } from '../../testing/fake_mse'
import {
  MseLiveStream,
  failureOfClose,
  liveStreamUrl,
  playableCodecs,
  tracksOf,
  type MseEnvironment,
} from './mse_live_stream'

const H264_AAC = 'video/mp4; codecs="avc1.64001E,mp4a.40.2"'

function open(env: MseEnvironment = fakeEnvironment(), video = fakeVideo()) {
  FakeSocket.opened = []
  const reports: LivePlayback[] = []
  const stop = new MseLiveStream('', env).open(video, 'cam1', 'low', (p) => reports.push(p))
  return { reports, stop, video, socket: FakeSocket.opened.at(-1) }
}

async function flushMicrotasks() {
  await Promise.resolve()
  await Promise.resolve()
}

afterEach(() => {
  vi.useRealTimers()
})

describe('liveStreamUrl', () => {
  it.each([
    {
      base: '',
      page: 'http://hub.lan:8080/',
      expected: 'ws://hub.lan:8080/api/cameras/cam%201/live/ws?quality=low',
    },
    {
      base: '',
      page: 'https://hub.lan/',
      expected: 'wss://hub.lan/api/cameras/cam%201/live/ws?quality=low',
    },
    {
      base: 'http://api:8443',
      page: 'http://hub.lan/',
      expected: 'ws://api:8443/api/cameras/cam%201/live/ws?quality=low',
    },
  ])(
    'liveStreamUrl_ShouldPointAtTheCamerasSocket_WhenThePageIs $page',
    ({ base, page, expected }) => {
      // Arrange & Act
      const url = liveStreamUrl(base, 'cam 1', 'low', page)

      // Assert
      expect(url).toBe(expected)
    },
  )
})

describe('playableCodecs', () => {
  it('playableCodecs_ShouldOfferOnlyWhatTheBrowserPlays_WhenAskedForGo2rtc', () => {
    // Arrange & Act
    const codecs = playableCodecs((mime) => /avc1|flac/.test(mime))

    // Assert
    expect(codecs).toEqual(['avc1.640029', 'avc1.64002A', 'avc1.640033', 'flac'])
  })
})

describe('tracksOf', () => {
  it.each([
    { mime: H264_AAC, video: true, audio: true },
    { mime: 'video/mp4; codecs="avc1.4D0029"', video: true, audio: false },
    { mime: 'video/mp4; codecs="flac"', video: false, audio: true },
  ])('tracksOf_ShouldReadTheAnnouncedTracks_WhenGo2rtcAnswers $mime', ({ mime, video, audio }) => {
    // Arrange & Act
    const tracks = tracksOf(mime)

    // Assert
    expect(tracks).toEqual({ video, audio })
  })
})

describe('failureOfClose', () => {
  it.each([
    { code: 4404, failure: 'removed' },
    { code: 4409, failure: 'privacy' },
    { code: 4422, failure: 'no_quality' },
    { code: 4503, failure: 'unreachable' },
    { code: 1006, failure: 'unreachable' },
  ])('failureOfClose_ShouldNameTheFailure_WhenTheSocketClosesWith $code', ({ code, failure }) => {
    // Arrange & Act
    const named = failureOfClose(code)

    // Assert
    expect(named).toBe(failure)
  })
})

describe('MseLiveStream', () => {
  it('open_ShouldFailAsUnsupportedBrowser_WhenThereIsNoMediaSource', () => {
    // Arrange & Act
    const { reports } = open({ ...fakeEnvironment(), createMediaSource: () => null })

    // Assert
    expect(reports).toEqual([
      {
        kind: 'failed',
        failure: 'unsupported_browser',
        diagnostic: 'live cam1 low: MediaSource unavailable',
      },
    ])
  })

  it('open_ShouldFailAsUnsupportedCodec_WhenTheBrowserPlaysNoVideoCodec', () => {
    // Arrange & Act
    const { reports } = open({
      ...fakeEnvironment(),
      isTypeSupported: (mime: string) => mime.includes('mp4a'),
    })

    // Assert
    expect(reports[0]).toMatchObject({ kind: 'failed', failure: 'unsupported_codec' })
  })

  it('open_ShouldAskForThePlayableCodecs_WhenTheSocketOpens', () => {
    // Arrange
    const { socket } = open()

    // Act
    socket?.open()

    // Assert
    expect(socket?.url).toBe('ws://hub.lan/api/cameras/cam1/live/ws?quality=low')
    expect(socket?.binaryType).toBe('arraybuffer')
    expect(JSON.parse(socket?.sent[0] ?? '')).toEqual({
      type: 'mse',
      value: 'avc1.640029,avc1.64002A,avc1.640033,mp4a.40.2,mp4a.40.5,flac',
    })
  })

  it('open_ShouldReportPlayingWithItsSound_WhenTheFirstSegmentIsAppended', async () => {
    // Arrange
    const env = fakeEnvironment()
    const { socket, reports } = open(env)
    socket?.open()

    // Act
    socket?.answer(H264_AAC)
    socket?.segment()
    await flushMicrotasks()

    // Assert
    expect(env.source.mime).toBe(H264_AAC)
    expect(env.source.buffer?.appended).toHaveLength(1)
    expect(reports).toEqual([{ kind: 'playing', hasAudio: true }])
  })

  it('open_ShouldJumpBackToTheLiveEdge_WhenThePictureFallsBehind', async () => {
    // Arrange
    const video = fakeVideo({ start: 0, end: 5, currentTime: 2 })
    const { socket } = open(fakeEnvironment(), video)

    // Act
    socket?.answer(H264_AAC)
    socket?.segment()
    await flushMicrotasks()

    // Assert
    expect(video.currentTime).toBeCloseTo(4.7)
  })

  it('open_ShouldFailAsUnsupportedCodec_WhenTheStreamCarriesNoVideo', () => {
    // Arrange
    const { socket, reports } = open()

    // Act
    socket?.answer('video/mp4; codecs="flac"')

    // Assert
    expect(reports).toEqual([
      {
        kind: 'failed',
        failure: 'unsupported_codec',
        diagnostic: 'live cam1 low: mse video/mp4; codecs="flac"',
      },
    ])
    expect(socket?.closed).toBe(true)
  })

  it('open_ShouldFailAsUnreachableWithTheScrubbedError_WhenGo2rtcReportsOne', () => {
    // Arrange
    const { socket, reports } = open()

    // Act
    socket?.error('streams: dial tcp 192.168.1.20:554: connection refused')

    // Assert
    expect(reports).toEqual([
      {
        kind: 'failed',
        failure: 'unreachable',
        diagnostic: 'live cam1 low: streams: dial tcp 192.168.1.20:554: connection refused',
      },
    ])
  })

  it('open_ShouldIgnoreTheMessage_WhenGo2rtcSendsSomethingElseThanJson', () => {
    // Arrange
    const { socket, reports } = open()

    // Act
    socket?.onmessage?.({ data: 'not json' })

    // Assert
    expect(reports).toEqual([])
  })

  it('open_ShouldFailForPrivacy_WhenTheApiRefusesTheStream', () => {
    // Arrange
    const { socket, reports } = open()

    // Act
    socket?.hangUp(4409, 'privacy_mode')

    // Assert
    expect(reports).toEqual([
      { kind: 'failed', failure: 'privacy', diagnostic: 'live cam1 low: close 4409 privacy_mode' },
    ])
  })

  it('open_ShouldReportAnInterruption_WhenAPlayingStreamCloses', async () => {
    // Arrange
    const { socket, reports } = open()
    socket?.answer(H264_AAC)
    socket?.segment()
    await flushMicrotasks()

    // Act
    socket?.hangUp(1006)

    // Assert
    expect(reports.at(-1)).toEqual({ kind: 'interrupted' })
  })

  it('open_ShouldFailAsUnreachable_WhenNoVideoArrivesInTime', () => {
    // Arrange
    vi.useFakeTimers()
    const { reports } = open()

    // Act
    vi.advanceTimersByTime(10_000)

    // Assert
    expect(reports).toEqual([
      { kind: 'failed', failure: 'unreachable', diagnostic: 'live cam1 low: no video within 10 s' },
    ])
  })

  it('open_ShouldCloseTheSocketAndReportNothing_WhenStopped', () => {
    // Arrange
    const { socket, reports, stop } = open()

    // Act
    stop()
    socket?.hangUp(1000)

    // Assert
    expect(socket?.closed).toBe(true)
    expect(reports).toEqual([])
  })
})
