using System.Security.Claims;
using luna2000.Data;
using luna2000.Models;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

namespace luna2000.Hubs;

/// <summary>
/// SignalR Hub для чата водителей.
/// Клиент подключается с JWT-токеном или Cookie, может слать и получать сообщения в 3 каналах.
/// </summary>
public class ChatHub : Hub
{
    private readonly LunaDbContext _db;

    public ChatHub(LunaDbContext db)
    {
        _db = db;
    }

    public override async Task OnConnectedAsync()
    {
        var driverIdStr = Context.User?.FindFirst("driverId")?.Value;
        if (!string.IsNullOrEmpty(driverIdStr))
        {
            await Groups.AddToGroupAsync(Context.ConnectionId, $"driver_{driverIdStr}");
        }
        await Groups.AddToGroupAsync(Context.ConnectionId, "channel_0");
        await Groups.AddToGroupAsync(Context.ConnectionId, "channel_1");
        await Groups.AddToGroupAsync(Context.ConnectionId, "channel_2");
        await base.OnConnectedAsync();
    }

    public async Task SendMessage(int channel, string text, string? replyToId = null, string? replyToSender = null, string? replyToText = null)
    {
        if (string.IsNullOrWhiteSpace(text)) return;

        try
        {
            var driverIdStr = Context.User?.FindFirst("driverId")?.Value;
            Guid? driverId = null;
            string driverName = Context.User?.FindFirst(ClaimTypes.Name)?.Value
                             ?? Context.User?.FindFirst("userName")?.Value
                             ?? Context.User?.Identity?.Name
                             ?? "Диспетчер";

            if (Guid.TryParse(driverIdStr, out var dId) && dId != Guid.Empty)
            {
                driverId = dId;
                var driver = await _db.Drivers.AsNoTracking().FirstOrDefaultAsync(d => d.Id == driverId);
                if (driver != null) driverName = driver.Fio;
            }

            Guid? repId = Guid.TryParse(replyToId, out var parsedRepId) && parsedRepId != Guid.Empty ? parsedRepId : null;

            var msg = new ChatMessage
            {
                Id = Guid.NewGuid(),
                DriverId = driverId,
                SenderName = driverName,
                Channel = (ChatChannel)channel,
                Text = text.Trim(),
                ReplyToId = repId,
                ReplyToSender = string.IsNullOrWhiteSpace(replyToSender) ? null : replyToSender.Trim(),
                ReplyToText = string.IsNullOrWhiteSpace(replyToText) ? null : replyToText.Trim(),
                CreatedAt = DateTime.UtcNow
            };

            _db.ChatMessages.Add(msg);
            await _db.SaveChangesAsync();

            // Отправляем всем подписчикам этого канала
            await Clients.Group($"channel_{channel}").SendAsync("ReceiveMessage", new
            {
                id = msg.Id.ToString(),
                driverId = msg.DriverId?.ToString() ?? string.Empty,
                driverName = msg.SenderName ?? driverName,
                channel = (int)msg.Channel,
                text = msg.Text,
                replyToId = msg.ReplyToId?.ToString() ?? string.Empty,
                replyToSender = msg.ReplyToSender ?? string.Empty,
                replyToText = msg.ReplyToText ?? string.Empty,
                createdAt = msg.CreatedAt.ToString("o")
            });
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[ChatHub Error] SendMessage failed: {ex.Message} {ex.StackTrace}");
            throw;
        }
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
