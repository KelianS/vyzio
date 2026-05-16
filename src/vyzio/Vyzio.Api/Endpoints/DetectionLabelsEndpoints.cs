namespace Vyzio.Api.Endpoints;

public static class DetectionLabelsEndpoints
{
    private record DetectionLabelDto(string Value, string DisplayName, string Emoji, bool NotificationOnly);

    private static readonly DetectionLabelDto[] Labels =
    [
        new("person",       "Personne inconnue",              "🚶", false),
        new("person_known", "Personne reconnue (profil)",     "🧑", true),
        new("face",         "Visage",                         "👤", false),
        new("car",          "Voiture",                        "🚗", false),
        new("motorcycle",   "Moto",                           "🏍", false),
        new("bicycle",      "Vélo",                           "🚲", false),
        new("dog",          "Chien",                          "🐕", false),
        new("cat",          "Chat",                           "🐱", false),
        new("bird",         "Oiseau",                         "🐦", false),
        new("deer",         "Cerf",                           "🦌", false),
    ];

    public static IEndpointRouteBuilder MapDetectionLabels(this IEndpointRouteBuilder app)
    {
        app.MapGet("/api/detection-labels", () => Results.Ok(Labels));
        return app;
    }
}
