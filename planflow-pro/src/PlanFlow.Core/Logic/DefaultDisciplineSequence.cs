namespace PlanFlow.Core.Logic;

/// <summary>A reasonable out-of-the-box construction sequence, used when the project
/// hasn't defined its own Discipline Sequence rules yet. Fully overridable — never
/// hard-coded into the ribbon, only offered as a starting default.</summary>
public static class DefaultDisciplineSequence
{
    public static IReadOnlyList<DisciplineSequenceRule> Rules { get; } = new List<DisciplineSequenceRule>
    {
        new() { ActivityGroup = "Structural", Sequence = 1 },
        new() { ActivityGroup = "Architectural", Sequence = 2 },
        new() { ActivityGroup = "Mechanical", Sequence = 3 },
        new() { ActivityGroup = "Electrical", Sequence = 4 },
        new() { ActivityGroup = "Finishing", Sequence = 5 },
    };
}
