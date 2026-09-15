using PlanFlow.Core.Common;
using PlanFlow.Core.Domain;

namespace PlanFlow.Core.Logic;

/// <summary>Defines the engineering-sequence order for construction activities sharing a location,
/// e.g. Structural -> Architectural -> MEP -> Finishes.</summary>
public sealed class DisciplineSequenceRule
{
    public string ActivityGroup { get; set; } = string.Empty;
    public int Sequence { get; set; }
}

/// <summary>
/// Suggests FS relationships in the order the spec lays out (§15 Logic):
/// 1. Engineering/Procurement chains are generated separately (already produce their own FS links).
/// 2. Activities within the same location, ordered by discipline/activity-group sequence.
/// 3. Milestones at the start and end of the plan.
/// All suggestions start as ReviewStatus.Suggested and land in Logic before a user
/// promotes them into Logic_Generated.
/// </summary>
public sealed class LogicSuggestionService
{
    public sealed class SuggestionResult
    {
        public IReadOnlyList<Relationship> Relationships { get; init; } = Array.Empty<Relationship>();
        public ValidationResult Validation { get; init; } = new();
    }

    public SuggestionResult SuggestWithinLocationSequence(
        IReadOnlyList<Activity> activities,
        IReadOnlyList<DisciplineSequenceRule> sequenceRules,
        Func<string> relationshipIdGenerator)
    {
        var sequenceByGroup = sequenceRules.ToDictionary(r => r.ActivityGroup, r => r.Sequence, StringComparer.OrdinalIgnoreCase);
        var relationships = new List<Relationship>();

        var byLocation = activities
            .Where(a => !string.IsNullOrWhiteSpace(a.LocationCode))
            .GroupBy(a => a.LocationCode!, StringComparer.OrdinalIgnoreCase);

        foreach (var group in byLocation)
        {
            var ordered = group
                .OrderBy(a => a.ActivityGroup is not null && sequenceByGroup.TryGetValue(a.ActivityGroup, out var seq) ? seq : int.MaxValue)
                .ToList();

            for (var i = 0; i < ordered.Count - 1; i++)
            {
                relationships.Add(new Relationship
                {
                    RelationshipId = relationshipIdGenerator(),
                    PredecessorId = ordered[i].ActivityId,
                    SuccessorId = ordered[i + 1].ActivityId,
                    RelationshipType = RelationshipType.FS,
                    Source = "LogicSuggestion",
                    ReviewStatus = ReviewStatus.Suggested
                });
            }
        }

        var validation = RelationshipValidation.Validate(activities.Select(a => a.ActivityId), relationships);
        return new SuggestionResult { Relationships = relationships, Validation = validation };
    }

    /// <summary>Links a start milestone to every activity with no predecessor, and every activity
    /// with no successor to a finish milestone.</summary>
    public IReadOnlyList<Relationship> SuggestMilestoneLinks(
        IReadOnlyList<Activity> activities,
        IReadOnlyList<Relationship> existingRelationships,
        string startMilestoneId,
        string finishMilestoneId,
        Func<string> relationshipIdGenerator)
    {
        var hasPredecessor = new HashSet<string>(existingRelationships.Select(r => r.SuccessorId), StringComparer.OrdinalIgnoreCase);
        var hasSuccessor = new HashSet<string>(existingRelationships.Select(r => r.PredecessorId), StringComparer.OrdinalIgnoreCase);

        var relationships = new List<Relationship>();

        foreach (var activity in activities)
        {
            if (string.Equals(activity.ActivityId, startMilestoneId, StringComparison.OrdinalIgnoreCase) ||
                string.Equals(activity.ActivityId, finishMilestoneId, StringComparison.OrdinalIgnoreCase))
                continue;

            if (!hasPredecessor.Contains(activity.ActivityId))
            {
                relationships.Add(new Relationship
                {
                    RelationshipId = relationshipIdGenerator(),
                    PredecessorId = startMilestoneId,
                    SuccessorId = activity.ActivityId,
                    RelationshipType = RelationshipType.FS,
                    Source = "LogicSuggestion",
                    ReviewStatus = ReviewStatus.Suggested
                });
            }

            if (!hasSuccessor.Contains(activity.ActivityId))
            {
                relationships.Add(new Relationship
                {
                    RelationshipId = relationshipIdGenerator(),
                    PredecessorId = activity.ActivityId,
                    SuccessorId = finishMilestoneId,
                    RelationshipType = RelationshipType.FS,
                    Source = "LogicSuggestion",
                    ReviewStatus = ReviewStatus.Suggested
                });
            }
        }

        return relationships;
    }
}
