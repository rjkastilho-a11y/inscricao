import type {
  FormField,
  FormStep,
  ConditionalLogic,
  Condition,
  ConditionGroup,
  ActionType,
} from './form-fields';

// ─── Result Types ───────────────────────────────────────────────────────────

export interface FieldState {
  visible: boolean;
  required: boolean;
  disabled: boolean;
  readOnly: boolean;
  autoFillValue?: string;
  clearOnHide: boolean;
}

export interface StepState {
  visible: boolean;
}

export interface ComputeResult {
  fieldStates: Map<string, FieldState>;
  stepStates: Map<FormStep, StepState>;
}

// ─── Default States ─────────────────────────────────────────────────────────

const DEFAULT_FIELD_STATE: FieldState = {
  visible: true,
  required: false,
  disabled: false,
  readOnly: false,
  clearOnHide: false,
};

const DEFAULT_STEP_STATE: StepState = {
  visible: true,
};

// ─── Condition Evaluation ───────────────────────────────────────────────────

function coerceForComparison(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (Array.isArray(value)) return value.join(', ');
  return String(value).trim();
}

function evaluateCondition(
  condition: Condition,
  fieldValues: Record<string, unknown>
): boolean {
  const rawValue = fieldValues[condition.field_key];
  const actual = coerceForComparison(rawValue);

  let expected = condition.value;
  if (typeof rawValue === 'boolean') {
    const lower = expected.toLowerCase().trim();
    if (lower === 'sim' || lower === 'yes') expected = 'true';
    else if (lower === 'não' || lower === 'nao' || lower === 'no') expected = 'false';
  }

  let result: boolean;
  switch (condition.comparison) {
    case 'equals':
      result = actual.toLowerCase() === expected.toLowerCase();
      break;
    case 'not_equals':
      result = actual.toLowerCase() !== expected.toLowerCase();
      break;
    case 'contains':
      result = actual.toLowerCase().includes(expected.toLowerCase());
      break;
    case 'not_contains':
      result = !actual.toLowerCase().includes(expected.toLowerCase());
      break;
    case 'starts_with':
      result = actual.toLowerCase().startsWith(expected.toLowerCase());
      break;
    case 'ends_with':
      result = actual.toLowerCase().endsWith(expected.toLowerCase());
      break;
    case 'is_empty':
      result = actual === '';
      break;
    case 'not_empty':
      result = actual !== '';
      break;
    case 'gt':
      result = Number(actual) > Number(expected);
      break;
    case 'lt':
      result = Number(actual) < Number(expected);
      break;
    case 'gte':
      result = Number(actual) >= Number(expected);
      break;
    case 'lte':
      result = Number(actual) <= Number(expected);
      break;
    default:
      result = false;
  }

  console.log(`[CL-Eval] ${condition.field_key}: raw=${JSON.stringify(rawValue)} → "${actual}" ${condition.comparison} "${expected}" → ${result}`);

  return result;
}

// ─── Group Evaluation ───────────────────────────────────────────────────────

function evaluateGroup(
  group: ConditionGroup,
  fieldValues: Record<string, unknown>
): boolean {
  if (group.conditions.length === 0) return false;

  if (group.operator === 'AND') {
    return group.conditions.every((c) => evaluateCondition(c, fieldValues));
  }
  return group.conditions.some((c) => evaluateCondition(c, fieldValues));
}

// ─── Field Rules Evaluation ─────────────────────────────────────────────────

function evaluateFieldRules(
  field: FormField,
  fieldValues: Record<string, unknown>
): FieldState {
  const state: FieldState = { ...DEFAULT_FIELD_STATE, required: field.required };

  if (!field.conditional_logic?.enabled || field.conditional_logic.groups.length === 0) {
    return state;
  }

  // Se o campo tem ação "show" em qualquer grupo, o default é oculto.
  // O campo só aparece quando as condições são atendidas.
  const hasShowAction = field.conditional_logic.groups.some((g) => g.actions.includes('show'));
  if (hasShowAction) {
    state.visible = false;
  }

  const matchedGroups = field.conditional_logic.groups.filter((g) =>
    evaluateGroup(g, fieldValues)
  );

  for (const group of matchedGroups) {
    for (const action of group.actions) {
      applyAction(state, action, group);
    }
  }

  return state;
}

function applyAction(state: FieldState, action: ActionType, group: ConditionGroup) {
  switch (action) {
    case 'show':
      state.visible = true;
      break;
    case 'hide':
      state.visible = false;
      break;
    case 'required':
      state.required = true;
      break;
    case 'optional':
      state.required = false;
      break;
    case 'auto_fill':
      state.autoFillValue = group.auto_fill_value;
      break;
    case 'clear_on_hide':
      state.clearOnHide = true;
      break;
    case 'enable':
      state.disabled = false;
      break;
    case 'disable':
      state.disabled = true;
      break;
    case 'readonly':
      state.readOnly = true;
      break;
    // showStep, hideStep, setOptions, showMessage — futuros
  }
}

// ─── Dependency Graph ───────────────────────────────────────────────────────

export function buildDependencyGraph(fields: FormField[]): Map<string, Set<string>> {
  const graph = new Map<string, Set<string>>();

  for (const field of fields) {
    const deps = new Set<string>();
    const cl = field.conditional_logic;

    if (cl?.enabled) {
      for (const group of cl.groups) {
        for (const cond of group.conditions) {
          if (cond.field_key !== field.field_key) {
            deps.add(cond.field_key);
          }
        }
      }
    }

    graph.set(field.field_key, deps);
  }

  return graph;
}

export function getAffectedFields(
  changedKey: string,
  graph: Map<string, Set<string>>
): Set<string> {
  const affected = new Set<string>();
  const queue = [changedKey];

  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const [fieldKey, deps] of graph) {
      if (deps.has(current) && !affected.has(fieldKey)) {
        affected.add(fieldKey);
        queue.push(fieldKey);
      }
    }
  }

  return affected;
}

// ─── Circular Dependency Detection ──────────────────────────────────────────

type Color = 'white' | 'gray' | 'black';

export function detectCircularDeps(
  fields: FormField[]
): { valid: boolean; cycle?: string[] } {
  const graph = buildDependencyGraph(fields);
  const colors = new Map<string, Color>();
  const parent = new Map<string, string | null>();

  for (const key of graph.keys()) {
    colors.set(key, 'white');
    parent.set(key, null);
  }

  function dfs(node: string, path: string[]): string[] | null {
    colors.set(node, 'gray');
    path.push(node);

    const deps = graph.get(node) ?? new Set();
    for (const dep of deps) {
      if (!colors.has(dep)) continue;
      if (colors.get(dep) === 'gray') {
        const cycleStart = path.indexOf(dep);
        return path.slice(cycleStart);
      }
      if (colors.get(dep) === 'white') {
        const cycle = dfs(dep, path);
        if (cycle) return cycle;
      }
    }

    path.pop();
    colors.set(node, 'black');
    return null;
  }

  for (const key of graph.keys()) {
    if (colors.get(key) === 'white') {
      const cycle = dfs(key, []);
      if (cycle) {
        return { valid: false, cycle };
      }
    }
  }

  return { valid: true };
}

// ─── Admin Validation ───────────────────────────────────────────────────────

export function validateConditionalLogic(
  editingField: { field_key: string; conditional_logic: ConditionalLogic | null },
  allFields: { field_key: string; conditional_logic: ConditionalLogic | null }[]
): { valid: boolean; error?: string } {
  const cl = editingField.conditional_logic;
  if (!cl?.enabled || cl.groups.length === 0) return { valid: true };

  const allKeys = new Set(allFields.map((f) => f.field_key));

  for (const group of cl.groups) {
    for (const cond of group.conditions) {
      if (cond.field_key === editingField.field_key) {
        return {
          valid: false,
          error: `O campo "${editingField.field_key}" não pode depender de si mesmo.`,
        };
      }
      if (!allKeys.has(cond.field_key)) {
        return {
          valid: false,
          error: `O campo de origem "${cond.field_key}" não existe.`,
        };
      }
    }
  }

  // Simula inserção e verifica circularidade
  const tempFields = allFields.map((f) => ({
    ...f,
    conditional_logic:
      f.field_key === editingField.field_key ? editingField.conditional_logic : f.conditional_logic,
  })) as FormField[];

  const cycleResult = detectCircularDeps(tempFields);
  if (!cycleResult.valid) {
    return {
      valid: false,
      error: `Dependência circular detectada: ${cycleResult.cycle?.join(' → ')} → ${cycleResult.cycle?.[0]}`,
    };
  }

  return { valid: true };
}

// ─── Compute All States ─────────────────────────────────────────────────────

export function computeAllStates(
  fields: FormField[],
  fieldValues: Record<string, unknown>
): ComputeResult {
  const fieldStates = new Map<string, FieldState>();
  const stepStates = new Map<FormStep, StepState>();

  // Inicializa steps como visíveis
  const STEPS: FormStep[] = ['personal', 'christian_life', 'health', 'emergency', 'other'];
  for (const step of STEPS) {
    stepStates.set(step, { ...DEFAULT_STEP_STATE });
  }

  // Avalia estados dos campos
  for (const field of fields) {
    const state = evaluateFieldRules(field, fieldValues);

    // Aplica valor base do campo
    if (field.required && !state.required) {
      state.required = true;
    }

    fieldStates.set(field.field_key, state);
  }

  // Processa ações de step (showStep/hideStep)
  for (const field of fields) {
    const cl = field.conditional_logic;
    if (!cl?.enabled) continue;

    const state = fieldStates.get(field.field_key);
    if (!state || !state.visible) continue;

    for (const group of cl.groups) {
      if (!evaluateGroup(group, fieldValues)) continue;
      for (const action of group.actions) {
        if (action === 'showStep') {
          // auto_fill_value contém o step key
          const stepKey = group.auto_fill_value as FormStep;
          if (STEPS.includes(stepKey)) {
            stepStates.set(stepKey, { visible: true });
          }
        } else if (action === 'hideStep') {
          const stepKey = group.auto_fill_value as FormStep;
          if (STEPS.includes(stepKey)) {
            stepStates.set(stepKey, { visible: false });
          }
        }
      }
    }
  }

  return { fieldStates, stepStates };
}
