using PlanFlow.Core.Common;
using PlanFlow.Core.Domain;

namespace PlanFlow.Core.Locations;

/// <summary>
/// Holds the set of location combinations a user has explicitly registered
/// (Building + Floor + Area + Zone + Trade + WorkFront), and rejects
/// generation against anything not registered — "امنع التركيبات غير الصالحة".
/// </summary>
public sealed class LocationBuilder
{
    private readonly Dictionary<string, LocationCombination> _combinations = new(StringComparer.OrdinalIgnoreCase);

    public IReadOnlyCollection<LocationCombination> Combinations => _combinations.Values;

    public ValidationResult Add(LocationCombination combination)
    {
        var result = new ValidationResult();
        if (string.IsNullOrWhiteSpace(combination.LocationCode))
        {
            result.Add(ValidationIssue.Error("LOCATION_EMPTY", "A location combination needs at least one non-empty segment."));
            return result;
        }

        if (_combinations.ContainsKey(combination.LocationCode))
        {
            result.Add(ValidationIssue.Warning("LOCATION_DUPLICATE", $"Location '{combination.LocationCode}' is already registered."));
            return result;
        }

        _combinations[combination.LocationCode] = combination;
        return result;
    }

    public bool IsValidCombination(string locationCode) => _combinations.ContainsKey(locationCode);
}
