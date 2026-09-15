namespace PlanFlow.Core.Domain;

public enum ResourceType
{
    Labor,
    Material,
    Cash
}

public sealed class Resource
{
    public string ResourceCode { get; set; } = string.Empty;
    public string ResourceName { get; set; } = string.Empty;
    public ResourceType ResourceType { get; set; } = ResourceType.Labor;
    public string? Unit { get; set; }
    public decimal Rate { get; set; }
    public decimal? ProductivityRate { get; set; }
    public string? Trade { get; set; }
    public string? CalendarId { get; set; }
    public string? CostAccount { get; set; }
}

public sealed class WbsNode
{
    public string WBSCode { get; set; } = string.Empty;
    public string WBSName { get; set; } = string.Empty;
    public string? ParentCode { get; set; }
    public int Level { get; set; }
    public int Sequence { get; set; }
    public string? StageType { get; set; }
    public bool IsActive { get; set; } = true;
}

public sealed class LocationCombination
{
    public string? Building { get; set; }
    public string? Floor { get; set; }
    public string? Area { get; set; }
    public string? Zone { get; set; }
    public string? Trade { get; set; }
    public string? WorkFront { get; set; }

    public string LocationCode => string.Join("-", new[] { Building, Floor, Area, Zone, Trade, WorkFront }
        .Where(p => !string.IsNullOrWhiteSpace(p)));
}

public sealed class AuditLogEntry
{
    public DateTime TimestampUtc { get; set; } = DateTime.UtcNow;
    public string User { get; set; } = string.Empty;
    public string Operation { get; set; } = string.Empty;
    public int AffectedRows { get; set; }
    public string? Details { get; set; }
}
