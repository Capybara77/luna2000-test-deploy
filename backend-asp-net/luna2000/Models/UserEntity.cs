using System.ComponentModel.DataAnnotations;
using luna2000.Markers;

namespace luna2000.Models;

public enum UserRole
{
    Admin  = 0,
    Editor = 1,
    Driver = 2
}

public class UserEntity : IDoNotLog
{
    [Key]
    public Guid Id { get; set; }

    public string Name { get; set; } = string.Empty;

    public string Login { get; set; } = string.Empty;

    public string Password { get; set; } = string.Empty;

    /// <summary>Роль: Admin / Editor / Driver</summary>
    public UserRole Role { get; set; } = UserRole.Editor;

    /// <summary>Для роли Driver — ссылка на водителя</summary>
    public Guid? DriverId { get; set; }

    public virtual DriverEntity? Driver { get; set; }
}
