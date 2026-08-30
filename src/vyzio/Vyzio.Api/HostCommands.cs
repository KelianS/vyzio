using Vyzio.Application.UseCases.Access;
using Vyzio.Core.Entities;

namespace Vyzio.Api;

/// <summary>
/// What the person running the installation can do from the host machine, and only from there. Not a
/// general command line: the single thing the interface cannot offer is a way back in after a
/// forgotten password, since every screen is behind that password (ADR-54).
/// </summary>
public static class HostCommands
{
    public const string ResetPassword = "reset-password";

    /// <summary>Null when the process was started to serve, which is every other case.</summary>
    public static string? Match(string[] args) => args is [ResetPassword] ? ResetPassword : null;

    public static async Task<int> RunAsync(IServiceProvider services, string command)
    {
        ArgumentNullException.ThrowIfNull(services);

        return command switch
        {
            ResetPassword => await ResetPasswordAsync(services),
            _ => Fail($"Commande inconnue : {command}")
        };
    }

    private static async Task<int> ResetPasswordAsync(IServiceProvider services)
    {
        using var scope = services.CreateScope();
        var useCase = scope.ServiceProvider.GetRequiredService<ResetOwnerPasswordUseCase>();

        var reset = await useCase.ExecuteAsync();
        if (reset is null)
            return Fail("Cette installation n'a pas encore de mot de passe : ouvrez Vyzio pour en choisir un.");

        // The window is stated here because it is the only place the operator learns it: no screen
        // can say it, they are all behind the password that was just removed.
        Console.WriteLine(
            $"Mot de passe retire. Ouvrez Vyzio dans les {Account.ResetWindow.TotalMinutes:0} minutes "
            + "pour en choisir un nouveau, sur le meme ecran qu'a la premiere installation.");
        Console.WriteLine($"Sessions fermees : {reset.SessionsClosed}.");

        return 0;
    }

    private static int Fail(string message)
    {
        Console.Error.WriteLine(message);
        return 1;
    }
}
