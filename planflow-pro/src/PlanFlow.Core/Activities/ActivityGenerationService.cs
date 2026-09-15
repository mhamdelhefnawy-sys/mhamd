using PlanFlow.Core.Ai;
using PlanFlow.Core.Common;
using PlanFlow.Core.Domain;

namespace PlanFlow.Core.Activities;

public sealed class ActivityReviewRow
{
    public string BOQCode { get; set; } = string.Empty;
    public string ActivityName { get; set; } = string.Empty;
    public string? Discipline { get; set; }
    public string? Evidence { get; set; }
    public string? SuggestedActivityGroup { get; set; }
    public double Confidence { get; set; }
    public ReviewStatus ReviewStatus { get; set; } = ReviewStatus.Suggested;
}

/// <summary>
/// "Generate Activities": runs the AI provider over the BOQ and produces suggestions
/// for human review (AI_Review). Nothing here is written to the construction plan
/// automatically — see <see cref="ApplyReviewedPlan"/>.
/// </summary>
public sealed class ActivityGenerationService
{
    private readonly IAiProvider _provider;

    public ActivityGenerationService(IAiProvider provider) => _provider = provider;

    public IReadOnlyList<ActivityReviewRow> GenerateActivities(IReadOnlyList<BoqItem> boqItems)
    {
        var suggestions = _provider.SuggestActivities(boqItems);
        return suggestions.Select(s => new ActivityReviewRow
        {
            BOQCode = s.SourceId,
            ActivityName = s.Suggestion,
            Discipline = s.Discipline,
            Evidence = s.Evidence,
            SuggestedActivityGroup = s.Discipline,
            Confidence = s.Confidence,
            ReviewStatus = ReviewStatus.Suggested
        }).ToList();
    }

    /// <summary>
    /// Moves rows the user marked Approved (or Manual) into Construction_Activity_Plan.
    /// Rows still Suggested/Reviewed/Rejected are left behind untouched.
    /// </summary>
    public IReadOnlyList<Activity> ApplyReviewedPlan(
        IReadOnlyList<ActivityReviewRow> reviewRows,
        IReadOnlyDictionary<string, BoqItem> boqByCode,
        Func<string> activityIdGenerator)
    {
        var plan = new List<Activity>();

        foreach (var row in reviewRows)
        {
            if (row.ReviewStatus is not (ReviewStatus.Approved or ReviewStatus.Manual))
                continue;

            boqByCode.TryGetValue(row.BOQCode, out var boq);

            plan.Add(new Activity
            {
                ActivityId = activityIdGenerator(),
                ActivityName = row.ActivityName,
                Discipline = row.Discipline,
                BOQCode = row.BOQCode,
                ActivityGroup = row.SuggestedActivityGroup,
                Unit = boq?.Unit,
                Quantity = boq?.Quantity ?? 0,
                Cost = boq?.TotalCost ?? 0,
                Source = "AI",
                ReviewStatus = row.ReviewStatus
            });
        }

        return plan;
    }
}
