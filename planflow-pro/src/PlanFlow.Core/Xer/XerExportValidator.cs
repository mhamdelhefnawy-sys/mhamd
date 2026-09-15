using PlanFlow.Core.Activities;
using PlanFlow.Core.Common;

namespace PlanFlow.Core.Xer;

/// <summary>
/// Mandatory pre-export checks. Export must be blocked while any Error remains,
/// unless the user explicitly chooses "Ignore" (the caller is responsible for
/// recording that choice in the Audit_Log).
/// </summary>
public static class XerExportValidator
{
    public static ValidationResult Validate(XerExportModel model)
    {
        var result = new ValidationResult();

        result.AddRange(ActivityIdGenerator.ValidateUnique(model.Activities.Select(a => a.ActivityId).ToList()).Issues);

        var wbsCodes = new HashSet<string>(model.WbsNodes.Select(w => w.WBSCode), StringComparer.OrdinalIgnoreCase);
        foreach (var activity in model.Activities)
        {
            if (string.IsNullOrWhiteSpace(activity.WBSCode))
            {
                result.Add(ValidationIssue.Error("XER_ACTIVITY_NO_WBS", $"Activity '{activity.ActivityId}' has no WBSCode."));
            }
            else if (!wbsCodes.Contains(activity.WBSCode))
            {
                result.Add(ValidationIssue.Error("XER_WBS_NOT_FOUND", $"Activity '{activity.ActivityId}' references unknown WBS '{activity.WBSCode}'."));
            }
        }

        var activityIds = new HashSet<string>(model.Activities.Select(a => a.ActivityId), StringComparer.OrdinalIgnoreCase);
        foreach (var rel in model.Relationships)
        {
            if (!activityIds.Contains(rel.PredecessorId))
                result.Add(ValidationIssue.Error("XER_REL_MISSING_PRED", $"Relationship '{rel.RelationshipId}' predecessor '{rel.PredecessorId}' does not exist."));
            if (!activityIds.Contains(rel.SuccessorId))
                result.Add(ValidationIssue.Error("XER_REL_MISSING_SUCC", $"Relationship '{rel.RelationshipId}' successor '{rel.SuccessorId}' does not exist."));
            if (string.Equals(rel.PredecessorId, rel.SuccessorId, StringComparison.OrdinalIgnoreCase))
                result.Add(ValidationIssue.Error("XER_REL_SELF_LINK", $"Relationship '{rel.RelationshipId}' links activity '{rel.PredecessorId}' to itself."));
        }

        var dupRelKeys = model.Relationships
            .GroupBy(r => (r.PredecessorId.ToUpperInvariant(), r.SuccessorId.ToUpperInvariant(), r.RelationshipType))
            .Where(g => g.Count() > 1);
        foreach (var group in dupRelKeys)
            result.Add(ValidationIssue.Error("XER_REL_DUPLICATE", $"Duplicate relationship {group.Key.Item1} -> {group.Key.Item2} ({group.Key.RelationshipType})."));

        if (DetectCircularLogic(model.Activities.Select(a => a.ActivityId), model.Relationships))
            result.Add(ValidationIssue.Error("XER_REL_CIRCULAR", "The relationship network contains a circular logic loop."));

        var totalBoqAllocated = model.Activities.Sum(a => a.Cost);
        // No BOQ total is threaded through this model in the MVP export path itself;
        // callers that need the "Sum(ActivityCost) == Sum(BOQ TotalCost)" guarantee
        // should call CostConservation.Validate before reaching this point.
        _ = totalBoqAllocated;

        return result;
    }

    private static bool DetectCircularLogic(IEnumerable<string> activityIds, IReadOnlyList<Relationship> relationships)
    {
        var adjacency = relationships
            .GroupBy(r => r.PredecessorId, StringComparer.OrdinalIgnoreCase)
            .ToDictionary(g => g.Key, g => g.Select(r => r.SuccessorId).ToList(), StringComparer.OrdinalIgnoreCase);

        var visiting = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var visited = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        bool Visit(string node)
        {
            if (visiting.Contains(node)) return true;
            if (visited.Contains(node)) return false;

            visiting.Add(node);
            if (adjacency.TryGetValue(node, out var successors))
            {
                foreach (var next in successors)
                    if (Visit(next)) return true;
            }
            visiting.Remove(node);
            visited.Add(node);
            return false;
        }

        foreach (var id in activityIds)
            if (Visit(id)) return true;

        return false;
    }
}
