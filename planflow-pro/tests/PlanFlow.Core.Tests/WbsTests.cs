using PlanFlow.Core.Domain;
using PlanFlow.Core.Wbs;
using Xunit;

namespace PlanFlow.Core.Tests;

public class WbsTests
{
    [Fact]
    public void BuildTree_ValidHierarchy_ProducesRootsAndChildren()
    {
        var nodes = new List<WbsNode>
        {
            new() { WBSCode = "P", WBSName = "Project", ParentCode = null, Level = 0 },
            new() { WBSCode = "P.1", WBSName = "Building A", ParentCode = "P", Level = 1 },
            new() { WBSCode = "P.1.1", WBSName = "Structural", ParentCode = "P.1", Level = 2 },
        };

        var builder = new WbsTreeBuilder();
        var validation = builder.Validate(nodes);
        Assert.True(validation.IsValid);

        var tree = builder.BuildTree(nodes);
        Assert.Single(tree);
        Assert.Equal("P", tree[0].Node.WBSCode);
        Assert.Single(tree[0].Children);
        Assert.Single(tree[0].Children[0].Children);
    }

    [Fact]
    public void Validate_MissingParent_IsDetected()
    {
        var nodes = new List<WbsNode>
        {
            new() { WBSCode = "P", WBSName = "Project", ParentCode = null },
            new() { WBSCode = "P.1", WBSName = "Building A", ParentCode = "P.NOPE" },
        };

        var result = new WbsTreeBuilder().Validate(nodes);

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, e => e.Code == "WBS_PARENT_MISSING");
    }

    [Fact]
    public void Validate_Cycle_IsDetected()
    {
        var nodes = new List<WbsNode>
        {
            new() { WBSCode = "A", ParentCode = "B" },
            new() { WBSCode = "B", ParentCode = "A" },
        };

        var result = new WbsTreeBuilder().Validate(nodes);

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, e => e.Code == "WBS_CYCLE");
    }

    [Fact]
    public void Validate_NoRoot_IsDetected()
    {
        var nodes = new List<WbsNode>
        {
            new() { WBSCode = "A", ParentCode = "B" },
            new() { WBSCode = "B", ParentCode = "A" },
        };

        var result = new WbsTreeBuilder().Validate(nodes);

        Assert.Contains(result.Errors, e => e.Code == "WBS_NO_ROOT");
    }
}
