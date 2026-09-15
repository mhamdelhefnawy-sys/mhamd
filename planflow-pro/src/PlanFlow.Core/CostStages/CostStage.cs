namespace PlanFlow.Core.CostStages;

/// <summary>One row of Cost_Stages: a percentage slice of an activity's cost, e.g. Engineering 10%,
/// Procurement 20%, Construction 60%, Closeout 10%.</summary>
public sealed class CostStage
{
    public string StageName { get; set; } = string.Empty;
    public decimal Percentage { get; set; }
    public string? Role { get; set; }
    public string? WBSCode { get; set; }
}

/// <summary>One row of the resulting stage-cost breakdown for an activity.</summary>
public sealed class ActivityCostStageAllocation
{
    public string ActivityId { get; set; } = string.Empty;
    public string StageName { get; set; } = string.Empty;
    public decimal Cost { get; set; }
}
