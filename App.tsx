import { supabase } from './src/supabaseClient.js';
import React, { useState, useMemo, useEffect } from 'react';
import { Part, ProcessStep, SubStep } from './types';
import { INITIAL_PARTS, createCastingProcess, createDefaultLifecyclePhases } from './constants';
import { ProgressBar, getScheduleStatus } from './components/ProgressBar';

type ViewMode = 'active' | 'finished';

const App: React.FC = () => {
  const [parts, setParts] = useState<Part[]>(INITIAL_PARTS);
  const [finishedParts, setFinishedParts] = useState<Part[]>([]);
  const [selectedPartId, setSelectedPartId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('active');
  const [newSubStepName, setNewSubStepName] = useState<{ [key: string]: string }>({});
  const [editingStepId, setEditingStepId] = useState<string | null>(null);
  const [draggedStepIndex, setDraggedStepIndex] = useState<number | null>(null);
  const [draggedPhaseIndex, setDraggedPhaseIndex] = useState<number | null>(null);

  const activeParts = useMemo(() => parts, [parts]);

  const displayedParts = viewMode === 'active' ? activeParts : finishedParts;
  const selectedPart = displayedParts.find(p => p.id === selectedPartId) || null;
// Load data from Supabase when the app starts
  useEffect(() => {
    const fetchParts = async () => {
      const { data, error } = await supabase
        .from('Parts')
        .select('*');
      
      if (error) {
        console.error("Error fetching parts:", error);
      } else if (data && data.length > 0) {
        setParts(data);
      }
    };
    fetchParts();
  }, []);
  useEffect(() => {
    if (selectedPart) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
  }, [selectedPart]);

  const updatePart = (updatedPart: Part) => {
    if (viewMode === 'active') {
      setParts(prev => prev.map(p => p.id === updatedPart.id ? updatedPart : p));
    } else {
      setFinishedParts(prev => prev.map(p => p.id === updatedPart.id ? updatedPart : p));
    }
  };

  const handleNewPart = async () => {
    const newId = `part-${Date.now()}`;
    const newPart: Part = {
      id: newId,
      name: `NEW-PART-${activeParts.length + 1}`,
      quantity: 1,
      estStartDate: new Date().toISOString().split('T')[0],
      estFinishDate: 'TBD',
      steps: [createCastingProcess(0)],
      lifecyclePhases: createDefaultLifecyclePhases(),
      currentStepIndex: 0,
      notes: 'Initial entry.'
    };

    // This sends it to your database
    const { error } = await supabase.from('Parts').insert([newPart]);

    if (error) {
      console.error("Error saving:", error);
      alert("Database error. Make sure RLS policies are set in Supabase.");
    } else {
      setParts(prev => [...prev, newPart]);
      setSelectedPartId(newId);
      setViewMode('active');
    }
  };

  const handleDeletePart = (partId: string) => {
    if (!window.confirm("Are you sure you want to delete this part? This action cannot be undone.")) return;
    if (viewMode === 'active') {
      setParts(prev => prev.filter(p => p.id !== partId));
    } else {
      setFinishedParts(prev => prev.filter(p => p.id !== partId));
    }
    setSelectedPartId(null);
  };

  const handleFinishPart = (partId: string) => {
    const partToFinish = parts.find(p => p.id === partId);
    if (!partToFinish) return;

    setParts(prev => prev.filter(p => p.id !== partId));
    setFinishedParts(prev => [...prev, { ...partToFinish, notes: partToFinish.notes + '\n[Marked as Finished]' }]);
    setSelectedPartId(null);
  };

  const toggleStepCollapse = (partId: string, stepId: string) => {
    const part = displayedParts.find(p => p.id === partId);
    if (!part) return;

    const newSteps = part.steps.map(step => {
      if (step.id === stepId) {
        return { ...step, isExpanded: !step.isExpanded };
      }
      return step;
    });

    updatePart({ ...part, steps: newSteps });
  };

  const handleStepToggle = (partId: string, stepId: string) => {
    const part = displayedParts.find(p => p.id === partId);
    if (!part) return;

    const newSteps = part.steps.map(step => {
      if (step.id !== stepId) return step;
      const newStatus = !step.completed;
      // If checking/unchecking main step, sync all sub-steps
      const subSteps = step.subSteps?.map(ss => ({ ...ss, completed: newStatus }));
      return { ...step, completed: newStatus, subSteps };
    });

    updatePart({ ...part, steps: newSteps });
  };

  const handleToggleStepOptional = (partId: string, stepId: string) => {
    const part = displayedParts.find(p => p.id === partId);
    if (!part) return;

    const newSteps = part.steps.map(step => {
      if (step.id === stepId) {
        return { ...step, isOptional: !step.isOptional };
      }
      return step;
    });

    updatePart({ ...part, steps: newSteps });
  };

  const handleUpdateStepName = (partId: string, stepId: string, newName: string) => {
    const part = displayedParts.find(p => p.id === partId);
    if (!part) return;

    const newSteps = part.steps.map(step => {
      if (step.id === stepId) {
        return { ...step, name: newName };
      }
      return step;
    });

    updatePart({ ...part, steps: newSteps });
  };

  const handleUpdateStepSpecification = (partId: string, stepId: string, newSpec: string) => {
    const part = displayedParts.find(p => p.id === partId);
    if (!part) return;

    const newSteps = part.steps.map(step => {
      if (step.id === stepId) {
        return { ...step, specification: newSpec };
      }
      return step;
    });

    updatePart({ ...part, steps: newSteps });
  };

  const handleUpdateStepStandardTime = (partId: string, stepId: string, newTime: string) => {
    const part = displayedParts.find(p => p.id === partId);
    if (!part) return;

    const newSteps = part.steps.map(step => {
      if (step.id === stepId) {
        return { ...step, standardTime: newTime };
      }
      return step;
    });

    updatePart({ ...part, steps: newSteps });
  };

  // LIFECYCLE PHASE HANDLERS
  const togglePhaseCollapse = (partId: string, phaseId: string) => {
    const part = displayedParts.find(p => p.id === partId);
    if (!part) return;

    const newPhases = part.lifecyclePhases.map(phase => {
      if (phase.id === phaseId) {
        return { ...phase, isExpanded: !phase.isExpanded };
      }
      return phase;
    });

    updatePart({ ...part, lifecyclePhases: newPhases });
  };

  const handlePhaseToggle = (partId: string, phaseId: string) => {
    const part = displayedParts.find(p => p.id === partId);
    if (!part) return;

    const newPhases = part.lifecyclePhases.map(phase => {
      if (phase.id !== phaseId) return phase;
      const newStatus = !phase.completed;
      const subSteps = phase.subSteps?.map(ss => ({ ...ss, completed: newStatus }));
      return { ...phase, completed: newStatus, subSteps };
    });

    updatePart({ ...part, lifecyclePhases: newPhases });
  };

  const handleTogglePhaseOptional = (partId: string, phaseId: string) => {
    const part = displayedParts.find(p => p.id === partId);
    if (!part) return;

    const newPhases = part.lifecyclePhases.map(phase => {
      if (phase.id === phaseId) {
        return { ...phase, isOptional: !phase.isOptional };
      }
      return phase;
    });

    updatePart({ ...part, lifecyclePhases: newPhases });
  };

  const handleUpdatePhaseName = (partId: string, phaseId: string, newName: string) => {
    const part = displayedParts.find(p => p.id === partId);
    if (!part) return;

    const newPhases = part.lifecyclePhases.map(phase => {
      if (phase.id === phaseId) {
        return { ...phase, name: newName };
      }
      return phase;
    });

    updatePart({ ...part, lifecyclePhases: newPhases });
  };

  const handleUpdatePhaseSpecification = (partId: string, phaseId: string, newSpec: string) => {
    const part = displayedParts.find(p => p.id === partId);
    if (!part) return;

    const newPhases = part.lifecyclePhases.map(phase => {
      if (phase.id === phaseId) {
        return { ...phase, specification: newSpec };
      }
      return phase;
    });

    updatePart({ ...part, lifecyclePhases: newPhases });
  };

  const handleUpdatePhaseStandardTime = (partId: string, phaseId: string, newTime: string) => {
    const part = displayedParts.find(p => p.id === partId);
    if (!part) return;

    const newPhases = part.lifecyclePhases.map(phase => {
      if (phase.id === phaseId) {
        return { ...phase, standardTime: newTime };
      }
      return phase;
    });

    updatePart({ ...part, lifecyclePhases: newPhases });
  };

  const handleUpdatePhaseNotes = (partId: string, phaseId: string, newNotes: string) => {
    const part = displayedParts.find(p => p.id === partId);
    if (!part) return;

    const newPhases = part.lifecyclePhases.map(phase => {
      if (phase.id === phaseId) {
        return { ...phase, notes: newNotes };
      }
      return phase;
    });

    updatePart({ ...part, lifecyclePhases: newPhases });
  };

  const handleAddPhase = (partId: string) => {
    const part = displayedParts.find(p => p.id === partId);
    if (!part) return;

    const newPhase: ProcessStep = {
      id: `phase-${Date.now()}`,
      name: 'NEW LIFECYCLE PHASE',
      completed: false,
      isExpanded: false,
      notes: '',
      subSteps: []
    };

    updatePart({ ...part, lifecyclePhases: [...part.lifecyclePhases, newPhase] });
  };

  const handleRemovePhase = (partId: string, phaseId: string) => {
    const part = displayedParts.find(p => p.id === partId);
    if (!part) return;

    updatePart({ ...part, lifecyclePhases: part.lifecyclePhases.filter(p => p.id !== phaseId) });
  };

  const handleSubStepTogglePhase = (partId: string, phaseId: string, subStepId: string) => {
    const part = displayedParts.find(p => p.id === partId);
    if (!part) return;

    const newPhases = part.lifecyclePhases.map(phase => {
      if (phase.id !== phaseId) return phase;

      const newSubSteps = phase.subSteps?.map(ss => {
        if (ss.id === subStepId) {
          return { ...ss, completed: !ss.completed };
        }
        return ss;
      });

      const allCompleted = newSubSteps?.every(ss => ss.completed) || false;
      return { ...phase, subSteps: newSubSteps, completed: allCompleted };
    });

    updatePart({ ...part, lifecyclePhases: newPhases });
  };

  const handleAddSubStepPhase = (partId: string, phaseId: string) => {
    const name = newSubStepName[phaseId];
    if (!name || !name.trim()) return;

    const part = displayedParts.find(p => p.id === partId);
    if (!part) return;

    const newPhases = part.lifecyclePhases.map(phase => {
      if (phase.id !== phaseId) return phase;
      const newSub: SubStep = {
        id: `sub-${Date.now()}`,
        name: name.trim(),
        completed: false
      };
      const subSteps = phase.subSteps ? [...phase.subSteps, newSub] : [newSub];
      return { ...phase, subSteps, completed: subSteps.every(s => s.completed) };
    });

    updatePart({ ...part, lifecyclePhases: newPhases });
    setNewSubStepName(prev => ({ ...prev, [phaseId]: '' }));
  };

  const handleRemoveSubStepPhase = (partId: string, phaseId: string, subStepId: string) => {
    const part = displayedParts.find(p => p.id === partId);
    if (!part) return;

    const newPhases = part.lifecyclePhases.map(phase => {
      if (phase.id !== phaseId) return phase;
      const subSteps = phase.subSteps?.filter(ss => ss.id !== subStepId) || [];
      return { ...phase, subSteps, completed: subSteps.length > 0 ? subSteps.every(s => s.completed) : phase.completed };
    });

    updatePart({ ...part, lifecyclePhases: newPhases });
  };

  const onDragStartPhase = (index: number) => {
    setDraggedPhaseIndex(index);
  };

  const onDropPhase = (index: number) => {
    if (draggedPhaseIndex === null || !selectedPart) return;
    const newPhases = [...selectedPart.lifecyclePhases];
    const [reorderedItem] = newPhases.splice(draggedPhaseIndex, 1);
    newPhases.splice(index, 0, reorderedItem);
    updatePart({ ...selectedPart, lifecyclePhases: newPhases });
    setDraggedPhaseIndex(null);
  };

  const handleAddStep = (partId: string) => {
    const part = displayedParts.find(p => p.id === partId);
    if (!part) return;

    const newStep: ProcessStep = {
      id: `step-${Date.now()}`,
      name: 'NEW PROCESS STEP',
      completed: false,
      isExpanded: false // Collapsed by default
    };

    updatePart({ ...part, steps: [...part.steps, newStep] });
  };

  const handleRemoveStep = (partId: string, stepId: string) => {
    const part = displayedParts.find(p => p.id === partId);
    if (!part) return;

    updatePart({ ...part, steps: part.steps.filter(s => s.id !== stepId) });
  };

  const handleSubStepToggle = (partId: string, stepId: string, subStepId: string) => {
    const part = displayedParts.find(p => p.id === partId);
    if (!part) return;

    const newSteps = part.steps.map(step => {
      if (step.id !== stepId) return step;

      const newSubSteps = step.subSteps?.map(ss => {
        if (ss.id === subStepId) {
          return { ...ss, completed: !ss.completed };
        }
        return ss;
      });

      const allCompleted = newSubSteps?.every(ss => ss.completed) || false;
      return { ...step, subSteps: newSubSteps, completed: allCompleted };
    });

    updatePart({ ...part, steps: newSteps });
  };

  const handleAddSubStep = (partId: string, stepId: string) => {
    const name = newSubStepName[stepId];
    if (!name || !name.trim()) return;

    const part = displayedParts.find(p => p.id === partId);
    if (!part) return;

    const newSteps = part.steps.map(step => {
      if (step.id !== stepId) return step;
      const newSub: SubStep = {
        id: `sub-${Date.now()}`,
        name: name.trim(),
        completed: false
      };
      const subSteps = step.subSteps ? [...step.subSteps, newSub] : [newSub];
      return { ...step, subSteps, completed: subSteps.every(s => s.completed) };
    });

    updatePart({ ...part, steps: newSteps });
    setNewSubStepName(prev => ({ ...prev, [stepId]: '' }));
  };

  const handleRemoveSubStep = (partId: string, stepId: string, subStepId: string) => {
    const part = displayedParts.find(p => p.id === partId);
    if (!part) return;

    const newSteps = part.steps.map(step => {
      if (step.id !== stepId) return step;
      const subSteps = step.subSteps?.filter(ss => ss.id !== subStepId) || [];
      return { ...step, subSteps, completed: subSteps.length > 0 ? subSteps.every(s => s.completed) : step.completed };
    });

    updatePart({ ...part, steps: newSteps });
  };

  // DRAG AND DROP HANDLERS
  const onDragStart = (index: number) => {
    setDraggedStepIndex(index);
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const onDrop = (index: number) => {
    if (draggedStepIndex === null || !selectedPart) return;
    const newSteps = [...selectedPart.steps];
    const [reorderedItem] = newSteps.splice(draggedStepIndex, 1);
    newSteps.splice(index, 0, reorderedItem);
    updatePart({ ...selectedPart, steps: newSteps });
    setDraggedStepIndex(null);
  };

  const getCurrentStepName = (part: Part) => {
    const nextIncompleteStep = part.steps.find(s => !s.completed);
    if (!nextIncompleteStep) return "All Steps Completed";
    
    let label = nextIncompleteStep.name;
    if (nextIncompleteStep.subSteps && nextIncompleteStep.subSteps.length > 0) {
      const nextSubStep = nextIncompleteStep.subSteps.find(ss => !ss.completed);
      label = nextSubStep ? `${nextIncompleteStep.name}: ${nextSubStep.name}` : nextIncompleteStep.name;
    }
    
    return nextIncompleteStep.isOptional ? `${label} (Optional)` : label;
  };

  return (
    <div className="min-h-screen pb-12 bg-[#fdfdfd]">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-8">
              <div>
                <h1 className="text-2xl font-black text-slate-900 tracking-tight">SERVICETRACK<span className="text-blue-600">PRO</span></h1>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Global Servicing Dashboard</p>
              </div>
              <nav className="hidden md:flex space-x-2 bg-slate-100 p-1 rounded-xl">
                <button 
                  onClick={() => { setViewMode('active'); setSelectedPartId(null); }}
                  className={`px-4 py-1.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${viewMode === 'active' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                >
                  Active
                </button>
                <button 
                  onClick={() => { setViewMode('finished'); setSelectedPartId(null); }}
                  className={`px-4 py-1.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${viewMode === 'finished' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                >
                  Finished Parts
                </button>
              </nav>
            </div>
            
            <div className="flex items-center space-x-3">
              <button 
                onClick={handleNewPart}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-lg shadow-blue-100"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" />
                </svg>
                <span className="text-sm font-bold uppercase tracking-wider">New Part</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8 space-y-8">
        {viewMode === 'finished' && (
          <div className="flex items-center space-x-3 bg-slate-100 p-4 rounded-2xl border border-slate-300">
            <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-slate-400">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
            </div>
            <div>
              <h2 className="text-sm font-black text-slate-800 uppercase tracking-widest">Finished Parts Archive</h2>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{finishedParts.length} Records stored</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {displayedParts.map((part) => {
            const status = getScheduleStatus(part);
            const statusBorderMap = {
              ahead: 'border-emerald-500',
              'on-time': 'border-amber-400',
              behind: 'border-rose-500'
            };

            return (
              <div 
                key={part.id} 
                onClick={() => setSelectedPartId(part.id)}
                className={`group relative bg-white rounded-2xl border transition-all duration-300 cursor-pointer overflow-hidden
                  ${selectedPartId === part.id ? `ring-4 ${status === 'ahead' ? 'ring-emerald-50' : status === 'on-time' ? 'ring-amber-50' : 'ring-rose-50'} shadow-xl ${statusBorderMap[status]}` : `border-slate-300 hover:${statusBorderMap[status]} hover:shadow-lg shadow-sm`}`}
              >
                <div className="p-6">
                  <div className="flex justify-between items-start mb-6">
                    <div className="pr-2">
                      <h2 className="text-lg font-black text-slate-800 mb-1 leading-tight uppercase truncate max-w-[180px]">{part.name}</h2>
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-black bg-slate-100 text-slate-600 border border-slate-300">
                        QTY: {part.quantity}
                      </span>
                    </div>
                    <div className="text-right flex flex-col items-end shrink-0">
                      <p className="text-[9px] text-slate-400 uppercase font-bold tracking-widest mb-0.5">Est. Finish</p>
                      <p className={`text-xs font-bold px-2 py-1 rounded border ${
                        status === 'ahead' ? 'text-emerald-700 bg-emerald-50 border-emerald-100' :
                        status === 'on-time' ? 'text-amber-700 bg-amber-50 border-amber-100' :
                        'text-rose-700 bg-rose-50 border-rose-100'
                      }`}>{part.estFinishDate}</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center text-[10px] text-slate-500 font-black uppercase tracking-wider">
                      <div className={`w-1.5 h-1.5 rounded-full mr-2 ${
                        status === 'ahead' ? 'bg-emerald-500' :
                        status === 'on-time' ? 'bg-amber-400' :
                        'bg-rose-500'
                      }`}></div>
                      <span className="truncate">Current: <span className="text-slate-900">{getCurrentStepName(part)}</span></span>
                    </div>
                    <ProgressBar part={part} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {selectedPart && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 sm:p-6 md:p-8 animate-in fade-in duration-300"
          onClick={() => { setSelectedPartId(null); setEditingStepId(null); }}
        >
          <div 
            className="bg-white rounded-[2.5rem] border border-slate-300 shadow-2xl overflow-hidden w-full max-w-6xl max-h-[90vh] flex flex-col animate-in zoom-in-95 slide-in-from-bottom-8 duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="border-b border-slate-100 p-8 flex justify-between items-center bg-slate-50/50 shrink-0">
              <div className="flex items-center space-x-6 flex-1">
                <div className="flex-1 max-w-md">
                   <input 
                      type="text"
                      disabled={viewMode === 'finished'}
                      value={selectedPart.name}
                      onChange={(e) => updatePart({ ...selectedPart, name: e.target.value.toUpperCase() })}
                      className="text-3xl font-black text-slate-900 tracking-tight uppercase bg-transparent border-b-2 border-transparent hover:border-slate-200 focus:border-blue-500 focus:outline-none w-full px-1"
                    />
                  <div className="flex items-center space-x-2 mt-1 px-1">
                    <span className="bg-slate-900 text-white text-[10px] font-black px-2 py-0.5 rounded tracking-widest uppercase">Part Details</span>
                  </div>
                </div>
                {viewMode === 'active' && (
                  <button 
                    onClick={() => handleFinishPart(selectedPart.id)}
                    className="flex items-center space-x-2 px-5 py-2.5 bg-emerald-100 text-emerald-700 rounded-xl hover:bg-emerald-600 hover:text-white transition-all border border-emerald-200 text-xs font-black uppercase tracking-widest shadow-sm"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>Finalize Service</span>
                  </button>
                )}
              </div>
              <button 
                onClick={() => { setSelectedPartId(null); setEditingStepId(null); }}
                className="p-3 hover:bg-white hover:shadow-md rounded-2xl transition-all text-slate-400 hover:text-slate-900 border border-transparent hover:border-slate-100 ml-4"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Body */}
            <div className="overflow-y-auto flex-1">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-0 min-h-full">
                <div className="lg:col-span-8 p-10 bg-white">
                  <div className="mb-10 flex justify-between items-end">
                    <div className="flex-1">
                      <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Process Map</h3>
                      <p className="text-sm font-bold text-slate-600">Sequential Workflow Phases (Drag to Reorder)</p>
                    </div>
                    <div className="text-right mr-16">
                      <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Standard Time</h3>
                    </div>
                    {viewMode === 'active' && (
                       <button 
                        onClick={() => handleAddStep(selectedPart.id)}
                        className="flex items-center space-x-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-xl border border-blue-100 hover:bg-blue-600 hover:text-white transition-all text-[10px] font-black uppercase tracking-widest shadow-sm"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" />
                        </svg>
                        <span>Add Process Step</span>
                      </button>
                    )}
                  </div>
                  
                  <div className="space-y-6">
                    {selectedPart.steps.map((step, index) => {
                      const hasSubSteps = step.subSteps && step.subSteps.length > 0;
                      const isExpanded = !!step.isExpanded; // Only show main steps by default
                      const isEditing = editingStepId === step.id;
                      
                      return (
                        <div 
                          key={step.id} 
                          draggable={viewMode === 'active'}
                          onDragStart={() => onDragStart(index)}
                          onDragOver={onDragOver}
                          onDrop={() => onDrop(index)}
                          className={`relative bg-slate-50/40 rounded-[2rem] border overflow-hidden transition-all shadow-sm ${draggedStepIndex === index ? 'opacity-30' : 'opacity-100'} ${isEditing ? 'border-blue-400 ring-4 ring-blue-50' : 'border-slate-100'}`}
                        >
                          <div 
                            className="flex items-center group transition-all p-5 cursor-default hover:bg-slate-50"
                          >
                            {/* Drag Handle */}
                            <div className="mr-3 text-slate-300 cursor-move hover:text-slate-600 transition-colors">
                              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M11 18c0 1.1-.9 2-2 2s-2-.9-2-2 .9-2 2-2 2 .9 2 2zm-2-8c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0-6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm6 4c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
                              </svg>
                            </div>

                            {/* Completion Indicator */}
                            <div 
                              onClick={() => viewMode === 'active' && handleStepToggle(selectedPart.id, step.id)}
                              className={`w-12 h-12 rounded-2xl flex items-center justify-center border-2 transition-all duration-300 cursor-pointer shrink-0
                                ${step.completed ? 'bg-emerald-500 border-emerald-600 text-white shadow-md hover:scale-105' : 'bg-white border-slate-200 text-slate-300 shadow-sm hover:border-emerald-400 hover:text-emerald-500 hover:scale-105'}`}
                            >
                              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                              </svg>
                            </div>

                            {/* Label & Details (Expansion restricted to arrow per request) */}
                            <div className="ml-5 flex-1 pr-4 select-none">
                               {isEditing ? (
                                 <div className="space-y-2">
                                   <input 
                                     type="text"
                                     autoFocus
                                     onClick={(e) => e.stopPropagation()}
                                     value={step.name}
                                     onChange={(e) => handleUpdateStepName(selectedPart.id, step.id, e.target.value.toUpperCase())}
                                     onKeyDown={(e) => e.key === 'Enter' && setEditingStepId(null)}
                                     className="text-lg font-black text-slate-900 uppercase tracking-tight bg-white border-2 border-blue-500 rounded-lg px-2 w-full focus:outline-none"
                                   />
                                   <input 
                                     type="text"
                                     placeholder="Specification (optional)..."
                                     onClick={(e) => e.stopPropagation()}
                                     value={step.specification || ''}
                                     onChange={(e) => handleUpdateStepSpecification(selectedPart.id, step.id, e.target.value)}
                                     onKeyDown={(e) => e.key === 'Enter' && setEditingStepId(null)}
                                     className="text-[10px] font-bold text-slate-600 uppercase tracking-widest bg-white border border-slate-200 rounded px-2 w-full focus:outline-none focus:border-blue-400"
                                   />
                                   <input 
                                     type="text"
                                     placeholder="Standard Time..."
                                     onClick={(e) => e.stopPropagation()}
                                     value={step.standardTime || ''}
                                     onChange={(e) => handleUpdateStepStandardTime(selectedPart.id, step.id, e.target.value)}
                                     onBlur={() => setEditingStepId(null)}
                                     onKeyDown={(e) => e.key === 'Enter' && setEditingStepId(null)}
                                     className="text-[10px] font-bold text-slate-600 uppercase tracking-widest bg-white border border-slate-200 rounded px-2 w-full focus:outline-none focus:border-blue-400"
                                   />
                                 </div>
                               ) : (
                                 <div className="flex items-center justify-between">
                                   <span className="text-lg font-black text-slate-900 uppercase tracking-tight block truncate">
                                     {step.name || "UNNAMED STEP"}
                                   </span>
                                   <span className="text-xs font-black text-slate-400 uppercase tracking-widest bg-slate-100 px-3 py-1 rounded-lg border border-slate-200">
                                     {step.standardTime || "—"}
                                   </span>
                                 </div>
                               )}
                              <div className="flex items-center space-x-3 mt-0.5">
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                  {step.specification ? step.specification : (hasSubSteps ? `${step.subSteps?.length} Operational Sub-Phases` : 'Standard Procedure')}
                                </p>
                                {step.isOptional && (
                                  <span className="text-[8px] font-black text-emerald-600 border border-emerald-200 px-2 py-0.5 rounded-full uppercase tracking-widest bg-emerald-50">
                                    Process Optional
                                  </span>
                                )}
                              </div>
                            </div>
                            
                            {/* Action Buttons */}
                            <div className="flex items-center space-x-3">
                              {viewMode === 'active' && (
                                <div className="flex items-center space-x-2">
                                  <button 
                                    onClick={(e) => { e.stopPropagation(); setEditingStepId(isEditing ? null : step.id); }}
                                    className={`p-2 rounded-xl border transition-all ${isEditing ? 'bg-blue-600 border-blue-700 text-white' : 'bg-white border-slate-200 text-slate-400 hover:border-blue-400 hover:text-blue-500'}`}
                                    title="Edit Step Name"
                                  >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                    </svg>
                                  </button>
                                  
                                  <button 
                                    onClick={(e) => { e.stopPropagation(); handleToggleStepOptional(selectedPart.id, step.id); }}
                                    className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-all ${step.isOptional ? 'bg-emerald-500 border-emerald-600 text-white shadow-sm shadow-emerald-100' : 'bg-white border-slate-300 text-slate-400 hover:border-emerald-400 hover:text-emerald-500'}`}
                                  >
                                    Optional
                                  </button>
                                  <button 
                                    onClick={(e) => { e.stopPropagation(); handleRemoveStep(selectedPart.id, step.id); }}
                                    className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all"
                                  >
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-4v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                  </button>
                                </div>
                              )}
                              
                              {/* Collapse Toggle Arrow - MUST click this to see sub-points */}
                              <button 
                                onClick={(e) => { e.stopPropagation(); toggleStepCollapse(selectedPart.id, step.id); }}
                                className="p-2 text-slate-400 hover:text-slate-900 transition-all rounded-full hover:bg-slate-100 ring-1 ring-slate-200"
                                title={isExpanded ? "Collapse Details" : "Expand Details"}
                              >
                                <svg className={`w-6 h-6 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                              </button>
                            </div>
                          </div>

                          {isExpanded && (
                            <div className="px-6 pb-6 pt-2 animate-in slide-in-from-top-4 duration-300">
                              <div className="space-y-3 px-14">
                                {step.subSteps?.map((subStep) => (
                                  <div 
                                    key={subStep.id}
                                    className={`group flex items-center p-3.5 rounded-2xl border transition-all
                                      ${subStep.completed ? 'bg-emerald-50/60 border-emerald-100 shadow-sm' : 'bg-white border-slate-200 hover:border-blue-300 shadow-sm'}`}
                                  >
                                    {/* Sub-Step Completion Toggle */}
                                    <div 
                                      onClick={() => viewMode === 'active' && handleSubStepToggle(selectedPart.id, step.id, subStep.id)}
                                      className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all shrink-0 cursor-pointer
                                        ${subStep.completed ? 'bg-emerald-500 border-emerald-600 text-white shadow-sm' : 'bg-white border-slate-300 hover:border-blue-500'}`}
                                      title="Check Off Sub-Step"
                                    >
                                      {subStep.completed && (
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M5 13l4 4L19 7" />
                                        </svg>
                                      )}
                                    </div>
                                    
                                    {/* Sub-Step Label (also clickable for toggle) */}
                                    <div 
                                      className="ml-4 flex-1 cursor-pointer select-none"
                                      onClick={() => viewMode === 'active' && handleSubStepToggle(selectedPart.id, step.id, subStep.id)}
                                    >
                                      <span className={`text-xs font-black tracking-wide uppercase ${subStep.completed ? 'text-emerald-700 line-through opacity-60' : 'text-slate-700'}`}>
                                        {subStep.name}
                                      </span>
                                    </div>
                                    
                                    {viewMode === 'active' && (
                                      <button 
                                        onClick={() => handleRemoveSubStep(selectedPart.id, step.id, subStep.id)}
                                        className="opacity-0 group-hover:opacity-100 p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                                      >
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-4v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                      </button>
                                    )}
                                  </div>
                                ))}

                                {viewMode === 'active' && (
                                  <div className="mt-5 flex items-center space-x-3 pt-3 border-t border-slate-200/60">
                                    <input 
                                      type="text"
                                      placeholder="Identify next operational sub-step..."
                                      value={newSubStepName[step.id] || ''}
                                      onChange={(e) => setNewSubStepName(prev => ({ ...prev, [step.id]: e.target.value }))}
                                      onKeyDown={(e) => e.key === 'Enter' && handleAddSubStep(selectedPart.id, step.id)}
                                      className="flex-1 bg-white border-2 border-slate-200 rounded-2xl px-5 py-2.5 text-xs font-bold text-slate-700 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all shadow-sm"
                                    />
                                    <button 
                                      onClick={() => handleAddSubStep(selectedPart.id, step.id)}
                                      className="p-3 bg-blue-600 text-white rounded-2xl hover:bg-blue-700 shadow-lg shadow-blue-100 transition-all active:scale-95"
                                    >
                                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                      </svg>
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {selectedPart.steps.length === 0 && (
                      <div className="py-20 text-center border-2 border-dashed border-slate-200 rounded-[2.5rem]">
                        <p className="text-slate-400 font-black uppercase tracking-[0.2em]">No process steps defined</p>
                        <button 
                          onClick={() => handleAddStep(selectedPart.id)}
                          className="mt-4 text-xs font-black text-blue-600 uppercase hover:underline"
                        >
                          Initialize Workflow
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Lifecycle Phases Section */}
                  <div className="mt-20 pt-10 border-t border-slate-100">
                    <div className="mb-10 flex justify-between items-end">
                      <div className="flex-1">
                        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Lifecycle Phases</h3>
                        <p className="text-sm font-bold text-slate-600">High-Level Project Milestones</p>
                      </div>
                      <div className="text-right mr-16">
                        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Standard Time</h3>
                      </div>
                      {viewMode === 'active' && (
                        <button 
                          onClick={() => handleAddPhase(selectedPart.id)}
                          className="flex items-center space-x-2 px-4 py-2 bg-slate-50 text-slate-600 rounded-xl border border-slate-200 hover:bg-slate-600 hover:text-white transition-all text-[10px] font-black uppercase tracking-widest shadow-sm"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" />
                          </svg>
                          <span>+ ADD PHASE</span>
                        </button>
                      )}
                    </div>

                    <div className="space-y-6">
                      {selectedPart.lifecyclePhases.map((phase, index) => {
                        const hasSubSteps = phase.subSteps && phase.subSteps.length > 0;
                        const isExpanded = !!phase.isExpanded;
                        const isEditing = editingStepId === phase.id;
                        
                        return (
                          <div 
                            key={phase.id} 
                            draggable={viewMode === 'active'}
                            onDragStart={() => onDragStartPhase(index)}
                            onDragOver={onDragOver}
                            onDrop={() => onDropPhase(index)}
                            className={`relative bg-white rounded-[2rem] border-2 overflow-hidden transition-all shadow-sm ${draggedPhaseIndex === index ? 'opacity-30' : 'opacity-100'} ${isEditing ? 'border-blue-400 ring-4 ring-blue-50' : 'border-slate-100'}`}
                          >
                            <div className="flex items-center group transition-all p-5 cursor-default hover:bg-slate-50/50">
                              {/* Drag Handle */}
                              <div className="mr-3 text-slate-300 cursor-move hover:text-slate-600 transition-colors">
                                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                                  <path d="M11 18c0 1.1-.9 2-2 2s-2-.9-2-2 .9-2 2-2 2 .9 2 2zm-2-8c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0-6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm6 4c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
                                </svg>
                              </div>

                              {/* Completion Indicator */}
                              <div 
                                onClick={() => viewMode === 'active' && handlePhaseToggle(selectedPart.id, phase.id)}
                                className={`w-12 h-12 rounded-2xl flex items-center justify-center border-2 transition-all duration-300 cursor-pointer shrink-0
                                  ${phase.completed ? 'bg-blue-500 border-blue-600 text-white shadow-md hover:scale-105' : 'bg-white border-slate-200 text-slate-300 shadow-sm hover:border-blue-400 hover:text-blue-500 hover:scale-105'}`}
                              >
                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                </svg>
                              </div>

                              {/* Label & Details */}
                              <div className="ml-5 flex-1 pr-4 select-none">
                                 {isEditing ? (
                                   <div className="space-y-2">
                                     <input 
                                       type="text"
                                       autoFocus
                                       onClick={(e) => e.stopPropagation()}
                                       value={phase.name}
                                       onChange={(e) => handleUpdatePhaseName(selectedPart.id, phase.id, e.target.value.toUpperCase())}
                                       onKeyDown={(e) => e.key === 'Enter' && setEditingStepId(null)}
                                       className="text-lg font-black text-slate-900 uppercase tracking-tight bg-white border-2 border-blue-500 rounded-lg px-2 w-full focus:outline-none"
                                     />
                                     <input 
                                       type="text"
                                       placeholder="Status Detail (optional)..."
                                       onClick={(e) => e.stopPropagation()}
                                       value={phase.specification || ''}
                                       onChange={(e) => handleUpdatePhaseSpecification(selectedPart.id, phase.id, e.target.value)}
                                       onKeyDown={(e) => e.key === 'Enter' && setEditingStepId(null)}
                                       className="text-[10px] font-bold text-slate-600 uppercase tracking-widest bg-white border border-slate-200 rounded px-2 w-full focus:outline-none focus:border-blue-400"
                                     />
                                     <input 
                                       type="text"
                                       placeholder="Standard Time..."
                                       onClick={(e) => e.stopPropagation()}
                                       value={phase.standardTime || ''}
                                       onChange={(e) => handleUpdatePhaseStandardTime(selectedPart.id, phase.id, e.target.value)}
                                       onBlur={() => setEditingStepId(null)}
                                       onKeyDown={(e) => e.key === 'Enter' && setEditingStepId(null)}
                                       className="text-[10px] font-bold text-slate-600 uppercase tracking-widest bg-white border border-slate-200 rounded px-2 w-full focus:outline-none focus:border-blue-400"
                                     />
                                   </div>
                                 ) : (
                                   <div className="flex items-center justify-between">
                                     <span className="text-lg font-black text-slate-900 uppercase tracking-tight block truncate">
                                       {phase.name || "UNNAMED PHASE"}
                                     </span>
                                     <span className="text-xs font-black text-slate-400 uppercase tracking-widest bg-slate-50 px-3 py-1 rounded-lg border border-slate-200">
                                       {phase.standardTime || "—"}
                                     </span>
                                   </div>
                                 )}
                                <div className="flex items-center space-x-3 mt-0.5">
                                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                    {phase.specification ? phase.specification : 'Milestone Tracking'}
                                  </p>
                                  {phase.isOptional && (
                                    <span className="text-[8px] font-black text-blue-600 border border-blue-200 px-2 py-0.5 rounded-full uppercase tracking-widest bg-blue-50">
                                      Phase Optional
                                    </span>
                                  )}
                                </div>
                              </div>
                              
                              {/* Action Buttons */}
                              <div className="flex items-center space-x-3">
                                {viewMode === 'active' && (
                                  <div className="flex items-center space-x-2">
                                    <button 
                                      onClick={(e) => { e.stopPropagation(); setEditingStepId(isEditing ? null : phase.id); }}
                                      className={`p-2 rounded-xl border transition-all ${isEditing ? 'bg-blue-600 border-blue-700 text-white' : 'bg-white border-slate-200 text-slate-400 hover:border-blue-400 hover:text-blue-500'}`}
                                      title="Edit Phase"
                                    >
                                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                      </svg>
                                    </button>
                                    
                                    <button 
                                      onClick={(e) => { e.stopPropagation(); handleTogglePhaseOptional(selectedPart.id, phase.id); }}
                                      className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-all ${phase.isOptional ? 'bg-blue-500 border-blue-600 text-white shadow-sm' : 'bg-white border-slate-300 text-slate-400 hover:border-blue-400 hover:text-blue-500'}`}
                                    >
                                      Optional
                                    </button>
                                    <button 
                                      onClick={(e) => { e.stopPropagation(); handleRemovePhase(selectedPart.id, phase.id); }}
                                      className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all"
                                    >
                                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-4v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                      </svg>
                                    </button>
                                  </div>
                                )}
                                
                                <button 
                                  onClick={(e) => { e.stopPropagation(); togglePhaseCollapse(selectedPart.id, phase.id); }}
                                  className="p-2 text-slate-400 hover:text-slate-900 transition-all rounded-full hover:bg-slate-100 ring-1 ring-slate-200"
                                  title={isExpanded ? "Collapse Details" : "Expand Details"}
                                >
                                  <svg className={`w-6 h-6 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                  </svg>
                                </button>
                              </div>
                            </div>

                            {isExpanded && (
                              <div className="px-6 pb-6 pt-2 bg-slate-50/30 border-t border-slate-50 animate-in slide-in-from-top-4 duration-300">
                                <div className="space-y-6 px-14">
                                  {/* Phase Notes */}
                                  <div>
                                    <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Phase Intelligence Notes</label>
                                    <textarea 
                                      rows={3}
                                      value={phase.notes || ''}
                                      onChange={(e) => handleUpdatePhaseNotes(selectedPart.id, phase.id, e.target.value)}
                                      placeholder="Add phase-specific status updates or requirements..."
                                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 shadow-sm resize-none"
                                    />
                                  </div>

                                  {/* Sub-Steps */}
                                  <div className="space-y-3">
                                    <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Operational Checkpoints</label>
                                    {phase.subSteps?.map((subStep) => (
                                      <div 
                                        key={subStep.id}
                                        className={`group flex items-center p-3 rounded-xl border transition-all
                                          ${subStep.completed ? 'bg-blue-50/60 border-blue-100 shadow-sm' : 'bg-white border-slate-200 hover:border-blue-300 shadow-sm'}`}
                                      >
                                        <div 
                                          onClick={() => viewMode === 'active' && handleSubStepTogglePhase(selectedPart.id, phase.id, subStep.id)}
                                          className={`w-5 h-5 rounded-lg border-2 flex items-center justify-center transition-all shrink-0 cursor-pointer
                                            ${subStep.completed ? 'bg-blue-500 border-blue-600 text-white shadow-sm' : 'bg-white border-slate-300 hover:border-blue-500'}`}
                                        >
                                          {subStep.completed && (
                                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M5 13l4 4L19 7" />
                                            </svg>
                                          )}
                                        </div>
                                        
                                        <div 
                                          className="ml-3 flex-1 cursor-pointer select-none"
                                          onClick={() => viewMode === 'active' && handleSubStepTogglePhase(selectedPart.id, phase.id, subStep.id)}
                                        >
                                          <span className={`text-[11px] font-bold tracking-wide uppercase ${subStep.completed ? 'text-blue-700 line-through opacity-60' : 'text-slate-700'}`}>
                                            {subStep.name}
                                          </span>
                                        </div>
                                        
                                        {viewMode === 'active' && (
                                          <button 
                                            onClick={() => handleRemoveSubStepPhase(selectedPart.id, phase.id, subStep.id)}
                                            className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                          >
                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-4v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                            </svg>
                                          </button>
                                        )}
                                      </div>
                                    ))}

                                    {viewMode === 'active' && (
                                      <div className="mt-4 flex items-center space-x-2">
                                        <input 
                                          type="text"
                                          placeholder="Add milestone checkpoint..."
                                          value={newSubStepName[phase.id] || ''}
                                          onChange={(e) => setNewSubStepName(prev => ({ ...prev, [phase.id]: e.target.value }))}
                                          onKeyDown={(e) => e.key === 'Enter' && handleAddSubStepPhase(selectedPart.id, phase.id)}
                                          className="flex-1 bg-white border border-slate-200 rounded-xl px-4 py-2 text-[11px] font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition-all shadow-sm"
                                        />
                                        <button 
                                          onClick={() => handleAddSubStepPhase(selectedPart.id, phase.id)}
                                          className="p-2 bg-slate-800 text-white rounded-xl hover:bg-black shadow-md transition-all active:scale-95"
                                        >
                                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                          </svg>
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Sidebar Configuration Panel */}
                <div className="lg:col-span-4 bg-slate-50 p-10 space-y-8 border-l border-slate-100 flex flex-col h-full min-h-[600px]">
                  <div className={`p-7 rounded-[2rem] border-2 shadow-sm ${
                    getScheduleStatus(selectedPart) === 'ahead' ? 'bg-emerald-50 border-emerald-200' :
                    getScheduleStatus(selectedPart) === 'on-time' ? 'bg-amber-50 border-amber-200' :
                    'bg-rose-50 border-rose-200'
                  }`}>
                    <ProgressBar part={selectedPart} />
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Unit Volume</label>
                    <input 
                      type="number"
                      disabled={viewMode === 'finished'}
                      value={selectedPart.quantity}
                      onChange={(e) => updatePart({ ...selectedPart, quantity: parseInt(e.target.value) || 0 })}
                      className="w-full bg-white border-2 border-slate-300 rounded-2xl px-6 py-3.5 font-black text-slate-800 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all shadow-sm disabled:opacity-50"
                    />
                  </div>

                  <div className="space-y-4">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Service Timeline</h4>
                    <div className="grid grid-cols-1 gap-4">
                      <div>
                        <div className="flex justify-between items-center mb-1.5 px-1">
                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Start Date</label>
                          <button 
                            disabled={viewMode === 'finished'}
                            onClick={() => updatePart({...selectedPart, estStartDate: 'TBD'})}
                            className="text-[9px] font-black text-blue-600 uppercase hover:underline"
                          >
                            Set TBD
                          </button>
                        </div>
                        <input 
                          type="text"
                          disabled={viewMode === 'finished'}
                          value={selectedPart.estStartDate}
                          onChange={(e) => updatePart({ ...selectedPart, estStartDate: e.target.value })}
                          placeholder="YYYY-MM-DD"
                          className="w-full bg-white border-2 border-slate-300 rounded-2xl px-5 py-3.5 text-sm font-bold text-slate-700 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 shadow-sm disabled:opacity-50"
                        />
                      </div>
                      <div>
                        <div className="flex justify-between items-center mb-1.5 px-1">
                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Target Finish</label>
                          <button 
                            disabled={viewMode === 'finished'}
                            onClick={() => updatePart({...selectedPart, estFinishDate: 'TBD'})}
                            className="text-[9px] font-black text-blue-600 uppercase hover:underline"
                          >
                            Set TBD
                          </button>
                        </div>
                        <input 
                          type="text"
                          disabled={viewMode === 'finished'}
                          value={selectedPart.estFinishDate}
                          onChange={(e) => updatePart({ ...selectedPart, estFinishDate: e.target.value })}
                          placeholder="YYYY-MM-DD"
                          className="w-full bg-white border-2 border-slate-300 rounded-2xl px-5 py-3.5 text-sm font-bold text-slate-700 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 shadow-sm disabled:opacity-50"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex-1">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Process Intelligence Notes</label>
                    <textarea 
                      rows={6}
                      disabled={viewMode === 'finished'}
                      value={selectedPart.notes}
                      onChange={(e) => updatePart({ ...selectedPart, notes: e.target.value })}
                      placeholder="Add critical requirements or inspection notes..."
                      className="w-full bg-white border-2 border-slate-300 rounded-2xl px-6 py-5 text-sm font-medium text-slate-700 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 shadow-sm resize-none disabled:opacity-50 h-[150px]"
                    />
                  </div>

                  <div className="pt-10 border-t border-slate-200 mt-auto">
                    <button 
                      onClick={() => handleDeletePart(selectedPart.id)}
                      className="w-full flex items-center justify-center space-x-3 px-6 py-4 bg-white text-rose-500 border-2 border-rose-100 rounded-[1.5rem] hover:bg-rose-500 hover:text-white hover:border-rose-600 transition-all text-xs font-black uppercase tracking-widest shadow-sm active:scale-95"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-4v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      <span>Terminate Part Record</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <footer className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-20 border-t border-slate-200 py-16 flex flex-col md:flex-row justify-between items-center text-slate-400 space-y-6 md:space-y-0">
        <div className="flex flex-col items-center md:items-start text-center md:text-left">
          <p className="text-[11px] font-black uppercase tracking-[0.4em] text-slate-600">ServiceTrack Pro</p>
          <p className="text-[10px] font-medium mt-1.5">Industrial Asset Lifecycle Orchestration & Monitoring</p>
        </div>
        <div className="flex space-x-6">
           <span className="text-[10px] font-black uppercase tracking-widest px-2 py-1 bg-slate-100 rounded text-slate-500 border border-slate-200">v3.2.4-STABLE</span>
        </div>
      </footer>
    </div>
  );
};

export default App;
