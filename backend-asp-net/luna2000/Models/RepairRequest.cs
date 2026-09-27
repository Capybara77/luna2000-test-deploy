using System.ComponentModel.DataAnnotations;
using luna2000.Markers;

namespace luna2000.Models;

/// <summary>
/// Заявка на ремонт автомобиля от водителя.
/// Видна только водителю, создавшему заявку, и администраторам / редакторам.
/// </summary>
public class RepairRequest : IDoNotLog
{
    [Key]
    public Guid Id { get; set; }

    public Guid DriverId { get; set; }

    public Guid? CarId { get; set; }

    public string Text { get; set; } = string.Empty;

    public RepairStatus Status { get; set; } = RepairStatus.New;

    public string? AdminComment { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime? UpdatedAt { get; set; }

    public virtual DriverEntity? Driver { get; set; }

    public virtual CarEntity? Car { get; set; }
}

public enum RepairStatus
{
    New = 0,        // Новая
    InProgress = 1, // В работе
    Done = 2,       // Выполнена
    Rejected = 3    // Отклонена
}
