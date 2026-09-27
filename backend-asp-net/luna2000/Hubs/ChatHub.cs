using luna2000.Data;
using luna2000.Models;
using Microsoft.AspNetCore.SignalR;

namespace luna2000.Hubs;

/// <summary>
/// SignalR Hub для чата водителей.
/// Клиент подключается с JWT-токеном, может слать и получать сообщения в 3 каналах.
/// </summary>
public class ChatHub : Hub
{
    private readonly LunaDbContext _db;

    public ChatHub(LunaDbContext db)
    {
        _db = db;
    }

    public async Task SendMessage(int channel, string text)
    {
        if (string.IsNullOrWhiteSpace(text)) return;

        var driverIdStr = Context.User?.FindFirst("driverId")?.Value;
        Guid driverId = Guid.Empty;
        string driverName = Context.User?.FindFirst("userName")?.Value 
                         ?? Context.User?.Identity?.Name 
                         ?? "Диспетчер";

        if (Guid.TryParse(driverIdStr, out var dId) && dId != Guid.Empty)
        {
            driverId = dId;
            var driver = await _db.Drivers.FindAsync(driverId);
            if (driver != null) driverName = driver.Fio;
        }

        var msg = new ChatMessage
        {
            Id = Guid.NewGuid(),
            DriverId = driverId,
            Channel = (ChatChannel)channel,
            Text = text.Trim(),
            CreatedAt = DateTime.UtcNow
        };

        _db.ChatMessages.Add(msg);
        await _db.SaveChangesAsync();

        // Отправляем всем подписчикам этого канала
        await Clients.Group($"channel_{channel}").SendAsync("ReceiveMessage", new
        {
            id = msg.Id,
            driverId = msg.DriverId,
            driverName = driverName,
            channel = msg.Channel,
            text = msg.Text,
            createdAt = msg.CreatedAt
        });
    }

    public async Task JoinChannel(int channel)
    {
        await Groups.AddToGroupAsync(Context.ConnectionId, $"channel_{channel}");
    }

    public async Task LeaveChannel(int channel)
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"channel_{channel}");
    }
}
