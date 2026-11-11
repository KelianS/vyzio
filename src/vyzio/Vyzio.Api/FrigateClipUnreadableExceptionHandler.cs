using Microsoft.AspNetCore.Diagnostics;
using Vyzio.Core.Interfaces;

namespace Vyzio.Api;

// A clip Frigate failed to serve is not a clip that no longer exists: the screen says them apart (SPECS 6.2).
internal sealed class FrigateClipUnreadableExceptionHandler : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(
        HttpContext httpContext, Exception exception, CancellationToken ct)
    {
        if (exception is not FrigateClipUnreadableException)
        {
            return false;
        }

        httpContext.Response.StatusCode = StatusCodes.Status502BadGateway;
        await httpContext.Response.WriteAsJsonAsync(new { error = "clip_unreadable", message = exception.Message }, ct);
        return true;
    }
}
