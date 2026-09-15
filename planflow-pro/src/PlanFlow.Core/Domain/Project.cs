namespace PlanFlow.Core.Domain;

public enum ActivityDetailLevel
{
    HighLevel,
    Standard,
    Detailed
}

public enum WbsSource
{
    New,
    XerReference
}

/// <summary>Project-level settings captured by the Project Setup wizard (Project_Setup sheet).</summary>
public sealed class Project
{
    public string ProjectId { get; set; } = string.Empty;
    public string ProjectName { get; set; } = string.Empty;
    public string Client { get; set; } = string.Empty;
    public string Contractor { get; set; } = string.Empty;
    public string Country { get; set; } = string.Empty;
    public string Currency { get; set; } = string.Empty;
    public DateTime StartDate { get; set; }
    public DateTime ContractFinishDate { get; set; }
    public DateTime DataDate { get; set; }
    public string DefaultCalendarId { get; set; } = string.Empty;
    public int Version { get; set; } = 1;
    public ActivityDetailLevel DetailLevel { get; set; } = ActivityDetailLevel.Standard;
    public WbsSource WbsSource { get; set; } = WbsSource.New;
}
