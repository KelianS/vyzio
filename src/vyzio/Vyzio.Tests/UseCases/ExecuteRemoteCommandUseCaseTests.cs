using Microsoft.Extensions.Logging.Abstractions;
using NSubstitute;
using Vyzio.Application.Commands;
using Vyzio.Application.UseCases.Commands;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;

namespace Vyzio.Tests.UseCases;

public class ExecuteRemoteCommandUseCaseTests
{
    private readonly ICommandJournalRepository _journal = Substitute.For<ICommandJournalRepository>();

    private static readonly CommandInvocation Invocation = new(
        RemoteCommandName.SystemState,
        new CommandOrigin(NotificationChannel.Telegram, "conversation-1"));

    private ExecuteRemoteCommandUseCase Build(params IRemoteCommandHandler[] handlers)
        => new(new RemoteCommandRegistry(handlers), _journal, NullLogger<ExecuteRemoteCommandUseCase>.Instance);

    private static IRemoteCommandHandler Handler(Func<Task<CommandResult>> execute)
    {
        var handler = Substitute.For<IRemoteCommandHandler>();
        handler.Descriptor.Returns(RemoteCommandDescriptor.Consultation(
            RemoteCommandName.SystemState, "maison", "Ce qui se passe chez vous"));
        handler.ExecuteAsync(Arg.Any<CommandInvocation>(), Arg.Any<CancellationToken>())
               .Returns(_ => execute());
        return handler;
    }

    private async Task<CommandJournal> CapturedEntryAsync()
    {
        var calls = _journal.ReceivedCalls().ToList();
        Assert.Single(calls);
        await Task.CompletedTask;
        return (CommandJournal)calls[0].GetArguments()[0]!;
    }

    [Fact]
    public async Task Executes_the_handler_and_returns_its_answer()
    {
        var sut = Build(Handler(() => Task.FromResult(CommandResult.Text("Tout va bien", ["Aucune detection"]))));

        var result = await sut.ExecuteAsync(Invocation);

        Assert.Equal("Tout va bien", result.Message.Headline);
    }

    [Fact]
    public async Task Journals_the_origin_the_command_and_the_outcome()
    {
        var sut = Build(Handler(() => Task.FromResult(CommandResult.Text("Tout va bien", []))));

        await sut.ExecuteAsync(Invocation);

        var entry = await CapturedEntryAsync();
        Assert.Equal(NotificationChannel.Telegram, entry.Channel);
        Assert.Equal("conversation-1", entry.ConversationId);
        Assert.Equal(RemoteCommandName.SystemState, entry.Command);
        Assert.Equal(CommandOutcome.Succeeded, entry.Outcome);
    }

    [Fact]
    public async Task Journals_a_failure_and_answers_without_naming_internals()
    {
        var sut = Build(Handler(() => throw new InvalidOperationException("frigate is down")));

        var result = await sut.ExecuteAsync(Invocation);

        var entry = await CapturedEntryAsync();
        Assert.Equal(CommandOutcome.Failed, entry.Outcome);
        Assert.Equal("frigate is down", entry.ErrorMessage);
        Assert.DoesNotContain("frigate", result.Message.Headline, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain(result.Message.Details, detail =>
            detail.Contains("frigate", StringComparison.OrdinalIgnoreCase));
    }

    [Fact]
    public async Task Journals_a_command_no_handler_answers()
    {
        var sut = Build();

        await sut.ExecuteAsync(Invocation);

        var entry = await CapturedEntryAsync();
        Assert.Equal(CommandOutcome.Failed, entry.Outcome);
    }
}
