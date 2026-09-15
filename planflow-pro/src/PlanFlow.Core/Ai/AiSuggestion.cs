namespace PlanFlow.Core.Ai;

/// <summary>The fixed JSON-shaped contract every AI provider must return, per the spec.</summary>
public sealed class AiSuggestion
{
    public string SourceId { get; set; } = string.Empty;
    public string Suggestion { get; set; } = string.Empty;
    public string? Discipline { get; set; }
    public string? LocationFilter { get; set; }
    public string? WbsCode { get; set; }
    public double Confidence { get; set; }
    public string? Evidence { get; set; }
    public bool NeedsReview { get; set; } = true;
}
