using PlanFlow.Core.Domain;

namespace PlanFlow.Core.Manpower;

/// <summary>Creates manpower/material/cash resource dictionary rows and assigns crew sizing to activities.</summary>
public static class ResourceFactory
{
    private static readonly string[] StandardTrades =
        { "Helper", "Carpenter", "Steel Fixer", "Mason", "Operator", "Rigger", "Technician" };

    public static IReadOnlyList<Resource> CreateStandardManpowerResources(decimal defaultRate = 0)
    {
        return StandardTrades.Select(trade => new Resource
        {
            ResourceCode = $"LAB-{trade.Replace(" ", "").ToUpperInvariant()}",
            ResourceName = trade,
            ResourceType = ResourceType.Labor,
            Unit = "Hour",
            Rate = defaultRate,
            Trade = trade
        }).ToList();
    }

    public static Resource CreateMaterialResource(string code, string name, string unit, decimal rate) => new()
    {
        ResourceCode = code,
        ResourceName = name,
        ResourceType = ResourceType.Material,
        Unit = unit,
        Rate = rate
    };

    public static Resource CreateCashResource(string currency) => new()
    {
        ResourceCode = $"CASH-{currency.ToUpperInvariant()}",
        ResourceName = $"Cash ({currency})",
        ResourceType = ResourceType.Cash,
        Unit = currency,
        Rate = 1m
    };
}
