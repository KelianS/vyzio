namespace Vyzio.Core.Entities;

// Hardware video decoding available to Frigate's ffmpeg (ADR-34). Deliberately separate from
// FrigateDetectorKind: a host can carry a Coral accelerator *and* an Intel iGPU — the classic
// Frigate build — in which case inference runs on the Coral while decoding still belongs on the
// GPU. Tying the two together would silently lose that.
public enum FrigateHwAccel
{
    None,

    // Codec-agnostic, works from gen1 onwards. Frigate also ships codec-specific QuickSync presets
    // that suit gen13+/Arc better, but selecting one requires knowing each camera's codec, which
    // Vyzio does not record — see backlog.
    Vaapi,
}
