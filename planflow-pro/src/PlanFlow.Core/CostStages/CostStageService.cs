using PlanFlow.Core.Common;
using PlanFlow.Core.Domain;

namespace PlanFlow.Core.CostStages;

/// <summary>
/// Validates that a set of cost stages sums to 100% and distributes each
/// activity's cost across them without changing the project's total cost
/// (spec: "لا تغيّر إجمالي تكلفة المشروع").
/// </summary>
public sealed class CostStageService
{
    private const decimal Tolerance = 0.01m;

    public ValidationResult ValidatePercentages(IReadOnlyList<CostStage> stages)
    {
        var result = new ValidationResult();
        var total = stages.Sum(s => s.Percentage);
        if (Math.Abs(total - 100m) > Tolerance)
        {
            result.Add(ValidationIssue.Error("COST_STAGE_NOT_100",
                $"Cost stage percentages must sum to 100%, got {total}%."));
        }
        return result;
    }

    public IReadOnlyList<ActivityCostStageAllocation> Apply(IReadOnlyList<Activity> activities, IReadOnlyList<CostStage> stages)
    {
        var validation = ValidatePercentages(stages);
        if (!validation.IsValid)
            throw new InvalidOperationException(string.Join("; ", validation.Errors.Select(e => e.Message)));

        var ordered = stages.ToList();
        var allocations = new List<ActivityCostStageAllocation>();

        foreach (var activity in activities)
        {
            decimal remaining = activity.Cost;
            for (var i = 0; i < ordered.Count; i++)
            {
                bool isLast = i == ordered.Count - 1;
                var cost = isLast ? remaining : Math.Round(activity.Cost * ordered[i].Percentage / 100m, 2);
                remaining -= cost;

                allocations.Add(new ActivityCostStageAllocation
                {
                    ActivityId = activity.ActivityId,
                    StageName = ordered[i].StageName,
                    Cost = cost
                });
            }
        }

        return allocations;
    }
}
