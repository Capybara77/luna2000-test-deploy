using System.Security.Claims;
using System.Text.Json;
using luna2000.Data;
using luna2000.Models;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace luna2000.Controllers;

[Route("/login")]
public class LoginController : Controller
{
    private readonly LunaDbContext _dbContext;

    public LoginController(LunaDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    [HttpGet]
    [Route("")]
    public IActionResult Index()
    {
        if (User.Identity?.IsAuthenticated == true)
        {
            return User.IsInRole("Driver")
                ? RedirectToAction("Index", "DriverPortal")
                : RedirectToAction("Index", "Home");
        }
        return View();
    }

    [HttpPost]
    [Route("")]
    public async Task<IActionResult> Login([FromBody] LoginRequest loginRequest)
    {
        var user = await _dbContext.Set<UserEntity>()
            .AsNoTracking()
            .Include(u => u.Driver)
            .FirstOrDefaultAsync(entity =>
                entity.Login == loginRequest.Username && entity.Password == loginRequest.Password);

        if (user == null)
            return NotFound(JsonSerializer.Serialize("incorrect login/password"));

        var claims = new List<Claim>
        {
            new Claim(ClaimTypes.Name, user.Login),
            new Claim(ClaimTypes.Role, user.Role.ToString()),
            new Claim("userId", user.Id.ToString()),
            new Claim("userName", user.Name)
        };

        if (user.DriverId.HasValue)
            claims.Add(new Claim("driverId", user.DriverId.Value.ToString()));

        var ci = new ClaimsIdentity(claims, CookieAuthenticationDefaults.AuthenticationScheme);
        var cp = new ClaimsPrincipal(ci);

        await HttpContext.SignInAsync(CookieAuthenticationDefaults.AuthenticationScheme, cp);

        // Редирект по роли
        var redirectUrl = user.Role switch
        {
            UserRole.Driver => "/driver-portal",
            _ => "/"
        };

        return Ok(JsonSerializer.Serialize(new { success = true, redirect = redirectUrl, role = user.Role.ToString() }));
    }

    [HttpPost]
    [Route("logout")]
    public async Task<IActionResult> Logout()
    {
        await HttpContext.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
        return Redirect("/login");
    }
}

public class LoginRequest
{
    public string Username { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
}