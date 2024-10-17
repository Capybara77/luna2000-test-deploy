using Hangfire.Dashboard;

namespace Job_server.HangfireOptions;

public class AuthorizationFilter : IDashboardAuthorizationFilter
{
    public bool Authorize(DashboardContext context)
    {
        return true;
    }
}