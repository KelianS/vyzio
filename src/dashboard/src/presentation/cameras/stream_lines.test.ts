import { describe, expect, it } from 'vitest'
import { makeCameraStream, makeStreamLineup } from '../../testing/camera_stream_fixture'
import {
  StreamLineState,
  addedStream,
  roleOptions,
  streamCoverageLine,
  streamFailure,
  streamLineState,
  streamQuality,
  streamReach,
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
      'La détection est interrompue : son flux ne répond pas. Donnez-la à un autre flux dans les options.',
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

  it('streamReach_ShouldNameThePathToo_WhenItIsNotShownAsItsOwnSetting', () => {
    // Arrange
    const stream = makeCameraStream({ protocol: 'rtsp', path: '/stream2' })

    // Act
    const reach = streamReach(stream, false)

    // Assert
    expect(reach).toBe('Par RTSP, chemin /stream2.')
  })

  it.each([
    [makeCameraStream({ protocol: 'rtsp', path: '/stream1' }), true, 'Par RTSP.'],
    [makeCameraStream({ protocol: 'dvrip', path: null }), false, 'Par DVRIP.'],
  ])(
    'streamReach_ShouldNameOnlyTheProtocol_WhenThePathIsShownOrThereIsNone',
    (stream, pathShown, expected) => {
      // Arrange & Act
      const reach = streamReach(stream, pathShown)

      // Assert
      expect(reach).toBe(expected)
    },
  )

  it.each([
    [true, 'Ce flux ne répond pas.'],
    [false, 'Ce flux ne répond pas : relancez sa vérification, ou retirez-le.'],
  ])(
    'streamFailure_ShouldNameAWayOutTheLineAllows_WhenGivenWhetherTheStreamRecords (records: %s)',
    (records, expected) => {
      // Arrange & Act
      const sentence = streamFailure(records)

      // Assert
      expect(sentence).toBe(expected)
    },
  )

  it('addedStream_ShouldBeTheHighestRank_WhenTheLineupIsListedInAnyOrder', () => {
    // Arrange
    const lineup = makeStreamLineup([
      detecting,
      makeCameraStream({ id: 'third', ordinal: 2 }),
      recording,
    ])

    // Act
    const added = addedStream(lineup)

    // Assert
    expect(added?.id).toBe('third')
  })
})
