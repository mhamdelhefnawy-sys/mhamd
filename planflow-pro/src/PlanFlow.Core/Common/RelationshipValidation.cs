using PlanFlow.Core.Domain;

namespace PlanFlow.Core.Common;

/// <summary>
/// Shared relationship-network checks used by both XER export validation and the
/// Logic suggestion engine: self-links, duplicate relationships, circular logic,
/// and predecessors/successors that don't point at a real activity.
/// </summary>
public static class RelationshipValidation
{
    public static ValidationResult Validate(IEnumerable<string> activityIds, IReadOnlyList<Relationship> relationships)
    {
        var result = new ValidationResult();
        var ids = new HashSet<string>(activityIds, StringComparer.OrdinalIgnoreCase);

        foreach (var rel in relationships)
        {
            if (!ids.Contains(rel.PredecessorId))
                result.Add(ValidationIssue.Error("REL_MISSING_PRED", $"Relationship '{rel.RelationshipId}' predecessor '{rel.PredecessorId}' does not exist."));
            if (!ids.Contains(rel.SuccessorId))
                result.Add(ValidationIssue.Error("REL_MISSING_SUCC", $"Relationship '{rel.RelationshipId}' successor '{rel.SuccessorId}' does not exist."));
            if (string.Equals(rel.PredecessorId, rel.SuccessorId, StringComparison.OrdinalIgnoreCase))
                result.Add(ValidationIssue.Error("REL_SELF_LINK", $"Relationship '{rel.RelationshipId}' links activity '{rel.PredecessorId}' to itself."));
        }

        var duplicates = relationships
            .GroupBy(r => (r.PredecessorId.ToUpperInvariant(), r.SuccessorId.ToUpperInvariant(), r.RelationshipType))
            .Where(g => g.Count() > 1);
        foreach (var group in duplicates)
            result.Add(ValidationIssue.Error("REL_DUPLICATE", $"Duplicate relationship {group.Key.Item1} -> {group.Key.Item2} ({group.Key.RelationshipType})."));

        if (HasCircularLogic(ids, relationships))
            result.Add(ValidationIssue.Error("REL_CIRCULAR", "The relationship network contains a circular logic loop."));

        return result;
    }

    public static bool HasCircularLogic(IEnumerable<string> activityIds, IReadOnlyList<Relationship> relationships)
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
