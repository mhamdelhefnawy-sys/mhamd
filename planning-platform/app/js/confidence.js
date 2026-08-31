/*
 * Multi-factor confidence for the M05 rule-based (NOT AI) activity-generation engine.
 * Every factor here is a plain, explainable computation over the dictionary match —
 * there is no model call involved, and the UI must never call this "AI-generated".
 */
(function (global) {
  "use strict";

  var WEIGHTS = { keywordMatch: 0.55, unitMatch: 0.2, ambiguity: 0.25 };
  var LOW_CONFIDENCE_THRESHOLD = 0.5;

  function keywordMatchScore(description, keywordsCsv) {
    var desc = (description || "").toLowerCase();
    var keywords = (keywordsCsv || "")
      .split(",")
      .map(function (k) { return k.trim().toLowerCase(); })
      .filter(Boolean);
    if (keywords.length === 0) return 0;
    var hits = keywords.filter(function (k) { return desc.indexOf(k) !== -1; }).length;
    return hits / keywords.length;
  }

  function computeConfidence(factors) {
    var score =
      factors.keywordMatch * WEIGHTS.keywordMatch +
      factors.unitMatch * WEIGHTS.unitMatch +
      factors.ambiguity * WEIGHTS.ambiguity;

    var rationale = [];
    rationale.push(
      factors.keywordMatch >= 0.6
        ? "تطابق قوي في الكلمات المفتاحية (" + Math.round(factors.keywordMatch * 100) + "%)"
        : "تطابق ضعيف في الكلمات المفتاحية (" + Math.round(factors.keywordMatch * 100) + "%)"
    );
    rationale.push(
      factors.unitMatch === 1
        ? "وحدة القياس متطابقة مع القاموس"
        : factors.unitMatch === 0.5
          ? "وحدة القياس غير محددة في أحد الطرفين"
          : "وحدة القياس غير متطابقة مع القاموس"
    );
    if (factors.ambiguity < 0.7) {
      rationale.push("توجد عناصر قاموس أخرى قريبة في درجة التطابق — يُنصح بالمراجعة");
    }

    return { score: Math.round(score * 1000) / 1000, factors: factors, rationale: rationale };
  }

  global.PP = global.PP || {};
  global.PP.confidence = {
    LOW_CONFIDENCE_THRESHOLD: LOW_CONFIDENCE_THRESHOLD,
    keywordMatchScore: keywordMatchScore,
    computeConfidence: computeConfidence,
  };
})(window);
