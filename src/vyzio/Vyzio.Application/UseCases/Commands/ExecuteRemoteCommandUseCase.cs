using Microsoft.Extensions.Logging;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;

namespace Vyzio.Application.UseCases.Commands;

/// <summary>
/// Runs one received command and journals it, whatever the outcome. Nothing here knows which channel
/// carried it — the channel is an inbound adapter, not a business path (ADR-50).
/// </summary>
public sealed class ExecuteRemoteCommandUseCase(
    IRemoteCommandRegistry registry,
    ICommandJournalRepository journal,
    ILogger<ExecuteRemoteCommandUseCase> logger)
{
    public async Task<CommandResult> ExecuteAsync(CommandInvocation invocation, CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(invocation);

        var handler = registry.HandlerFor(invocation.Command);
        if (handler is null)
        {
            logger.LogWarning("No handler registered for command {Command}.", invocation.Command);
            return await FailAsync(invocation, "no handler registered", ct);
        }

        try
        {
            var result = await handler.ExecuteAsync(invocation, ct);
            await JournalAsync(invocation, CommandOutcome.Succeeded, error: null, ct);
            return result;
        }
        catch (OperationCanceledException) when (ct.IsCancellationRequested)
        {
            throw;
        }
        catch (Exception exception)
        {
            logger.LogError(exception, "Command {Command} failed.", invocation.Command);
            return await FailAsync(invocation, exception.Message, ct);
        }
    }

    private async Task<CommandResult> FailAsync(CommandInvocation invocation, string error, CancellationToken ct)
    {
        await JournalAsync(invocation, CommandOutcome.Failed, error, ct);

        // The reason belongs to the journal, not to the thread: it would only name internals to the user.
        return CommandResult.Text("😕 Je n'ai pas pu repondre", ["Reessayez dans un instant."]);
    }

    private Task JournalAsync(CommandInvocation invocation, CommandOutcome outcome, string? error, CancellationToken ct)
        => journal.AddAsync(new CommandJournal
        {
            Channel = invocation.Origin.Channel,
            ConversationId = invocation.Origin.ConversationId,
            Command = invocation.Command,
            Outcome = outcome,
            ErrorMessage = error
        }, ct);
}
