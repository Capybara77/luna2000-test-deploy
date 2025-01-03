using luna2000.Markers;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace luna2000.Models;

public class RentScheduleEntity : IDoNotLog
{
    [Key]
    public Guid Id { get; set; }

    public DayOfWeek DayOfWeek { get; set; }

    public Guid RentId { get; set; }

    [ForeignKey(nameof(RentId))]
    public CarRentalEntity? CarRental { get; set; }
}
