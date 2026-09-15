using PlanFlow.Core.Common;

namespace PlanFlow.Core.Activities;

/// <summary>Hands out sequential Activity IDs and guarantees no duplicates are ever produced or accepted.</summary>
public sealed class ActivityIdGenerator
{
    private readonly HashSet<string> _used = new(StringComparer.OrdinalIgnoreCase);
    private readonly string _prefix;
    private int _counter;

    public ActivityIdGenerator(string prefix = "A", IEnumerable<string>? existingIds = null)
    {
        _prefix = prefix;
        if (existingIds is not null)
            foreach (var id in existingIds) _used.Add(id);
    }

    public string Next()
    {
        string candidate;
        do
        {
            _counter += 10;
            candidate = $"{_prefix}{_counter:D4}";
        } while (!_used.Add(candidate));

        return candidate;
    }

    /// <summary>Call before export: fails if the given set contains a duplicate Activity ID.</summary>
    public static ValidationResult ValidateUnique(IReadOnlyList<string> activityIds)
    {
        var result = new ValidationResult();
        var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (var id in activityIds)
        {
            if (!seen.Add(id))
                result.Add(ValidationIssue.Error("ACTIVITY_ID_DUPLICATE", $"Activity ID '{id}' is duplicated."));
        }
        return result;
    }
}
