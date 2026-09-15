using PlanFlow.Core.Domain;

namespace PlanFlow.Core.Ai;

/// <summary>
/// Offline, keyword/rules-based provider. Used for the MVP and as the guaranteed
/// fallback when a remote provider is unreachable. Never calls out to the network.
/// </summary>
public sealed class MockAiProvider : IAiProvider
{
    public string Name => "Mock";

    private static readonly (string Keyword, string Discipline, string ActivityName)[] Rules =
    {
        ("concrete", "Structural", "Concrete Pouring"),
        ("footing", "Structural", "RC Footing"),
        ("reinforcement", "Structural", "Reinforcement Fixing"),
        ("formwork", "Structural", "Formwork"),
        ("slab", "Structural", "RC Slab"),
        ("column", "Structural", "RC Column"),
        ("block", "Architectural", "Block Work"),
        ("plaster", "Architectural", "Plastering"),
        ("paint", "Architectural", "Painting"),
        ("tile", "Architectural", "Tiling"),
        ("waterproof", "Architectural", "Waterproofing"),
        ("cable", "Electrical", "Cabling"),
        ("panel", "Electrical", "Panel Installation"),
        ("light", "Electrical", "Lighting Installation"),
        ("pipe", "Mechanical", "Pipe Installation"),
        ("duct", "Mechanical", "Ductwork Installation"),
        ("pump", "Mechanical", "Pump Installation"),
    };

    public IReadOnlyList<AiSuggestion> SuggestActivities(IReadOnlyList<BoqItem> boqItems)
    {
        var results = new List<AiSuggestion>(boqItems.Count);

        foreach (var item in boqItems)
        {
            var haystack = $"{item.Description} {item.LongDescription}".ToLowerInvariant();
            var match = Rules.FirstOrDefault(r => haystack.Contains(r.Keyword));

            var discipline = match.Discipline ?? item.Discipline ?? "General";
            var activityName = match.ActivityName is null
                ? item.Description
                : match.ActivityName;

            results.Add(new AiSuggestion
            {
                SourceId = item.BOQCode,
                Suggestion = activityName,
                Discipline = discipline,
                LocationFilter = item.LocationFilter,
                WbsCode = item.WBSCode,
                Confidence = match.Keyword is null ? 0.3 : 0.75,
                Evidence = match.Keyword is null ? "no keyword match; using BOQ description as-is" : $"matched keyword '{match.Keyword}'",
                NeedsReview = true
            });
        }

        return results;
    }
}
