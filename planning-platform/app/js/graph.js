/*
 * Small dependency-free DAG helper for M08: topological levels (for a layered network
 * layout) and cycle detection via Kahn's algorithm — a node still has indegree > 0
 * after the algorithm drains everything it can is, by definition, part of a cycle.
 */
(function (global) {
  "use strict";

  function computeGraph(activityIds, relationships) {
    var adj = {}, indegree = {};
    activityIds.forEach(function (id) { adj[id] = []; indegree[id] = 0; });
    relationships.forEach(function (r) {
      if (!(r.predecessorActivityId in adj) || !(r.successorActivityId in adj)) return;
      adj[r.predecessorActivityId].push(r.successorActivityId);
      indegree[r.successorActivityId]++;
    });

    var levels = {};
    var q = activityIds.filter(function (id) { return indegree[id] === 0; });
    q.forEach(function (id) { levels[id] = 0; });
    var queue = q.slice();
    var remaining = Object.assign({}, indegree);
    while (queue.length) {
      var id = queue.shift();
      adj[id].forEach(function (next) {
        remaining[next]--;
        levels[next] = Math.max(levels[next] || 0, (levels[id] || 0) + 1);
        if (remaining[next] === 0) queue.push(next);
      });
    }
    var cycleIds = activityIds.filter(function (id) { return remaining[id] > 0; });
    var cycleSet = new Set(cycleIds);

    var maxLevel = 0;
    activityIds.forEach(function (id) { if (!cycleSet.has(id)) maxLevel = Math.max(maxLevel, levels[id] || 0); });
    var nodesByLevel = [];
    for (var l = 0; l <= maxLevel; l++) nodesByLevel.push([]);
    activityIds.forEach(function (id) { if (!cycleSet.has(id)) nodesByLevel[levels[id] || 0].push(id); });

    var predCount = {}, succCount = {};
    activityIds.forEach(function (id) { predCount[id] = 0; succCount[id] = 0; });
    relationships.forEach(function (r) {
      if (succCount.hasOwnProperty(r.predecessorActivityId)) succCount[r.predecessorActivityId]++;
      if (predCount.hasOwnProperty(r.successorActivityId)) predCount[r.successorActivityId]++;
    });
    var noPredecessor = activityIds.filter(function (id) { return predCount[id] === 0 && !cycleSet.has(id); });
    var noSuccessor = activityIds.filter(function (id) { return succCount[id] === 0 && !cycleSet.has(id); });

    return { nodesByLevel: nodesByLevel, cycleIds: cycleIds, noPredecessor: noPredecessor, noSuccessor: noSuccessor };
  }

  global.PP = global.PP || {};
  global.PP.graph = { computeGraph: computeGraph };
})(window);
