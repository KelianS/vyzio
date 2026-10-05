using System.Buffers.Binary;
using System.Security.Cryptography;
using System.Text;
using Vyzio.Infrastructure.VendorAdapters;

namespace Vyzio.Tests.Contracts;

// The V380 auth frame carries the password AES-encrypted under a session key sent beside it (V380Client).
internal static class V380AuthFrame
{
    private const int KeyLength = 16;
    private const int PasswordOffset = V380Client.AuthSessionKeyOffset + KeyLength;

    // Where the session key and the encrypted password sit: the key changes every login, the password does not.
    public static readonly Range Secret = V380Client.AuthSessionKeyOffset..(PasswordOffset + KeyLength);

    public static bool CarriesAPassword(byte[] frame)
        => frame.Length >= Secret.End.Value
           && BinaryPrimitives.ReadInt32LittleEndian(frame) == V380Client.AuthCommand
           && frame.AsSpan(PasswordOffset, KeyLength).ContainsAnyExcept((byte)0);

    public static string Password(byte[] frame)
    {
        using var sessionAes = Aes.Create();
        sessionAes.Key = frame[V380Client.AuthSessionKeyOffset..PasswordOffset];
        using var staticAes = Aes.Create();
        staticAes.Key = V380Client.StaticKey.ToArray();
        var plain = staticAes.DecryptEcb(sessionAes.DecryptEcb(frame.AsSpan(PasswordOffset, KeyLength), PaddingMode.None), PaddingMode.None);
        return Encoding.UTF8.GetString(plain).TrimEnd('\0');
    }
}
