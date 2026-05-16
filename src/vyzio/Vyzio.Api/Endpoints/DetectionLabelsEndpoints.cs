namespace Vyzio.Api.Endpoints;

public static class DetectionLabelsEndpoints
{
    private record CameraLabelDto(string Value, string DisplayName, string Emoji);
    private record NotificationLabelDto(string Value, string DisplayName, string Emoji);

    private static readonly CameraLabelDto[] CameraLabels =
    [
        new("person",       "Personne",  "🚶"),
        new("car",          "Voiture",   "🚗"),
        new("motorcycle",   "Moto",      "🏍"),
        new("bicycle",      "Vélo",      "🚲"),
        new("dog",          "Chien",     "🐕"),
        new("cat",          "Chat",      "🐱"),
        new("bird",         "Oiseau",    "🐦"),
        new("deer",         "Cerf",      "🦌"),
    ];

    private static readonly NotificationLabelDto[] NotificationLabels =
    [
        new("person_unknown", "Personne inconnue",          "🚶"),
        new("person_known",   "Personne reconnue (profil)", "🧑"),
        new("car",            "Voiture",                    "🚗"),
        new("motorcycle",     "Moto",                       "🏍"),
        new("bicycle",        "Vélo",                       "🚲"),
        new("dog",            "Chien",                      "🐕"),
        new("cat",            "Chat",                       "🐱"),
        new("bird",           "Oiseau",                     "🐦"),
        new("deer",           "Cerf",                       "🦌"),
    ];

    public static IEndpointRouteBuilder MapDetectionLabels(this IEndpointRouteBuilder app)
    {
        app.MapGet("/api/detection-labels/camera", () => Results.Ok(CameraLabels));
        app.MapGet("/api/detection-labels/notifications", () => Results.Ok(NotificationLabels));
        return app;
    }
}
