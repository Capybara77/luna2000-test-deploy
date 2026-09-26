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
        if (!Guid.TryParse(driverIdStr, out var driverId)) return;

        var driver = await _db.Drivers.FindAsync(driverId);
        if (driver == null) return;

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
            driverName = driver.Fio,
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
