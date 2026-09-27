using Microsoft.AspNetCore.Diagnostics;
using Vyzio.Application.UseCases.Scheduling;
using Vyzio.Core.Common;

namespace Vyzio.Api;

// A rule the user can fix is a refusal with its code, never a server failure (SPECS 7.3).
internal sealed class ScheduleRuleExceptionHandler : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(
        HttpContext httpContext, Exception exception, CancellationToken ct)
    {
        if (exception is not InvalidScheduleRuleException refused)
        {
            return false;
        }

        httpContext.Response.StatusCode = StatusCodes.Status400BadRequest;
        var error = $"schedule_{SnakeCaseEnum.ToSnakeCase(refused.Refusal)}";
        await httpContext.Response.WriteAsJsonAsync(new { error, message = exception.Message }, ct);
        return true;
    }
}
