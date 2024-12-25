using AutoMapper;
using luna2000.Data;
using luna2000.Dto;
using luna2000.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace luna2000.Controllers;

[Authorize]
public class HistoryController : Controller
{
    private readonly LunaDbContext _dbContext;
    private readonly IMapper _mapper;
    private const int ItemsPerPage = 100;

    public HistoryController(LunaDbContext dbContext, IMapper mapper)
    {
        _dbContext = dbContext;
        _mapper = mapper;
    }

    [ResponseCache(Duration = 5, Location = ResponseCacheLocation.Any)]
    public async Task<IActionResult> Index(int page = 1, Guid objFilter = default)
    {
        var logs = await _dbContext
            .Set<BaseLog>()
            .Where(log => objFilter == Guid.Empty || log.EntryId == objFilter)
            .AsNoTracking()
            .OrderByDescending(log => log.Created)
            .Skip(ItemsPerPage * (page - 1))
            .Take(ItemsPerPage)
            .ToArrayAsync();

        var count = await _dbContext
            .Set<BaseLog>()
            .CountAsync();

        var dto = new ViewHistoryDto
        {
            ItemsPerPage = ItemsPerPage,
            CurrentPage = page,
            ItemsCount = count,
            Items = _mapper.Map<IEnumerable<HistoryDto>>(logs).GroupBy(dto => dto.ChangeId)
        };

        return View(dto);
    }
}