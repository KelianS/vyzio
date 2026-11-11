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

        var error = $"schedule_{SnakeCaseEnum.ToSnakeCase(refused.Refusal)}";
        await ApiProblem.BadRequest(error, exception.Message).ExecuteAsync(httpContext);
        return true;
    }
}
