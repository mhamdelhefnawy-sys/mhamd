using PlanFlow.Core.Domain;

namespace PlanFlow.Core.Engineering;

/// <summary>One row of Engineering_Names: parameters for one discipline's submittal/approval chain.</summary>
public sealed class EngineeringDefinition
{
    public string Discipline { get; set; } = string.Empty;
    public decimal SubmissionDuration { get; set; }
    public decimal ApprovalDuration { get; set; }
    public string? LocationFilter { get; set; }
    public string? FloorFilter { get; set; }
    public string? WBSCode { get; set; }
}

/// <summary>
/// Generates the "Engineering Submittal -> Engineering Approval -> Construction Activity"
/// chain ahead of each matching construction activity.
/// </summary>
public sealed class EngineeringChainResult
{
    public IReadOnlyList<Activity> Activities { get; init; } = Array.Empty<Activity>();
    public IReadOnlyList<Relationship> Relationships { get; init; } = Array.Empty<Relationship>();
}

public sealed class EngineeringChainGenerator
{
    public EngineeringChainResult Generate(
        IReadOnlyList<Activity> constructionActivities,
        IReadOnlyList<EngineeringDefinition> definitions,
        Func<string> activityIdGenerator,
        Func<string> relationshipIdGenerator)
    {
        var byDiscipline = definitions.ToDictionary(d => d.Discipline, StringComparer.OrdinalIgnoreCase);
        var generated = new List<Activity>();
        var relationships = new List<Relationship>();

        foreach (var activity in constructionActivities)
        {
            if (activity.Discipline is null || !byDiscipline.TryGetValue(activity.Discipline, out var def))
                continue;

            if (def.LocationFilter is not null && activity.LocationCode is not null &&
                !string.Equals(activity.LocationCode, def.LocationFilter, StringComparison.OrdinalIgnoreCase))
                continue;

            var submittal = new Activity
            {
                ActivityId = activityIdGenerator(),
                ActivityName = $"Engineering Submittal - {activity.ActivityName}",
                ActivityType = "Engineering",
                Discipline = activity.Discipline,
                WBSCode = def.WBSCode ?? activity.WBSCode,
                LocationCode = activity.LocationCode,
                Duration = def.SubmissionDuration,
                DurationMethod = DurationMethod.Direct,
                Source = "EngineeringChain"
            };
            var approval = new Activity
            {
                ActivityId = activityIdGenerator(),
                ActivityName = $"Engineering Approval - {activity.ActivityName}",
                ActivityType = "Engineering",
                Discipline = activity.Discipline,
                WBSCode = def.WBSCode ?? activity.WBSCode,
                LocationCode = activity.LocationCode,
                Duration = def.ApprovalDuration,
                DurationMethod = DurationMethod.Direct,
                Source = "EngineeringChain"
            };

            generated.Add(submittal);
            generated.Add(approval);

            relationships.Add(new Relationship
            {
                RelationshipId = relationshipIdGenerator(),
                PredecessorId = submittal.ActivityId,
                SuccessorId = approval.ActivityId,
                RelationshipType = RelationshipType.FS,
                Source = "EngineeringChain"
            });
            relationships.Add(new Relationship
            {
                RelationshipId = relationshipIdGenerator(),
                PredecessorId = approval.ActivityId,
                SuccessorId = activity.ActivityId,
                RelationshipType = RelationshipType.FS,
                Source = "EngineeringChain"
            });
        }

        return new EngineeringChainResult { Activities = generated, Relationships = relationships };
    }
}
