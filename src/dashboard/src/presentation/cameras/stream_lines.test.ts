import { describe, expect, it } from 'vitest'
import { makeCameraStream, makeStreamLineup } from '../../testing/camera_stream_fixture'
import {
  StreamLineState,
  roleOptions,
  streamCoverageLine,
  streamLineState,
  streamQuality,
} from './stream_lines'

const recording = makeCameraStream({ role: 'record' })
const detecting = makeCameraStream({ id: 'sub', ordinal: 1, role: 'detect' })

describe('stream_lines', () => {
  it.each([
    [makeCameraStream({ enabled: false, verified: false }), StreamLineState.Disabled],
    [makeCameraStream({ checkedAt: null }), StreamLineState.Unchecked],
    [makeCameraStream({ verified: false }), StreamLineState.Failed],
    [makeCameraStream(), StreamLineState.Working],
  ])('streamLineState_ShouldGiveTheLinesState_WhenTheStreamIsAsGiven', (stream, expected) => {
    // Arrange & Act
    const state = streamLineState(stream)

    // Assert
    expect(state).toBe(expected)
  })

  it('roleOptions_ShouldOfferOnlyTheRolesThatRecord_WhenTheStreamRecords', () => {
    // Arrange
    const lineup = makeStreamLineup([recording, detecting])

    // Act
    const options = roleOptions(recording, lineup)

    // Assert
    expect(options.map((option) => option.value)).toEqual(['record', 'record_and_detect'])
  })

  it('roleOptions_ShouldOfferEveryRole_WhenTheStreamDoesNotRecord', () => {
    // Arrange
    const lineup = makeStreamLineup([recording, detecting])

    // Act
    const options = roleOptions(detecting, lineup)

    // Assert
    expect(options).toHaveLength(4)
  })

  it.each([
    [makeCameraStream({ width: 640, height: 360, fps: 10 }), '640 × 360 · 10 img/s'],
    [makeCameraStream({ width: null, height: null, fps: null }), 'Flux principal'],
    [
      makeCameraStream({ ordinal: 2, width: null, height: null, fps: 12 }),
      'Flux secondaire 2 · 12 img/s',
    ],
  ])(
    'streamQuality_ShouldDescribeTheStreamByWhatTheCameraReports_WhenGiven',
    (stream, expected) => {
      // Arrange & Act
      const quality = streamQuality(stream)

      // Assert
      expect(quality).toBe(expected)
    },
  )

  it.each([
    [null, null],
    [makeStreamLineup([recording, detecting], { detectStreamId: 'sub' }), null],
    [
      makeStreamLineup([recording, { ...detecting, verified: false }], { detectStreamId: 'sub' }),
      'Le flux de détection ne répond pas : la détection est interrompue. Relancez sa vérification ou donnez la détection à un autre flux, dans « Options ».',
    ],
    [
      makeStreamLineup([recording], { detectsOnRecordingStream: true }),
      'La détection passe par le flux d’enregistrement.',
    ],
  ])(
    'streamCoverageLine_ShouldSayWhatDetectionRunsOn_WhenTheLineupIsAsGiven',
    (lineup, expected) => {
      // Arrange & Act
      const line = streamCoverageLine(lineup)

      // Assert
      expect(line).toBe(expected)
    },
  )
})
