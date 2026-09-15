using PlanFlow.Core.Common;

namespace PlanFlow.Core.Domain;

/// <summary>One row of Input_BOQ.</summary>
public sealed class BoqItem
{
    public string BOQCode { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string? LongDescription { get; set; }
    public string Unit { get; set; } = string.Empty;
    public decimal Quantity { get; set; }
    public decimal Rate { get; set; }
    public decimal TotalCost { get; set; }
    public string? CostStage { get; set; }
    public int OriginalRow { get; set; }
    public string? Discipline { get; set; }
    public string? LocationFilter { get; set; }
    public string? AreaFilter { get; set; }
    public string? ActivityGroup { get; set; }
    public string? WBSCode { get; set; }
    public string? ResourceCode { get; set; }
    public ReviewStatus Status { get; set; } = ReviewStatus.Manual;
    public string? ReviewComment { get; set; }
}
