using PlanFlow.Core.Domain;

namespace PlanFlow.Core.Manpower;

/// <summary>Country/region-adjustable productivity rate for one trade.</summary>
public sealed class ProductivityEntry
{
    public string ActivityGroup { get; set; } = string.Empty;
    public string Trade { get; set; } = string.Empty;
    public decimal ProductivityRate { get; set; } // units per crew per day
    public int NumberOfCrews { get; set; } = 1;
}

/// <summary>
/// Computes activity duration by Method R (quantity / productivity / crews) or
/// accepts a user-entered duration under Method D, per the spec.
/// </summary>
public static class DurationCalculator
{
    public static decimal CalculateByProductivity(decimal quantity, decimal productivityRate, int numberOfCrews)
    {
        if (productivityRate <= 0) throw new ArgumentOutOfRangeException(nameof(productivityRate), "Productivity rate must be positive.");
        if (numberOfCrews <= 0) throw new ArgumentOutOfRangeException(nameof(numberOfCrews), "Number of crews must be positive.");

        return Math.Ceiling(quantity / productivityRate / numberOfCrews);
    }

    public static decimal CalculateDirect(decimal userEnteredDuration) => userEnteredDuration;

    public static void Apply(Activity activity, ProductivityEntry? productivity)
    {
        if (activity.DurationMethod == DurationMethod.Direct)
        {
            activity.Duration = CalculateDirect(activity.Duration);
        }
        else
        {
            if (productivity is null)
                throw new InvalidOperationException($"No productivity entry found for activity '{activity.ActivityId}'.");

            activity.Duration = CalculateByProductivity(activity.Quantity, productivity.ProductivityRate, productivity.NumberOfCrews);
        }

        activity.RemainingDuration = activity.Duration;
    }
}
