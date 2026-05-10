using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Vyzio.Core.Entities;

[Table("settings")]
public class Setting
{
    [Key, MaxLength(200)]
    public required string Key { get; set; }

    [Required]
    public required string Value { get; set; }  // JSON
}
