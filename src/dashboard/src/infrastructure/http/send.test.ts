import { afterEach, describe, expect, it, vi } from 'vitest'
import { NetworkError } from './http_error'
import { httpErrorFrom, send } from './send'

function answer(
  status: number,
  statusText: string,
  body: string,
  contentType = 'application/problem+json',
) {
  return new Response(body, { status, statusText, headers: { 'Content-Type': contentType } })
}

describe('httpErrorFrom', () => {
  it('httpErrorFrom_ShouldNameTheRequestAndKeepTheErrorCode_WhenTheAnswerCarriesACode', async () => {
    // Arrange & Act
    const error = await httpErrorFrom(
      answer(409, 'Conflict', JSON.stringify({ status: 409, code: 'not_calibrated' })),
      'http://hub/api/cameras/cam-1/ptz/presets/2?x=1',
      'PUT',
    )

    // Assert
    expect(error.status).toBe(409)
    expect(error.code).toBe('not_calibrated')
    expect(error.diagnostic).toBe(
      'PUT /api/cameras/cam-1/ptz/presets/2 · 409 Conflict · not_calibrated',
    )
  })

  it('httpErrorFrom_ShouldKeepTheCodeAndTheDetail_WhenTheProblemCarriesBoth', async () => {
    // Arrange
    const body = JSON.stringify({
      status: 502,
      code: 'camera_refused',
      detail: 'Privacy mode is on',
    })

    // Act
    const error = await httpErrorFrom(
      answer(502, 'Bad Gateway', body),
      '/api/cameras/c/ptz/move',
      'POST',
    )

    // Assert
    expect(error.diagnostic).toBe(
      'POST /api/cameras/c/ptz/move · 502 Bad Gateway · camera_refused · Privacy mode is on',
    )
  })

  it('httpErrorFrom_ShouldKeepTheCodeDetailAndTraceId_WhenTheServerFailedUnexpectedly', async () => {
    // Arrange
    const body = JSON.stringify({
      title: 'An error occurred while processing your request.',
      status: 500,
      code: 'unexpected_error',
      detail: 'InvalidOperationException',
      traceId: '00-abc-01',
    })

    // Act
    const error = await httpErrorFrom(
      answer(500, 'Internal Server Error', body),
      '/api/cameras/c/frame',
    )

    // Assert
    expect(error.diagnostic).toBe(
      'GET /api/cameras/c/frame · 500 Internal Server Error · unexpected_error · InvalidOperationException · trace 00-abc-01',
    )
  })

  it('httpErrorFrom_ShouldReadTheStatusPageLikeAnyError_WhenNoEndpointAnswersTheAddress', async () => {
    // Arrange
    const body = JSON.stringify({
      title: 'Not Found',
      status: 404,
      code: 'not_found',
      detail: 'Nothing answers at this address.',
      traceId: '00-def-01',
    })

    // Act
    const error = await httpErrorFrom(answer(404, 'Not Found', body), '/api/nowhere')

    // Assert
    expect(error.diagnostic).toBe(
      'GET /api/nowhere · 404 Not Found · not_found · Nothing answers at this address. · trace 00-def-01',
    )
  })

  it('httpErrorFrom_ShouldStillNameTheRequestAndStatus_WhenTheAnswerIsNotJson', async () => {
    // Arrange & Act
    const error = await httpErrorFrom(
      answer(502, 'Bad Gateway', '<html>nginx</html>', 'text/html'),
      '/api/hub',
    )

    // Assert
    expect(error.diagnostic).toBe('GET /api/hub · 502 Bad Gateway')
  })
})

describe('send', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('send_ShouldNameTheRequestThatGotNoAnswer_WhenTheNetworkFails', async () => {
    // Arrange
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))

    // Act
    const failure = send('http://hub/api/cameras?token=abc', { method: 'DELETE' })

    // Assert
    await expect(failure).rejects.toBeInstanceOf(NetworkError)
    await expect(failure).rejects.toMatchObject({
      diagnostic: 'DELETE /api/cameras · Failed to fetch',
    })
  })
})
