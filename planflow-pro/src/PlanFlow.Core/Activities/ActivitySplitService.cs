using PlanFlow.Core.Common;
using PlanFlow.Core.Domain;

namespace PlanFlow.Core.Activities;

public sealed class SplitDefinition
{
    public string Name { get; set; } = string.Empty;
    public decimal RatioPercent { get; set; }
    public int Sequence { get; set; }
    public string ActivityType { get; set; } = "Task";
}

/// <summary>
/// Splits one BOQ/activity quantity and cost across several sub-activities
/// (e.g. Formwork / Reinforcement / Concrete Pouring) without ever losing or
/// duplicating quantity or cost across the split.
/// </summary>
public sealed class ActivitySplitService
{
    private const decimal Tolerance = 0.01m;

    public ValidationResult ValidateRatios(IReadOnlyList<SplitDefinition> splits)
    {
        var result = new ValidationResult();
        var total = splits.Sum(s => s.RatioPercent);
        if (Math.Abs(total - 100m) > Tolerance)
        {
            result.Add(ValidationIssue.Error("SPLIT_RATIO_NOT_100",
                $"Split ratios must sum to 100%, got {total}%."));
        }
        return result;
    }

    /// <summary>Produces one activity per split. The last split absorbs any rounding remainder,
    /// so Sum(Quantity) and Sum(Cost) exactly equal the source values.</summary>
    public IReadOnlyList<Activity> Split(BoqItem source, IReadOnlyList<SplitDefinition> splits, Func<string> activityIdGenerator)
    {
        var validation = ValidateRatios(splits);
        if (!validation.IsValid)
            throw new InvalidOperationException(string.Join("; ", validation.Errors.Select(e => e.Message)));

        var ordered = splits.OrderBy(s => s.Sequence).ToList();
        var activities = new List<Activity>(ordered.Count);
        decimal remainingQty = source.Quantity;
        decimal remainingCost = source.TotalCost;

        for (var i = 0; i < ordered.Count; i++)
        {
            var split = ordered[i];
            bool isLast = i == ordered.Count - 1;

            var qty = isLast ? remainingQty : Math.Round(source.Quantity * split.RatioPercent / 100m, 4);
            var cost = isLast ? remainingCost : Math.Round(source.TotalCost * split.RatioPercent / 100m, 2);

            remainingQty -= qty;
            remainingCost -= cost;

            activities.Add(new Activity
            {
                ActivityId = activityIdGenerator(),
                ActivityName = split.Name,
                ActivityType = split.ActivityType,
                BOQCode = source.BOQCode,
                Unit = source.Unit,
                Quantity = qty,
                Cost = cost,
                CostWeight = split.RatioPercent / 100m,
                Source = "Split"
            });
        }

        return activities;
    }
}
