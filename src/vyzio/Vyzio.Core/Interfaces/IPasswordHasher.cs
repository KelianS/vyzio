namespace Vyzio.Core.Interfaces;

/// <summary>Kept a port so the hashing parameters can be raised later without touching the use cases.</summary>
public interface IPasswordHasher
{
    string Hash(string password);

    bool Verify(string password, string hash);
}
