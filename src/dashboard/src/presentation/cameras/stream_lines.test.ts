import { describe, expect, it } from 'vitest'
import {
  makeAvailableStream,
  makeCameraStream,
  makeStreamLineup,
} from '../../testing/camera_stream_fixture'
import {
  OTHER_PATH,
  StreamLineState,
  addChoices,
  addedStream,
  choiceOfPath,
  choiceOptions,
  mainPathChoices,
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

  it('streamFailure_ShouldNameNoWayOut_WhenTheStreamRecords', () => {
    // Arrange & Act
    const sentence = streamFailure(true)

    // Assert
    expect(sentence).toBe('Ce flux ne répond pas.')
  })

  it('streamFailure_ShouldOfferCheckingAgainOrRemoving_WhenTheStreamDoesNotRecord', () => {
    // Arrange & Act
    const sentence = streamFailure(false)

    // Assert
    expect(sentence).toBe('Ce flux ne répond pas : relancez sa vérification, ou retirez-le.')
  })

  it('addChoices_ShouldOfferOnlyTheStreamsNotListed_WhenTheCameraServesSomeAlready', () => {
    // Arrange
    const lineup = makeStreamLineup([recording])
    const available = [
      makeAvailableStream({
        rank: 0,
        path: '/stream1',
        width: 1920,
        height: 1080,
        streamId: 'main',
      }),
      makeAvailableStream(),
    ]

    // Act
    const choices = addChoices(available, lineup, 'rtsp')

    // Assert
    expect(choices.map((choice) => choice.label)).toEqual(['640 × 360 · 15 img/s', 'Autre chemin…'])
    expect(choices[0].hint).toBe('/stream2')
  })

  it('addChoices_ShouldOfferOnlyAnotherPath_WhenTheCameraListsNothingOverRtsp', () => {
    // Arrange
    const lineup = makeStreamLineup([recording])

    // Act
    const choices = addChoices([], lineup, 'rtsp')

    // Assert
    expect(choices).toEqual([OTHER_PATH])
  })

  it('addChoices_ShouldOfferNoTypedPath_WhenTheStreamGoesOverDvrip', () => {
    // Arrange
    const lineup = makeStreamLineup([recording])
    const available = [
      makeAvailableStream({ rank: 1, path: '?sub', width: null, height: null, fps: null }),
    ]

    // Act
    const choices = addChoices(available, lineup, 'dvrip')

    // Assert
    expect(choices.map((choice) => [choice.label, choice.hint])).toEqual([
      ['Flux secondaire 1', undefined],
    ])
  })

  it('addChoices_ShouldListTheWaitGreyed_WhenTheCameraIsStillAsked', () => {
    // Arrange
    const lineup = makeStreamLineup([recording])

    // Act
    const options = choiceOptions(addChoices(undefined, lineup, 'rtsp'))

    // Assert
    expect(options.map((option) => [option.label, option.unavailable])).toEqual([
      ['Recherche des flux…', 'La caméra est interrogée.'],
      ['Autre chemin…', undefined],
    ])
  })

  it('mainPathChoices_ShouldKeepTheSavedPathAsItsOwnItem_WhenTheCameraDoesNotListIt', () => {
    // Arrange
    const lineup = makeStreamLineup([recording])

    // Act
    const choices = mainPathChoices([], lineup, recording)

    // Assert
    expect(choices.map((choice) => choice.path)).toEqual(['/stream1', null])
    expect(choiceOfPath(choices, '/stream1').label).toBe('1920 × 1080 · 15 img/s')
  })

  it('mainPathChoices_ShouldLeaveOutAnotherLinesStream_WhenTheCameraListsIt', () => {
    // Arrange
    const lineup = makeStreamLineup([recording, { ...detecting, path: '/stream2' }])
    const available = [
      makeAvailableStream({ rank: 0, path: '/stream1', streamId: 'main' }),
      makeAvailableStream({ streamId: 'sub' }),
    ]

    // Act
    const choices = mainPathChoices(available, lineup, recording)

    // Assert
    expect(choices.map((choice) => choice.path)).toEqual(['/stream1', null])
  })

  it('choiceOfPath_ShouldBeAnotherPath_WhenNoStreamOfTheCameraHasIt', () => {
    // Arrange
    const choices = mainPathChoices([], makeStreamLineup([recording]), recording)

    // Act
    const choice = choiceOfPath(choices, '/typed')

    // Assert
    expect(choice).toBe(OTHER_PATH)
  })

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
