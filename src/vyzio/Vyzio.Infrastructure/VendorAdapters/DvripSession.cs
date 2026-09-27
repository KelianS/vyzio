using System.Collections.Concurrent;
using System.Net.Sockets;
using Vyzio.Core.Interfaces;

namespace Vyzio.Infrastructure.VendorAdapters;

// One logged-in DVRIP connection held for several commands: they go out in order, their answers are matched in order (ADR-60).
internal sealed class DvripSession : IAsyncDisposable
{
    private readonly TcpClient _tcp;
    private readonly NetworkStream _stream;
    private readonly string _sessionId;
    private readonly string _host;
    private readonly TimeProvider _time;
    private readonly TimeSpan _answerWait;
    private readonly ConcurrentQueue<TaskCompletionSource<string?>> _pending = new();
    private readonly SemaphoreSlim _sending = new(1, 1);
    private readonly CancellationTokenSource _closing = new();
    private readonly Task _reading;
    private int _sequence = 2;
    private volatile bool _closed;
    // Why the camera side ended, carried into the error support reads (SPECS 1.5).
    private volatile string _closedBy = "connection closed by the camera";
    private int _disposed;

    internal DvripSession(TcpClient tcp, string sessionId, string host, TimeProvider time, TimeSpan answerWait)
    {
        _tcp = tcp;
        _stream = tcp.GetStream();
        _sessionId = sessionId;
        _host = host;
        _time = time;
        _answerWait = answerWait;
        _reading = ReadAnswersAsync();
    }

    // False once the camera dropped the connection: the next command needs a new session.
    public bool IsOpen => !_closed;

    // Sends a command and waits for its answer; null when the camera stays silent once it has it (ADR-56).
    public async Task<string?> ExecuteAsync(int cmdCode, Func<string, string> buildPayload, CancellationToken ct)
        => await AnswerOfAsync(await SendAsync(cmdCode, buildPayload, ct), ct);

    // Returns once the command is on the wire, with its answer still to come.
    private async Task<Task<string?>> SendAsync(int cmdCode, Func<string, string> buildPayload, CancellationToken ct)
    {
        var answer = new TaskCompletionSource<string?>(TaskCreationOptions.RunContinuationsAsynchronously);
        await _sending.WaitAsync(ct);
        try
        {
            if (_closed)
                throw new CameraUnreachableException($"DVRIP service on {_host}: {_closedBy}.");
            _pending.Enqueue(answer);
            if (_closed) Close();
            var sequence = _sequence++;
            // Never cancelled half way: a packet cut short would shift every answer after it.
            await DvripClient.SendPacketAsync(_stream, cmdCode, buildPayload(_sessionId), sequence, _sessionId, CancellationToken.None);
        }
        catch (Exception ex) when (ex is IOException or SocketException or ObjectDisposedException)
        {
            Close();
            throw new CameraUnreachableException($"DVRIP service on {_host}: {ex.Message}", ex);
        }
        finally
        {
            _sending.Release();
        }
        return answer.Task;
    }

    // The answer within the command wait; null when the camera stays silent, raised as unreachable when it hung up (ADR-56).
    private async Task<string?> AnswerOfAsync(Task<string?> answer, CancellationToken ct)
    {
        using var deadline = new CancellationTokenSource(_answerWait, _time);
        using var linked = CancellationTokenSource.CreateLinkedTokenSource(ct, deadline.Token);
        try
        {
            return await answer.WaitAsync(linked.Token)
                ?? throw new CameraUnreachableException($"No DVRIP answer from {_host} ({_closedBy}).");
        }
        catch (OperationCanceledException) when (deadline.IsCancellationRequested && !ct.IsCancellationRequested)
        {
            // Budget cameras execute on receipt and may answer late: silence within the wait stays a success (ADR-56).
            return null;
        }
    }

    private async Task ReadAnswersAsync()
    {
        try
        {
            while (await DvripClient.ReceivePacketAsync(_stream, _closing.Token) is { } packet)
                if (_pending.TryDequeue(out var answer))
                    answer.TrySetResult(packet);
        }
        catch (Exception ex) when (ex is IOException or SocketException)
        {
            _closedBy = ex.Message;
        }
        catch (Exception ex) when (ex is ObjectDisposedException or OperationCanceledException)
        {
            _closedBy = "session closed by Vyzio";
        }
        Close();
    }

    // Every command still waiting learns that no answer will come.
    private void Close()
    {
        _closed = true;
        while (_pending.TryDequeue(out var answer))
            answer.TrySetResult(null);
    }

    public async ValueTask DisposeAsync()
    {
        if (Interlocked.Exchange(ref _disposed, 1) == 1) return;
        await _closing.CancelAsync();
        _tcp.Dispose();
        await _reading;
        _closing.Dispose();
        _sending.Dispose();
    }
}
