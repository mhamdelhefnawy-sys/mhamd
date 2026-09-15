using PlanFlow.Core.Common;
using PlanFlow.Core.Domain;

namespace PlanFlow.Core.Wbs;

public sealed class WbsTreeNode
{
    public WbsNode Node { get; }
    public WbsTreeNode? Parent { get; internal set; }
    public List<WbsTreeNode> Children { get; } = new();

    public WbsTreeNode(WbsNode node) => Node = node;
}

/// <summary>
/// Builds and validates the WBS hierarchy: no missing parent, no duplicate WBSCode,
/// no cycles, and at least one valid root (ParentCode null/empty).
/// </summary>
public sealed class WbsTreeBuilder
{
    public ValidationResult Validate(IReadOnlyList<WbsNode> nodes)
    {
        var result = new ValidationResult();
        var byCode = new Dictionary<string, WbsNode>(StringComparer.OrdinalIgnoreCase);

        foreach (var node in nodes)
        {
            if (string.IsNullOrWhiteSpace(node.WBSCode))
            {
                result.Add(ValidationIssue.Error("WBS_CODE_EMPTY", "WBSCode is required."));
                continue;
            }

            if (byCode.ContainsKey(node.WBSCode))
            {
                result.Add(ValidationIssue.Error("WBS_CODE_DUPLICATE", $"WBSCode '{node.WBSCode}' is duplicated."));
            }
            else
            {
                byCode.Add(node.WBSCode, node);
            }
        }

        foreach (var node in nodes)
        {
            if (!string.IsNullOrWhiteSpace(node.ParentCode) && !byCode.ContainsKey(node.ParentCode))
            {
                result.Add(ValidationIssue.Error("WBS_PARENT_MISSING",
                    $"WBS '{node.WBSCode}' references parent '{node.ParentCode}' which does not exist."));
            }
        }

        if (!nodes.Any(n => string.IsNullOrWhiteSpace(n.ParentCode)))
        {
            result.Add(ValidationIssue.Error("WBS_NO_ROOT", "The WBS tree has no root node (a node with an empty ParentCode)."));
        }

        foreach (var node in nodes)
        {
            if (HasCycle(node, byCode))
            {
                result.Add(ValidationIssue.Error("WBS_CYCLE", $"WBS '{node.WBSCode}' is part of a parent cycle."));
            }
        }

        return result;
    }

    private static bool HasCycle(WbsNode start, IReadOnlyDictionary<string, WbsNode> byCode)
    {
        var visited = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var current = start;
        while (current is not null && !string.IsNullOrWhiteSpace(current.ParentCode))
        {
            if (!visited.Add(current.WBSCode)) return true;
            if (!byCode.TryGetValue(current.ParentCode, out var parent)) break;
            if (string.Equals(parent.WBSCode, start.WBSCode, StringComparison.OrdinalIgnoreCase)) return true;
            current = parent;
        }
        return false;
    }

    /// <summary>Builds the tree assuming <see cref="Validate"/> reported no errors.</summary>
    public IReadOnlyList<WbsTreeNode> BuildTree(IReadOnlyList<WbsNode> nodes)
    {
        var treeNodes = nodes.ToDictionary(n => n.WBSCode, n => new WbsTreeNode(n), StringComparer.OrdinalIgnoreCase);
        var roots = new List<WbsTreeNode>();

        foreach (var node in nodes)
        {
            var treeNode = treeNodes[node.WBSCode];
            if (string.IsNullOrWhiteSpace(node.ParentCode))
            {
                roots.Add(treeNode);
            }
            else if (treeNodes.TryGetValue(node.ParentCode, out var parent))
            {
                treeNode.Parent = parent;
                parent.Children.Add(treeNode);
            }
        }

        foreach (var t in treeNodes.Values)
            t.Children.Sort((a, b) => a.Node.Sequence.CompareTo(b.Node.Sequence));

        return roots.OrderBy(r => r.Node.Sequence).ToList();
    }
}
