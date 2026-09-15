using PlanFlow.Core.Common;
using PlanFlow.Core.Domain;

namespace PlanFlow.Core.Mapping;

public sealed class MappingRow
{
    public string BOQCode { get; set; } = string.Empty;
    public string ActivityId { get; set; } = string.Empty;
    public string ActivityName { get; set; } = string.Empty;
    public string? WBSCode { get; set; }
    public string? LocationCode { get; set; }
    public decimal Quantity { get; set; }
    public decimal Cost { get; set; }
    public decimal CostWeight { get; set; } = 1m;
    public decimal SplitRatio { get; set; } = 1m;
    public string Source { get; set; } = "Manual";
    public ReviewStatus ReviewStatus { get; set; } = ReviewStatus.Suggested;
}

/// <summary>
/// Maps BOQ items to construction activities. In the MVP this is a direct
/// one-BOQ-line-to-one-activity mapping (Splits/Mapping_Output produce the
/// many-to-many case in later phases). Anything that can't be matched goes to
/// Exceptions instead of silently creating an activity.
/// </summary>
public sealed class MappingEngine
{
    public sealed class MappingOutcome
    {
        public IReadOnlyList<MappingRow> Mapped { get; init; } = Array.Empty<MappingRow>();
        public IReadOnlyList<BoqItem> Exceptions { get; init; } = Array.Empty<BoqItem>();
    }

    public MappingOutcome MapOneToOne(IReadOnlyList<BoqItem> boqItems, IReadOnlyList<Activity> activities)
    {
        var activityByBoq = activities
            .Where(a => !string.IsNullOrWhiteSpace(a.BOQCode))
            .GroupBy(a => a.BOQCode!, StringComparer.OrdinalIgnoreCase)
            .ToDictionary(g => g.Key, g => g.First(), StringComparer.OrdinalIgnoreCase);

        var mapped = new List<MappingRow>();
        var exceptions = new List<BoqItem>();

        foreach (var boq in boqItems)
        {
            if (activityByBoq.TryGetValue(boq.BOQCode, out var activity))
            {
                mapped.Add(new MappingRow
                {
                    BOQCode = boq.BOQCode,
                    ActivityId = activity.ActivityId,
                    ActivityName = activity.ActivityName,
                    WBSCode = activity.WBSCode,
                    LocationCode = activity.LocationCode,
                    Quantity = boq.Quantity,
                    Cost = boq.TotalCost,
                    Source = activity.Source,
                    ReviewStatus = ReviewStatus.Suggested
                });
            }
            else
            {
                exceptions.Add(boq);
            }
        }

        return new MappingOutcome { Mapped = mapped, Exceptions = exceptions };
    }
}
