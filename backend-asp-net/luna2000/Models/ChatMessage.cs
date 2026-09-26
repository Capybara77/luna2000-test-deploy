using luna2000.Markers;

namespace luna2000.Models;

/// <summary>Сообщение в чате водителей</summary>
public class ChatMessage : IDoNotLog
{
    public Guid Id { get; set; }
    public Guid DriverId { get; set; }
    public ChatChannel Channel { get; set; }
    public string Text { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }

    public virtual DriverEntity? Driver { get; set; }
}

public enum ChatChannel
{
    General = 0,   // Общий
    Where   = 1,   // Где стоят
    Flea    = 2    // Барахолка
}
