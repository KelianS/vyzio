using System.Text.Json;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.DependencyInjection;
using Vyzio.Core.Interfaces;

namespace Vyzio.Tests.Integration;

// The interface branches on these codes, never on the status a proxy also sends (ADR-56).
public class CameraCommandErrorContractTests(CamerasApiFactory factory) : IClassFixture<CamerasApiFactory>
{
    private async Task<(int Status, JsonElement Body)> AnswerTo(Exception exception)
    {
        using var scope = factory.Services.CreateScope();
        var context = new DefaultHttpContext { RequestServices = scope.ServiceProvider };
        context.Response.Body = new MemoryStream();

        foreach (var handler in scope.ServiceProvider.GetServices<IExceptionHandler>())
        {
            if (!await handler.TryHandleAsync(context, exception, CancellationToken.None)) continue;
            context.Response.Body.Position = 0;
            return (context.Response.StatusCode, JsonDocument.Parse(context.Response.Body).RootElement.Clone());
        }

        throw new InvalidOperationException($"No registered handler answers {exception.GetType().Name}.");
    }

    [Fact]
    public async Task ExceptionHandler_ShouldAnswerCameraRefused_WhenTheCameraRefusedTheCommand()
    {
        var (status, body) = await AnswerTo(new CameraCommandRefusedException("ONVIF Ptz 400 Bad Request: Privacy mode is on"));

        Assert.Equal(StatusCodes.Status502BadGateway, status);
        Assert.Equal("camera_refused", body.GetProperty("error").GetString());
        Assert.Equal("ONVIF Ptz 400 Bad Request: Privacy mode is on", body.GetProperty("message").GetString());
    }

    [Fact]
    public async Task ExceptionHandler_ShouldAnswerCameraUnreachable_WhenTheCameraCouldNotBeReached()
    {
        var (status, body) = await AnswerTo(new CameraUnreachableException("No ONVIF service answered on 192.168.1.10"));

        Assert.Equal(StatusCodes.Status502BadGateway, status);
        Assert.Equal("camera_unreachable", body.GetProperty("error").GetString());
    }
}
