using luna2000.Data;
using luna2000.Models;
using luna2000.Service;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace luna2000.Controllers
{
    [Authorize]
    public class PhotoController : Controller
    {
        private readonly LunaDbContext _context;
        private readonly IFileStorage _fileStorage;

        public PhotoController(LunaDbContext context, IFileStorage fileStorage)
        {
            _context = context;
            _fileStorage = fileStorage;
        }

        [HttpGet]
        [Route("/photo/{id}")]
        public async Task<IActionResult> Index(Guid id)
        {
            var photo = await _context.Set<PhotoEntity>()
                .AsNoTracking()
                .FirstOrDefaultAsync(entity => entity.Id == id);

            if (photo == null)
            {
                return NotFound();
            }

            return View(photo);
        }

        [HttpPost]
        [Route("photo/delete")]
        public async Task<IActionResult> Delete(Guid id)
        {
            var photo = await _context.Set<PhotoEntity>()
                .AsNoTracking()
                .FirstOrDefaultAsync(entity => entity.Id == id);

            if (photo == null)
            {
                return LocalRedirect("/");
            }

            _fileStorage.DeleteFile(photo.FileId);

            _context.Remove(photo);
            await _context.SaveChangesAsync();

            return LocalRedirect("/");
        }
    }
}
