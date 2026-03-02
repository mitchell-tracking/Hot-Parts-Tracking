
export interface SubStep {
  id: string;
  name: string;
  completed: boolean;
}

export interface ProcessStep {
  id: string;
  name: string;
  completed: boolean;
  subSteps?: SubStep[];
  isOptional?: boolean;
  isExpanded?: boolean;
  specification?: string;
  standardTime?: string;
  notes?: string;
}

export interface Part {
  id: string;
  name: string;
  quantity: number;
  estStartDate: string;
  estFinishDate: string;
  steps: ProcessStep[];
  lifecyclePhases: ProcessStep[];
  currentStepIndex: number;
  notes: string;
}

export interface AppState {
  parts: Part[];
}
