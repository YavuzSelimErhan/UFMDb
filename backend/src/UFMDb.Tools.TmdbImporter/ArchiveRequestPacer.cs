using System.Diagnostics;

namespace UFMDb.Tools.TmdbImporter;

internal sealed class ArchiveRequestPacer
{
    private const int Ceiling = 35;
    private readonly Stopwatch clock = Stopwatch.StartNew();
    private readonly object sync = new();
    private readonly SemaphoreSlim admission = new(1);
    private TimeSpan next, recovery;
    private int rate = Ceiling;

    public async Task WaitAsync(CancellationToken ct)
    {
        await admission.WaitAsync(ct);
        try
        {
            while (true)
            {
                TimeSpan delay;
                lock (sync)
                {
                    var now = clock.Elapsed;
                    delay = next - now;
                    if (delay <= TimeSpan.Zero)
                    {
                        if (rate < Ceiling && now >= recovery)
                        {
                            rate++;
                            recovery = now.Add(TimeSpan.FromSeconds(5));
                        }
                        next = now.Add(TimeSpan.FromSeconds(1d / rate));
                        return;
                    }
                }
                await Task.Delay(delay < TimeSpan.FromMilliseconds(1) ? TimeSpan.FromMilliseconds(1) : delay, ct);
            }
        }
        finally { admission.Release(); }
    }

    public void BackOff(TimeSpan requested)
    {
        lock (sync)
        {
            var now = clock.Elapsed;
            var until = now.Add(requested < TimeSpan.FromSeconds(1) ? TimeSpan.FromSeconds(1) : requested);
            if (now >= recovery) rate = Math.Max(1, rate / 2);
            if (until > next) next = until;
            recovery = next.Add(TimeSpan.FromSeconds(10));
        }
    }
}
