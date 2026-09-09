/**
 * Single source of truth for every "enum-like" value used across the app,
 * the database (stored as validated strings — see prisma/schema.prisma
 * header comment for why), the seed content, and the content-authoring
 * guide in content/QUESTION_SCHEMA.md. Never hardcode these lists a second
 * time — import from here.
 */

export const ROLES = [
  'ADMIN',
  'ASSESSMENT_MANAGER',
  'INTERVIEWER',
  'CANDIDATE',
  'VIEWER',
] as const;
export type Role = (typeof ROLES)[number];

export const CAREER_LEVELS = ['JUNIOR', 'PLANNING_ENGINEER', 'SENIOR', 'LEAD', 'MANAGER'] as const;
export type CareerLevel = (typeof CAREER_LEVELS)[number];

export const CAREER_LEVEL_LABELS: Record<CareerLevel, string> = {
  JUNIOR: 'Junior Planning Engineer',
  PLANNING_ENGINEER: 'Planning Engineer',
  SENIOR: 'Senior Planning Engineer',
  LEAD: 'Lead Planning Engineer / Project Controls Lead',
  MANAGER: 'Planning Manager / Project Controls Manager',
};

/** Final candidate classification outputs (§29) — finer grained than CareerLevel. */
export const CLASSIFICATION_LEVELS = [
  'BELOW_JUNIOR',
  'JUNIOR',
  'JUNIOR_PLUS',
  'PLANNING_ENGINEER',
  'PLANNING_ENGINEER_PLUS',
  'SENIOR_PLANNING_ENGINEER',
  'SENIOR_PLUS',
  'LEAD_PLANNING_ENGINEER',
  'PROJECT_CONTROLS_LEAD',
  'PLANNING_MANAGER',
  'PROJECT_CONTROLS_MANAGER',
] as const;
export type ClassificationLevel = (typeof CLASSIFICATION_LEVELS)[number];

export const QUESTION_TYPES = [
  'MCQ',
  'MULTI_SELECT',
  'TRUE_FALSE',
  'NUMERICAL',
  'SCENARIO',
  'TROUBLESHOOTING',
  'WRITTEN',
  'CASE_STUDY',
  'P6_ANALYSIS',
  'INTERVIEW',
  'DECISION_MAKING',
  'WHAT_CHECK_FIRST',
  'IS_THIS_POSSIBLE',
  'MOST_LIKELY_CAUSE',
  'WHAT_NEXT',
  'MISSING_INFO',
  'PARADOX',
  'PRACTICAL_SCENARIO',
  'DELAY_CLAIM_SCENARIO',
  'MANAGEMENT_SCENARIO',
] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];

/** Question types that are auto-scored from `correctAnswer` (closed-form). */
export const AUTO_SCORED_TYPES: QuestionType[] = ['MCQ', 'MULTI_SELECT', 'TRUE_FALSE', 'NUMERICAL'];

export const DIFFICULTY_LEVELS = [1, 2, 3, 4, 5] as const;
export const DIFFICULTY_LABELS: Record<number, string> = {
  1: 'Basic',
  2: 'Intermediate',
  3: 'Advanced',
  4: 'Senior',
  5: 'Expert / Managerial',
};

export const QUESTION_STATUSES = ['DRAFT', 'REVIEW', 'APPROVED', 'PUBLISHED', 'ARCHIVED'] as const;
export type QuestionStatus = (typeof QUESTION_STATUSES)[number];

export const QUESTION_FLAGS = [
  'AMBIGUOUS',
  'INCORRECT',
  'TOO_EASY',
  'TOO_DIFFICULT',
  'DUPLICATE',
  'NEEDS_REVIEW',
] as const;
export type QuestionFlag = (typeof QUESTION_FLAGS)[number];

export const ASSESSMENT_MODES = [
  'QUICK',
  'STANDARD',
  'FULL',
  'CERTIFICATION',
  'INTERVIEW',
  'SENIOR_MANAGER',
  'PRACTICAL_P6',
  'TRAINING',
  'CUSTOM',
] as const;
export type AssessmentMode = (typeof ASSESSMENT_MODES)[number];

export const ASSESSMENT_MODE_META: Record<
  AssessmentMode,
  { label: string; code: string; questionRange: [number, number]; description: string }
> = {
  QUICK: { label: 'Quick Test', code: 'A', questionRange: [10, 20], description: 'Fast competency snapshot.' },
  STANDARD: { label: 'Standard Assessment', code: 'B', questionRange: [40, 60], description: 'Balanced, adaptive core assessment.' },
  FULL: { label: 'Full Assessment', code: 'C', questionRange: [100, 150], description: 'Comprehensive, all-competency assessment.' },
  CERTIFICATION: { label: 'Professional Certification Style', code: 'D', questionRange: [80, 150], description: 'Large mixed, certification-grade assessment.' },
  INTERVIEW: { label: 'Interview Mode', code: 'E', questionRange: [5, 40], description: 'Interviewer-controlled structured interview.' },
  SENIOR_MANAGER: { label: 'Senior / Manager Assessment', code: 'F', questionRange: [30, 60], description: 'Advanced scenarios only (difficulty 4-5).' },
  PRACTICAL_P6: { label: 'Practical P6 Assessment', code: 'G', questionRange: [20, 50], description: 'P6 schedule analysis & troubleshooting focus.' },
  TRAINING: { label: 'Training Mode', code: 'H', questionRange: [10, 100], description: 'Shows explanations immediately after each answer.' },
  CUSTOM: { label: 'Custom Assessment', code: 'I', questionRange: [5, 150], description: 'Admin-selected competencies, levels, categories, duration.' },
};

export const ASSESSMENT_STATUSES = ['NOT_STARTED', 'IN_PROGRESS', 'PAUSED', 'COMPLETED', 'ABANDONED'] as const;
export type AssessmentStatus = (typeof ASSESSMENT_STATUSES)[number];

export const RECOMMENDATIONS = [
  'STRONGLY_RECOMMENDED',
  'RECOMMENDED',
  'RECOMMENDED_WITH_DEVELOPMENT',
  'BORDERLINE',
  'NOT_RECOMMENDED',
] as const;
export type Recommendation = (typeof RECOMMENDATIONS)[number];

/**
 * The 8 weighted competency groups (§28). Stored as `Competency` rows;
 * every Question's `competencyId` points at one of these. Weights are the
 * defaults — admins may edit them at runtime via Settings (must still sum
 * to 100, enforced in src/lib/engine/competencies.ts).
 */
export const COMPETENCY_GROUPS = [
  { code: 'PLANNING_CPM', name: 'Planning & CPM', weight: 20, isCritical: true },
  { code: 'P6', name: 'Primavera P6', weight: 20, isCritical: true },
  { code: 'SCHEDULE_ANALYSIS', name: 'Schedule Analysis', weight: 15, isCritical: true },
  { code: 'PROJECT_CONTROLS_EVM', name: 'Project Controls / EVM', weight: 10, isCritical: false },
  { code: 'DELAY_CLAIMS', name: 'Delay / Claims', weight: 15, isCritical: true },
  { code: 'CONSTRUCTION_METHODOLOGY', name: 'Construction Methodology', weight: 10, isCritical: false },
  { code: 'ANALYTICAL_THINKING', name: 'Analytical Thinking', weight: 5, isCritical: false },
  { code: 'MANAGEMENT_COMM_ETHICS', name: 'Management / Communication / Ethics', weight: 5, isCritical: false },
] as const;
export type CompetencyGroupCode = (typeof COMPETENCY_GROUPS)[number]['code'];

/**
 * The 25 topic categories (§3 distribution). `group` is the Competency
 * group code each category rolls up into for weighted scoring.
 */
export const CATEGORIES = [
  { code: 'PF', name: 'Planning Fundamentals', group: 'PLANNING_CPM', minQuestions: 30 },
  { code: 'CPM', name: 'CPM / Critical Path / Float', group: 'PLANNING_CPM', minQuestions: 45 },
  { code: 'P6F', name: 'Primavera P6 Fundamentals', group: 'P6', minQuestions: 40 },
  { code: 'P6A', name: 'Primavera P6 Advanced', group: 'P6', minQuestions: 60 },
  { code: 'SLR', name: 'Schedule Logic / Relationships', group: 'PLANNING_CPM', minQuestions: 35 },
  { code: 'CONST', name: 'Constraints', group: 'PLANNING_CPM', minQuestions: 25 },
  { code: 'CAL', name: 'Calendars', group: 'P6', minQuestions: 15 },
  { code: 'PU', name: 'Progress Updating', group: 'SCHEDULE_ANALYSIS', minQuestions: 40 },
  { code: 'BSC', name: 'Baseline / Schedule Comparison', group: 'SCHEDULE_ANALYSIS', minQuestions: 20 },
  { code: 'SQ', name: 'Schedule Quality', group: 'SCHEDULE_ANALYSIS', minQuestions: 25 },
  { code: 'RES', name: 'Resources', group: 'PROJECT_CONTROLS_EVM', minQuestions: 20 },
  { code: 'CL', name: 'Cost Loading', group: 'PROJECT_CONTROLS_EVM', minQuestions: 15 },
  { code: 'EVM', name: 'Earned Value Management', group: 'PROJECT_CONTROLS_EVM', minQuestions: 30 },
  { code: 'PMH', name: 'Productivity / Manpower', group: 'PROJECT_CONTROLS_EVM', minQuestions: 15 },
  { code: 'RA', name: 'Recovery / Acceleration', group: 'DELAY_CLAIMS', minQuestions: 25 },
  { code: 'DA', name: 'Delay Analysis', group: 'DELAY_CLAIMS', minQuestions: 35 },
  { code: 'EOT', name: 'EOT / Claims', group: 'DELAY_CLAIMS', minQuestions: 25 },
  { code: 'TIA', name: 'Time Impact Analysis / Fragnet', group: 'DELAY_CLAIMS', minQuestions: 20 },
  { code: 'CO', name: 'Change Orders', group: 'DELAY_CLAIMS', minQuestions: 15 },
  { code: 'CM', name: 'Construction Methodology', group: 'CONSTRUCTION_METHODOLOGY', minQuestions: 25 },
  { code: 'PC', name: 'Project Controls', group: 'PROJECT_CONTROLS_EVM', minQuestions: 25 },
  { code: 'RISK', name: 'Risk / Schedule Risk', group: 'ANALYTICAL_THINKING', minQuestions: 15 },
  { code: 'RPT', name: 'Reporting / Management', group: 'MANAGEMENT_COMM_ETHICS', minQuestions: 15 },
  { code: 'ETH', name: 'Professional Judgment / Ethics', group: 'MANAGEMENT_COMM_ETHICS', minQuestions: 10 },
  { code: 'PARA', name: 'Planning Paradoxes & Trap Scenarios', group: 'ANALYTICAL_THINKING', minQuestions: 50 },
] as const;
export type CategoryCode = (typeof CATEGORIES)[number]['code'];

export const RUBRIC_DIMENSIONS = [
  'technicalAccuracy',
  'reasoning',
  'completeness',
  'practicalApplication',
  'p6Understanding',
  'causeAndEffect',
  'professionalJudgment',
] as const;
export type RubricDimension = (typeof RUBRIC_DIMENSIONS)[number];

export const RUBRIC_DIMENSION_LABELS: Record<RubricDimension, string> = {
  technicalAccuracy: 'Technical Accuracy',
  reasoning: 'Reasoning',
  completeness: 'Completeness',
  practicalApplication: 'Practical Application',
  p6Understanding: 'P6 Understanding',
  causeAndEffect: 'Cause & Effect',
  professionalJudgment: 'Professional Judgment',
};
