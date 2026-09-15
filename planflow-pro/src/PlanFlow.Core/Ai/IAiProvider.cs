using PlanFlow.Core.Domain;

namespace PlanFlow.Core.Ai;

/// <summary>
/// Abstraction so the rest of PlanFlow never talks to one AI vendor directly.
/// MockAIProvider (rules-based, offline) backs the MVP; LocalAIProvider and
/// RemoteAIProvider (REST) can be swapped in later without touching callers.
/// </summary>
public interface IAiProvider
{
    string Name { get; }

    /// <summary>Suggests a construction activity for each BOQ line. Never throws on connectivity
    /// failure — callers must be able to keep working manually with Mock/Rules.</summary>
    IReadOnlyList<AiSuggestion> SuggestActivities(IReadOnlyList<BoqItem> boqItems);
}
