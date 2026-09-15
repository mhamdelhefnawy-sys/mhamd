using PlanFlow.Core.Domain;

namespace PlanFlow.Core.Common;

/// <summary>
/// Guards "لا تكرر الكميات والتكاليف عند تقسيم البنود": whatever transformation runs
/// (split, mapping, generation), total quantity and cost must round-trip.
/// </summary>
public static class CostConservation
{
    private const decimal Tolerance = 0.01m;

    public static ValidationResult ValidateCost(decimal originalTotal, IEnumerable<decimal> resultingCosts)
    {
        var result = new ValidationResult();
        var sum = resultingCosts.Sum();
        if (Math.Abs(sum - originalTotal) > Tolerance)
        {
            result.Add(ValidationIssue.Error("COST_NOT_CONSERVED",
                $"Resulting costs sum to {sum} but the original total was {originalTotal}."));
        }
        return result;
    }

    public static ValidationResult ValidateQuantity(decimal originalQuantity, IEnumerable<decimal> resultingQuantities)
    {
        var result = new ValidationResult();
        var sum = resultingQuantities.Sum();
        if (Math.Abs(sum - originalQuantity) > 0.0001m)
        {
            result.Add(ValidationIssue.Error("QUANTITY_NOT_CONSERVED",
                $"Resulting quantities sum to {sum} but the original quantity was {originalQuantity}."));
        }
        return result;
    }

    public static ValidationResult ValidateBoqToActivityCost(IReadOnlyList<BoqItem> boqItems, IReadOnlyList<Activity> activities) =>
        ValidateCost(boqItems.Sum(b => b.TotalCost), activities.Select(a => a.Cost));
}
