using PlanFlow.Core.Domain;

namespace PlanFlow.Core.Scheduling;

public sealed class TimelineRow
{
    public string ActivityId { get; set; } = string.Empty;
    public string ActivityName { get; set; } = string.Empty;
    public DateTime? EarlyStart { get; set; }
    public DateTime? EarlyFinish { get; set; }
    public decimal? TotalFloat { get; set; }
    public bool IsCritical { get; set; }
}

/// <summary>Projects the forward-pass results into the flat rows Project_Timeline
/// needs to draw a simplified Gantt chart.</summary>
public static class ProjectTimelineBuilder
{
    public static IReadOnlyList<TimelineRow> Build(IReadOnlyList<Activity> activities) =>
        activities
            .OrderBy(a => a.EarlyStart)
            .Select(a => new TimelineRow
            {
                ActivityId = a.ActivityId,
                ActivityName = a.ActivityName,
                EarlyStart = a.EarlyStart,
                EarlyFinish = a.EarlyFinish,
                TotalFloat = a.TotalFloat,
                IsCritical = a.IsCritical
            })
            .ToList();
}
