/*
 * M00 governance kernel: record status, audit log, decision log, review queue,
 * conflicts. Every other module writes through these instead of inventing its own
 * ad-hoc history/warnings, per the "no silent choice, no unlogged decision" principle.
 */
(function (global) {
  "use strict";
  var db = global.PP.db;

  var RECORD_STATUSES = ["EXTRACTED", "DERIVED", "PROPOSED", "USER_EDITED", "APPROVED", "OVERRIDDEN"];

  function currentActor() {
    return global.localStorage.getItem("pp_current_actor") || "مستخدم غير محدد";
  }
  function setCurrentActor(name) {
    global.localStorage.setItem("pp_current_actor", name || "");
  }
  function currentRole() {
    // Client-side "role" is a workflow aid (hides/disables actions), not a security
    // boundary — there is no server here to enforce it. Documented honestly in the README.
    return global.localStorage.getItem("pp_current_role") || "Admin";
  }
  function setCurrentRole(role) {
    global.localStorage.setItem("pp_current_role", role);
  }

  function writeAudit(params) {
    return db.insert("auditLog", {
      actor: params.actor || currentActor(),
      entityType: params.entityType,
      entityId: params.entityId,
      action: params.action,
      oldValue: params.oldValue !== undefined ? JSON.stringify(params.oldValue) : null,
      newValue: params.newValue !== undefined ? JSON.stringify(params.newValue) : null,
      reason: params.reason || null,
    });
  }

  function recordDecision(params) {
    return db.insert("decisionLog", {
      projectId: params.projectId,
      actor: params.actor || currentActor(),
      entityType: params.entityType,
      entityId: params.entityId || null,
      title: params.title,
      description: params.description,
      evidence: params.evidence !== undefined ? JSON.stringify(params.evidence) : null,
      alternativesRejected: params.alternativesRejected !== undefined ? JSON.stringify(params.alternativesRejected) : null,
    });
  }

  function raiseReviewItem(params) {
    return db.insert("reviewQueue", {
      projectId: params.projectId,
      kind: params.kind, // LOW_CONFIDENCE | CONFLICT | EXTRACTION_FAILED | UNRESOLVED_VARIANCE
      entityType: params.entityType,
      entityId: params.entityId,
      reason: params.reason,
      status: "OPEN",
    });
  }

  // Same as raiseReviewItem but skips creating a duplicate when an OPEN item already
  // exists for this exact entity+kind — call sites that recompute state on every render
  // (e.g. reconciliation checks) must use this, not raiseReviewItem, or they'd spam
  // the queue once per render.
  function raiseReviewItemOnce(params) {
    var dupe = db.query("reviewQueue", function (r) {
      return r.status === "OPEN" && r.kind === params.kind && r.entityType === params.entityType && r.entityId === params.entityId;
    })[0];
    if (dupe) return dupe;
    return raiseReviewItem(params);
  }

  function resolveReviewItem(id, resolution) {
    return db.update("reviewQueue", id, { status: "RESOLVED", resolution: resolution, resolvedBy: currentActor(), resolvedAt: new Date().toISOString() });
  }

  function raiseConflict(params) {
    return db.insert("conflicts", {
      projectId: params.projectId,
      entityType: params.entityType,
      entityId: params.entityId || null,
      description: params.description,
      sourceA: JSON.stringify(params.sourceA),
      sourceB: JSON.stringify(params.sourceB),
      status: "OPEN",
    });
  }

  function resolveConflict(id, resolution) {
    return db.update("conflicts", id, { status: "RESOLVED", resolution: resolution, resolvedBy: currentActor(), resolvedAt: new Date().toISOString() });
  }

  function openReviewCount(projectId) {
    return db.query("reviewQueue", function (r) { return r.projectId === projectId && r.status === "OPEN"; }).length;
  }
  function openConflictCount(projectId) {
    return db.query("conflicts", function (r) { return r.projectId === projectId && r.status === "OPEN"; }).length;
  }

  global.PP.gov = {
    RECORD_STATUSES: RECORD_STATUSES,
    currentActor: currentActor,
    setCurrentActor: setCurrentActor,
    currentRole: currentRole,
    setCurrentRole: setCurrentRole,
    writeAudit: writeAudit,
    recordDecision: recordDecision,
    raiseReviewItem: raiseReviewItem,
    raiseReviewItemOnce: raiseReviewItemOnce,
    resolveReviewItem: resolveReviewItem,
    raiseConflict: raiseConflict,
    resolveConflict: resolveConflict,
    openReviewCount: openReviewCount,
    openConflictCount: openConflictCount,
  };
})(window);
