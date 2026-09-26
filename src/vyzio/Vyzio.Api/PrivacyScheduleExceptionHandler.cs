using Microsoft.AspNetCore.Diagnostics;
using Vyzio.Application.UseCases.Cameras;
using Vyzio.Core.Common;

namespace Vyzio.Api;

// A schedule the user can fix is a refusal with its code, never a server failure (SPECS 9.2).
internal sealed class PrivacyScheduleExceptionHandler : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(
        HttpContext httpContext, Exception exception, CancellationToken ct)
    {
        if (exception is not InvalidPrivacyScheduleException refused)
        {
            return false;
        }

        httpContext.Response.StatusCode = StatusCodes.Status400BadRequest;
        var error = $"schedule_{SnakeCaseEnum.ToSnakeCase(refused.Refusal)}";
        await httpContext.Response.WriteAsJsonAsync(new { error, message = exception.Message }, ct);
        return true;
    }
}
