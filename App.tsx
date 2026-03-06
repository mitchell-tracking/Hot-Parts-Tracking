import { neon } from '@neondatabase/serverless';
import React, { useState, useMemo, useEffect } from 'react';
import { Part, ProcessStep, SubStep } from './types';
import { INITIAL_PARTS, createCastingProcess, createDefaultLifecyclePhases } from './constants';
import { ProgressBar, getScheduleStatus } from './components/ProgressBar';

type ViewMode = 'active' | 'finished';

const App: React.FC = () => {
  // We start with an empty array and let the database fill it
  const [parts, setParts] = useState<Part[]>([]);
  const [finishedParts, setFinishedParts] = useState<Part[]>([]);
  const [selectedPartId, setSelectedPartId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('active');
  const [newSubStepName, setNewSubStepName] = useState<{ [key: string]: string }>({});
  const [editingStepId, setEditingStepId] = useState<string | null>(null);
  const [draggedStepIndex, setDraggedStepIndex] = useState<number | null>(null);
  const [draggedPhaseIndex, setDraggedPhaseIndex] = useState<number | null>(null);

  const activeParts = useMemo(() => parts, [parts]);

  // --- DATABASE LOAD LOGIC ---
  useEffect(() => {
    const loadParts = async () => {
      try {
        const sql = neon(process.env.DATABASE_URL!);
        const data = await sql('SELECT * FROM parts ORDER BY updated_at DESC');
        
        if (data && data.length > 0) {
          const formattedParts = data.map(row => ({
            ...row,
            steps: typeof row.steps === 'string' ? JSON.parse(row.steps) : row.steps || [],
            lifecyclePhases: typeof row.lifecycle_phases === 'string' ? JSON.parse(row.lifecycle_phases) : row.lifecycle_phases || []
          }));
          setParts(formattedParts);
        } else {
          // If database is empty, show the initial demo parts
          setParts(INITIAL_PARTS);
        }
      } catch (error) {
        console.error("Database Load Error:", error);
        setParts(INITIAL_PARTS);
      }
    };
    loadParts();
  }, []);

  const displayedParts = viewMode === 'active' ? activeParts : finishedParts;
  const selectedPart = displayedParts.find(p => p.id === selectedPartId) || null;

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

  // --- DATABASE SAVE LOGIC ---
  const handleNewPart = async () => {
    const newId = `part-${Date.now()}`;
    const newPart: Part = {
      id: newId,
      name: `PART-${parts.length + 1}`,
      quantity: 1,
      estStartDate: new Date().toISOString().split('T')[0],
      estFinishDate: 'TBD',
      steps: [createCastingProcess(0)],
      lifecyclePhases: createDefaultLifecyclePhases(),
      currentStepIndex: 0,
      notes: 'Initial entry.'
    };

    try {
      const sql = neon(process.env.DATABASE_URL!);
      await sql(`
        INSERT INTO parts (id, name, status, quantity, est_start_date, est_finish_date, steps, lifecycle_phases, notes)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [
        newPart.id, 
        newPart.name, 
        'TRN', 
        newPart.quantity, 
        newPart.estStartDate, 
        newPart.estFinishDate, 
        JSON.stringify(newPart.steps), 
        JSON.stringify(newPart.lifecyclePhases), 
        newPart.notes
      ]);
      
      setParts(prev => [newPart, ...prev]);
      setSelectedPartId(newId);
    } catch (error) {
      console.error("Database Save Error:", error);
      // Fallback: update UI even if DB fails so user isn't stuck
      setParts(prev => [newPart, ...prev]);
      setSelectedPartId(newId);
    }
  };

  const toggleSubStep = (part: Part, stepIndex: number, subStepId: string) => {
    const newSteps = [...part.steps];
    const step = { ...newSteps[stepIndex] };
    step.subSteps = step.subSteps.map(ss => 
      ss.id === subStepId ? { ...ss, completed: !ss.completed } : ss
    );
    newSteps[stepIndex] = step;
    updatePart({ ...part, steps: newSteps });
  };

  const handleAddSubStep = (part: Part, stepIndex: number) => {
    const name = newSubStepName[part.steps[stepIndex].id];
    if (!name?.trim()) return;

    const newSteps = [...part.steps];
    const step = { ...newSteps[stepIndex] };
    const newSubStep: SubStep = {
      id: `ss-${Date.now()}`,
      name: name.trim(),
      completed: false
    };
    step.subSteps = [...step.subSteps, newSubStep];
    newSteps[stepIndex] = step;

    updatePart({ ...part, steps: newSteps });
    setNewSubStepName(prev => ({ ...prev, [part.steps[stepIndex].id]: '' }));
  };

  const handleRemoveSubStep = (part: Part, stepIndex: number, subStepId: string) => {
    const newSteps = [...part.steps];
    const step = { ...newSteps[stepIndex] };
    step.subSteps = step.subSteps.filter(ss => ss.id !== subStepId);
    newSteps[stepIndex] = step;
    updatePart({ ...part, steps: newSteps });
  };

  const handleAddStep = (part: Part) => {
    const newStep: ProcessStep = {
      id: `step-${Date.now()}`,
      name: 'New Process Step',
      status: 'pending',
      subSteps: []
    };
    updatePart({ ...part, steps: [...part.steps, newStep] });
  };

  const handleRemoveStep = (part: Part, stepIndex: number) => {
    const newSteps = part.steps.filter((_, i) => i !== stepIndex);
    updatePart({ ...part, steps: newSteps });
  };

  const handleDragStart = (index: number, type: 'step' | 'phase') => {
    if (type === 'step') setDraggedStepIndex(index);
    else setDraggedPhaseIndex(index);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (part: Part, targetIndex: number, type: 'step' | 'phase') => {
    if (type === 'step' && draggedStepIndex !== null) {
      const newSteps = [...part.steps];
      const [draggedItem] = newSteps.splice(draggedStepIndex, 1);
      newSteps.splice(targetIndex, 0, draggedItem);
      updatePart({ ...part, steps: newSteps });
      setDraggedStepIndex(null);
    } else if (type === 'phase' && draggedPhaseIndex !== null) {
      const newPhases = [...part.lifecyclePhases];
      const [draggedItem] = newPhases.splice(draggedPhaseIndex, 1);
      newPhases.splice(targetIndex, 0, draggedItem);
      updatePart({ ...part, lifecyclePhases: newPhases });
      setDraggedPhaseIndex(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-20">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 px-6 py-4 shadow-sm">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center text-white shadow-blue-200 shadow-lg">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-6 h-6">
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900">ServiceTrack Pro</h1>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Industrial Parts Monitor</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex bg-slate-100 p-1 rounded-xl">
              <button 
                onClick={() => setViewMode('active')}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${viewMode === 'active' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
              >
                Active
              </button>
              <button 
                onClick={() => setViewMode('finished')}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${viewMode === 'finished' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
              >
                Finished
              </button>
            </div>
            <button 
              onClick={handleNewPart}
              className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-all shadow-lg shadow-blue-100 flex items-center gap-2 active:scale-95"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4">
                <path d="M12 5v14M5 12h14" />
              </svg>
              New Part
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {displayedParts.map(part => {
            const schedule = getScheduleStatus(part.estStartDate, part.estFinishDate);
            return (
              <div 
                key={part.id}
                onClick={() => setSelectedPartId(part.id)}
                className="group bg-white rounded-2xl border border-slate-200 p-5 cursor-pointer hover:border-blue-300 hover:shadow-xl hover:shadow-blue-50/50 transition-all active:scale-[0.99]"
              >
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 group-hover:text-blue-600 transition-colors">{part.name}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded uppercase tracking-tighter">Qty: {part.quantity}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                        schedule.isOverdue ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'
                      }`}>
                        {schedule.statusLabel}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Current Status</div>
                    <div className="flex gap-1.5 justify-end">
                      {['TRN', 'DV', 'CH'].map(status => (
                        <span 
                          key={status}
                          className={`w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-black border-2 ${
                            part.status === status 
                              ? 'bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-100' 
                              : 'bg-white border-slate-100 text-slate-300 group-hover:border-slate-200'
                          }`}
                        >
                          {status}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <ProgressBar part={part} />
                  
                  <div className="pt-4 border-t border-slate-50 flex justify-between items-center text-[11px] font-bold">
                    <div
