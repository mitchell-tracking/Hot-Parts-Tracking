
import { Part, ProcessStep, SubStep } from './types';

export const CASTING_SUB_STEPS = [
  'Wax',
  'Dip',
  'Autoclave/Flashfire',
  'Foundry',
  'Post-Foundry'
];

export const createCastingProcess = (completedCount: number, specification?: string, standardTime?: string): ProcessStep => {
  const subSteps: SubStep[] = CASTING_SUB_STEPS.map((name, i) => ({
    id: `sub-${i}-${Math.random().toString(36).substr(2, 9)}`,
    name,
    completed: i < completedCount
  }));

  return {
    id: `main-casting-${Math.random().toString(36).substr(2, 9)}`,
    name: 'Investment Casting',
    completed: completedCount === CASTING_SUB_STEPS.length,
    subSteps,
    specification,
    standardTime
  };
};

export const createStandaloneStep = (id: string, name: string, completed: boolean = false, isOptional: boolean = false, specification?: string, standardTime?: string): ProcessStep => ({
  id,
  name,
  completed,
  subSteps: undefined,
  isOptional,
  specification,
  standardTime
});

export const createDefaultLifecyclePhases = (): ProcessStep[] => [
  { id: `lp-mold-${Math.random().toString(36).substr(2, 9)}`, name: 'Mold Status', completed: false, standardTime: 'TBD', subSteps: [], notes: '' },
  { id: `lp-fa-${Math.random().toString(36).substr(2, 9)}`, name: 'FA Status', completed: false, standardTime: 'TBD', subSteps: [], notes: '' },
  { id: `lp-prod-${Math.random().toString(36).substr(2, 9)}`, name: 'Production Status', completed: false, standardTime: 'TBD', subSteps: [], notes: '' },
  { id: `lp-ship-${Math.random().toString(36).substr(2, 9)}`, name: 'Shipment Status', completed: false, standardTime: 'TBD', subSteps: [], notes: '' },
];

export const INITIAL_PARTS: Part[] = [
  {
    id: 'part-1',
    name: 'TRN',
    quantity: 24,
    estStartDate: '2025-05-12',
    estFinishDate: '2025-05-28',
    steps: [
      createCastingProcess(5, 'Specification-ASTM A744, Grade CF8M', '14 Days'),
      createStandaloneStep('weld-repair-trn', 'Weld Repair', true, true, 'Specification- AMS 2175, Class 1', '2 Days'),
      createStandaloneStep('pen-test-trn', 'Penetrant Testing', false, false, 'Specification- AMS 2175, Class 1, Grade D', '1 Day'),
      createStandaloneStep('x-ray-trn', 'X-Ray', false, false, 'Specification- AMS 2175, Class 1, Grade D', '1 Day'),
      createStandaloneStep('heat-treat-trn', 'Heat Treatment', false, false, 'Specification- ASTM A744, Grade CF8M', '3 Days'),
      createStandaloneStep('chem-test-trn', 'Chemical Testing', false, false, 'Specification- ASTM A744, Grade CF8M', '2 Days'),
      createStandaloneStep('mech-test-trn', 'Mechanical Testing', false, false, 'Specification- ASTM A744, Grade CF8M', '2 Days'),
      createStandaloneStep('final-report-trn', 'Final Inspection Report', false, false, 'Specification- AS9102 - 3 forms', '1 Day'),
    ],
    lifecyclePhases: createDefaultLifecyclePhases(),
    currentStepIndex: 2,
    notes: 'High tolerance required on internal bore. Moving to Penetrant Testing.'
  },
  {
    id: 'part-2',
    name: 'DV',
    quantity: 12,
    estStartDate: '2025-05-14',
    estFinishDate: '2025-06-05',
    steps: [
      createCastingProcess(2),
      createStandaloneStep('pen-test-dv', 'Penetrant Testing', false),
      createStandaloneStep('x-ray-dv', 'X-Ray', false),
    ],
    lifecyclePhases: createDefaultLifecyclePhases(),
    currentStepIndex: 0,
    notes: 'Optimized process flow: Casting, PT, and X-Ray only.'
  },
  {
    id: 'part-3',
    name: 'CH',
    quantity: 8,
    estStartDate: '2025-05-10',
    estFinishDate: '2025-05-20',
    steps: [
      createCastingProcess(3, 'Specification- AMS 5398; Grade 17-4PH', '12 Days'),
      createStandaloneStep('weld-repair-ch', 'Weld Repair', false, true, 'Specification- AMS 2175, Class 2', '3 Days'),
      createStandaloneStep('pen-test-ch', 'Penetrant Testing', false, false, 'Specification- ASTM E165, Method A, Type 1', '1 Day'),
      createStandaloneStep('x-ray-ch', 'X-Ray', false, false, 'Specification- AMS 2175, Class 2, Grade B', '2 Days'),
      createStandaloneStep('heat-treat-ch', 'Heat Treatment', false, false, 'Specification- MIL-H-6875, Class D to H1025', '4 Days'),
      createStandaloneStep('chem-test-ch', 'Chemical Testing', false, false, 'Specification- AMS 5398', '2 Days'),
      createStandaloneStep('mech-test-ch', 'Mechanical Testing', false, false, 'Specification- AMS 5398 / MIL-H-6875', '2 Days'),
      createStandaloneStep('final-insp-ch', 'Final Inspection Report', false, false, 'Specification- AS9102 - 3 forms', '1 Day'),
    ],
    lifecyclePhases: createDefaultLifecyclePhases(),
    currentStepIndex: 0,
    notes: 'Rush order. PT and X-Ray prioritized after weld repair check.'
  },
  {
    id: 'part-4',
    name: 'GB',
    quantity: 150,
    estStartDate: 'TBD',
    estFinishDate: 'TBD',
    steps: [createCastingProcess(0)],
    lifecyclePhases: createDefaultLifecyclePhases(),
    currentStepIndex: 0,
    notes: 'Batch tracking required for welding logs.'
  },
  {
    id: 'part-5',
    name: 'LC',
    quantity: 6,
    estStartDate: 'TBD',
    estFinishDate: 'TBD',
    steps: [createCastingProcess(4)],
    lifecyclePhases: createDefaultLifecyclePhases(),
    currentStepIndex: 0,
    notes: 'Material certifications must be attached.'
  },
  {
    id: 'part-6',
    name: 'SC',
    quantity: 4,
    estStartDate: 'TBD',
    estFinishDate: 'TBD',
    steps: [createCastingProcess(0)],
    lifecyclePhases: createDefaultLifecyclePhases(),
    currentStepIndex: 0,
    notes: 'Standard service cycle.'
  }
];

export const COLORS = {
  primary: 'text-blue-600',
  secondary: 'text-slate-500',
  success: 'bg-emerald-500',
  pending: 'bg-amber-400',
  upcoming: 'bg-slate-200',
};
