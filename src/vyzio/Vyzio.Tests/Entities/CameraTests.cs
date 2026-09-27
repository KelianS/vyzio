using Vyzio.Core.Entities;

namespace Vyzio.Tests.Entities;

public class CameraTests
{
    [Fact]
    public void Camera_ShouldDefaultToTheSoftwareStop_WhenNoStrategyWasChosen()
    {
        // Arrange & Act
        var camera = new Camera
        {
            Id = "cam1",
            Slug = "cam1",
            FrigateCameraName = "cam1",
            DisplayName = "Test",
            Host = "192.168.1.1",
        };

        // Assert
        Assert.Equal(PrivacyStrategy.SoftwareBlur, camera.PrivacyStrategy);
    }
}
