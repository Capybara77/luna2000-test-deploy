using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using luna2000.Markers;

namespace luna2000.Models;

public class AliasEntity : IDoNotLog
{
    [Key]
    public Guid Id { get; set; }

    public string Alias { get; set; }

    public Guid DriverId { get; set; }

    [ForeignKey(nameof(DriverId))]
    public DriverEntity Driver { get; set; }
}