import { afterEach, describe, expect, it, vi } from 'vitest'
import { NetworkError } from './HttpError'
import { httpErrorFrom, send } from './send'

function answer(
  status: number,
  statusText: string,
  body: string,
  contentType = 'application/json',
) {
  return new Response(body, { status, statusText, headers: { 'Content-Type': contentType } })
}

describe('httpErrorFrom', () => {
  it('httpErrorFrom_ShouldNameTheRequestAndKeepTheErrorCode_WhenTheAnswerCarriesACode', async () => {
    const error = await httpErrorFrom(
      answer(409, 'Conflict', JSON.stringify({ error: 'not_calibrated' })),
      'http://hub/api/cameras/cam-1/ptz/presets/2?x=1',
      'PUT',
    )

    expect(error.status).toBe(409)
    expect(error.diagnostic).toBe(
      'PUT /api/cameras/cam-1/ptz/presets/2 · 409 Conflict · not_calibrated',
    )
  })

  it('httpErrorFrom_ShouldKeepTheCodeAndTheReason_WhenTheAnswerCarriesBoth', async () => {
    const body = JSON.stringify({ error: 'camera_refused', message: 'Privacy mode is on' })

    const error = await httpErrorFrom(
      answer(502, 'Bad Gateway', body),
      '/api/cameras/c/ptz/move',
      'POST',
    )

    expect(error.diagnostic).toBe(
      'POST /api/cameras/c/ptz/move · 502 Bad Gateway · camera_refused · Privacy mode is on',
    )
  })

  it('httpErrorFrom_ShouldReadTheReason_WhenTheErrorFieldIsASentenceRatherThanACode', async () => {
    const body = JSON.stringify({ error: 'Unknown capability: zoom' })

    const error = await httpErrorFrom(
      answer(400, 'Bad Request', body),
      '/api/cameras/c/capabilities/zoom',
    )

    expect(error.diagnostic).toBe(
      'GET /api/cameras/c/capabilities/zoom · 400 Bad Request · Unknown capability: zoom',
    )
  })

  it('httpErrorFrom_ShouldKeepTheDetailAndTheTraceId_WhenTheAnswerIsAProblemDetails', async () => {
    const body = JSON.stringify({
      title: 'An error occurred',
      detail: 'Frame unavailable',
      traceId: '00-abc-01',
    })

    const error = await httpErrorFrom(
      answer(500, 'Internal Server Error', body),
      '/api/cameras/c/frame',
    )

    expect(error.diagnostic).toBe(
      'GET /api/cameras/c/frame · 500 Internal Server Error · Frame unavailable · trace 00-abc-01',
    )
  })

  it('httpErrorFrom_ShouldStillNameTheRequestAndStatus_WhenTheAnswerIsNotJson', async () => {
    const error = await httpErrorFrom(
      answer(502, 'Bad Gateway', '<html>nginx</html>', 'text/html'),
      '/api/hub',
    )

    expect(error.diagnostic).toBe('GET /api/hub · 502 Bad Gateway')
  })
})

describe('send', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('send_ShouldNameTheRequestThatGotNoAnswer_WhenTheNetworkFails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))

    const failure = send('http://hub/api/cameras?token=abc', { method: 'DELETE' })

    await expect(failure).rejects.toBeInstanceOf(NetworkError)
    await expect(failure).rejects.toMatchObject({
      diagnostic: 'DELETE /api/cameras · Failed to fetch',
    })
  })
})
