using PlanFlow.Core.Common;

namespace PlanFlow.Core.Domain;

public enum DurationMethod
{
    /// <summary>Duration = Quantity / ProductivityRate / NumberOfCrews.</summary>
    Productivity,
    /// <summary>Duration entered directly by the planner.</summary>
    Direct
}

public sealed class Activity
{
    public string ActivityId { get; set; } = string.Empty;
    public string ActivityName { get; set; } = string.Empty;
    public string ActivityType { get; set; } = "Task";
    public string? Discipline { get; set; }
    public string? WBSCode { get; set; }
    public string? LocationCode { get; set; }
    public string? BOQCode { get; set; }
    public string? ActivityGroup { get; set; }
    public string? Unit { get; set; }
    public decimal Quantity { get; set; }
    public decimal Cost { get; set; }
    public decimal CostWeight { get; set; }
    public decimal Duration { get; set; }
    public DurationMethod DurationMethod { get; set; } = DurationMethod.Productivity;
    public string? CalendarId { get; set; }
    public string Status { get; set; } = "NotStarted";
    public DateTime? ActualStart { get; set; }
    public DateTime? ActualFinish { get; set; }
    public decimal RemainingDuration { get; set; }
    public decimal PercentComplete { get; set; }
    public string Source { get; set; } = "Manual";
    public ReviewStatus ReviewStatus { get; set; } = ReviewStatus.Manual;

    // Forward-pass outputs (Phase 2), kept here so the model doesn't have to change later.
    public DateTime? EarlyStart { get; set; }
    public DateTime? EarlyFinish { get; set; }
    public decimal? TotalFloat { get; set; }
    public bool IsCritical { get; set; }
}
