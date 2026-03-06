import { neon } from '@neondatabase/serverless';
import React, { useState, useMemo, useEffect } from 'react';
import { Part, ProcessStep, SubStep } from './types';
import { INITIAL_PARTS, createCastingProcess, createDefaultLifecyclePhases } from './constants';
import { ProgressBar, getScheduleStatus } from './components/ProgressBar';

type ViewMode = 'active' | 'finished';

const App: React.FC = () => {
  const [parts, setParts] = useState<Part[]>([]);
  const [finishedParts, setFinishedParts] = useState<Part[]>([]);
  const [selectedPartId, setSelectedPartId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('active');
  const [newSubStepName, setNewSubStepName] = useState<{ [key: string]: string }>({});
  const [editingStepId, setEditingStepId] = useState<string | null>(null);
  const [draggedStepIndex, setDraggedStepIndex] = useState<number | null>(null);
  const [draggedPhaseIndex, setDraggedPhaseIndex] = useState<number | null>(null);

  const activeParts = useMemo(() => parts, [parts]);

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
      setParts(prev => [newPart, ...prev]);
      setSelectedPartId(newId);
    }
  };

  const toggleSubStep = (part: Part, stepIndex: number, subStepId: string) => {
    const newSteps = [...part.steps];
    const step = { ...newSteps[stepIndex] };
    step.subSteps = step.subSteps.map(ss => ss.id === subStepId ? { ...ss, completed: !ss.completed } : ss);
    newSteps[stepIndex] = step;
    updatePart({ ...part, steps: newSteps });
  };

  const handleAddSubStep = (part: Part, stepIndex: number) => {
    const name = newSubStepName[part.steps[stepIndex].id];
    if (!name?.trim()) return;
    const newSteps = [...part.steps];
    const step = { ...newSteps[stepIndex] };
    const newSubStep: SubStep = { id: `ss-${Date.now()}`, name: name.trim(), completed: false };
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
    const newStep: ProcessStep = { id: `step-${Date.now()}`, name: 'New Process Step', status: 'pending', subSteps: [] };
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
              <button onClick={() => setViewMode('active')} className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${viewMode === 'active' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>Active</button>
              <button onClick={() => setViewMode('finished')} className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${viewMode === 'finished' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>Finished</button>
            </div>
            <button onClick={handleNewPart} className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-all shadow-lg shadow-blue-100 flex items-center gap-2 active:scale-95">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4"><path d="M12 5v14M5 12h14" /></svg>
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
              <div key={part.id} onClick={() => setSelectedPartId(part.id)} className="group bg-white rounded-2xl border border-slate-200 p-5 cursor-pointer hover:border-blue-300 hover:shadow-xl hover:shadow-blue-50/50 transition-all active:scale-[0.99]">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 group-hover:text-blue-600 transition-colors">{part.name}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded uppercase tracking-tighter">Qty: {part.quantity}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${schedule.isOverdue ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'}`}>{schedule.statusLabel}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Current Status</div>
                    <div className="flex gap-1.5 justify-end">
                      {['TRN', 'DV', 'CH'].map(status => (
                        <span key={status} className={`w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-black border-2 ${part.status === status ? 'bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-100' : 'bg-white border-slate-100 text-slate-300 group-hover:border-slate-200'}`}>{status}</span>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="space-y-4">
                  <ProgressBar part={part} />
                  <div className="pt-4 border-t border-slate-50 flex justify-between items-center text-[11px] font-bold">
                    <div className="flex items-center gap-1.5 text-slate-500"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5"><path d="M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z" /></svg>{part.estFinishDate}</div>
                    <div className="text-blue-600 bg-blue-50 px-2.5 py-1 rounded-lg group-hover:bg-blue-600 group-hover:text-white transition-all">View Details →</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        {displayedParts.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 text-slate-400">
            <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-4"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-10 h-10"><path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg></div>
            <p className="text-lg font-medium">No {viewMode} parts found</p>
            <p className="text-sm">Click "New Part" to start tracking</p>
          </div>
        )}
      </main>

      {selectedPart && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-8 animate-in fade-in duration-200">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setSelectedPartId(null)} />
          <div className="relative bg-white w-full max-w-5xl max-h-full rounded-3xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
            <div className="p-6 md:p-8 border-b border-slate-100 flex justify-between items-center bg-white sticky top-0 z-10">
              <div className="flex items-center gap-5">
                <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-8 h-8"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" /></svg></div>
                <div>
                  <div className="flex items-center gap-3">
                    <h2 className="text-2xl font-black text-slate-900 tracking-tight">{selectedPart.name}</h2>
                    <span className="bg-slate-100 text-slate-500 text-[10px] font-black px-2.5 py-1 rounded-lg uppercase tracking-widest">ID: {selectedPart.id}</span>
                  </div>
                  <div className="flex gap-4 mt-2">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500"><span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse"></span>Status: {selectedPart.status}</div>
                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500">Quantity: {selectedPart.quantity}</div>
                  </div>
                </div>
              </div>
              <button onClick={() => setSelectedPartId(null)} className="p-3 hover:bg-slate-100 rounded-2xl transition-colors text-slate-400 hover:text-slate-900 active:scale-90"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="w-6 h-6"><path d="M18 6L6 18M6 6l12 12" /></svg></button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 md:p-8">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-6">
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight flex items-center gap-2"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="w-4 h-4 text-blue-600"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>Process Roadmap</h3>
                    <button onClick={() => handleAddStep(selectedPart)} className="text-[11px] font-bold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg hover:bg-blue-600 hover:text-white transition-all flex items-center gap-1.5"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="w-3 h-3"><path d="M12 5v14M5 12h14" /></svg>Add Phase</button>
                  </div>
                  <div className="space-y-4">
                    {selectedPart.steps.map((step, stepIndex) => (
                      <div key={step.id} draggable onDragStart={() => handleDragStart(stepIndex, 'step')} onDragOver={handleDragOver} onDrop={() => handleDrop(selectedPart, stepIndex, 'step')} className={`bg-slate-50/50 rounded-2xl border-2 transition-all overflow-hidden ${editingStepId === step.id ? 'border-blue-200 bg-blue-50/30' : 'border-slate-100 hover:border-slate-200'}`}>
                        <div className="p-4 flex justify-between items-center">
                          <div className="flex items-center gap-3">
                            <div className="cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-400 p-1"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="w-4 h-4"><path d="M8 9h8M8 15h8" /></svg></div>
                            {editingStepId === step.id ? (
                              <input autoFocus value={step.name} onChange={(e) => { const newSteps = [...selectedPart.steps]; newSteps[stepIndex].name = e.target.value; updatePart({ ...selectedPart, steps: newSteps }); }} onBlur={() => setEditingStepId(null)} onKeyDown={(e) => e.key === 'Enter' && setEditingStepId(null)} className="bg-white border border-blue-200 rounded px-2 py-1 font-bold text-slate-900 outline-none focus:ring-2 ring-blue-100" />
                            ) : (
                              <span onClick={() => setEditingStepId(step.id)} className="font-bold text-slate-800 cursor-text hover:text-blue-600">{step.name}</span>
                            )}
                            <span className="text-[10px] font-black text-slate-400 bg-white px-2 py-0.5 rounded border border-slate-100 uppercase tracking-widest">{step.subSteps.filter(s => s.completed).length}/{step.subSteps.length} Tasks</span>
                          </div>
                          <button onClick={() => handleRemoveStep(selectedPart, stepIndex)} className="p-1.5 text-slate-300 hover:text-red-500 transition-colors"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
                        </div>
                        <div className="px-11 pb-4 space-y-2">
                          {step.subSteps.map(ss => (
                            <div key={ss.id} className="group/item flex items-center justify-between bg-white/80 p-2.5 rounded-xl border border-slate-100 hover:border-blue-100 hover:shadow-sm transition-all">
                              <label className="flex items-center gap-3 cursor-pointer flex-1">
                                <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${ss.completed ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-200 bg-white'}`}>{ss.completed && <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" className="w-3 h-3"><path d="M20 6L9 17l-5-5" /></svg>}</div>
                                <input type="checkbox" className="hidden" checked={ss.completed} onChange={() => toggleSubStep(selectedPart, stepIndex, ss.id)} />
                                <span className={`text-sm font-semibold transition-all ${ss.completed ? 'text-slate-400 line-through' : 'text-slate-700'}`}>{ss.name}</span>
                              </label>
                              <button onClick={() => handleRemoveSubStep(selectedPart, stepIndex, ss.id)} className="opacity-0 group-hover/item:opacity-100 p-1 text-slate-300 hover:text-red-500 transition-all"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-3.5 h-3.5"><path d="M6 18L18 6M6 6l12 12" /></svg></button>
                            </div>
                          ))}
                          <div className="pt-2">
                            <div className="relative group">
                              <input type="text" placeholder="Add custom sub-step..." value={newSubStepName[step.id] || ''} onChange={(e) => setNewSubStepName(prev => ({ ...prev, [step.id]: e.target.value }))} onKeyDown={(e) => e.key === 'Enter' && handleAddSubStep(selectedPart, stepIndex)} className="w-full bg-white/50 border border-slate-200 rounded-xl px-4 py-2 text-sm font-medium outline-none focus:bg-white focus:border-blue-300 focus:ring-4 ring-blue-50 transition-all pr-10" />
                              <button onClick={() => handleAddSubStep(selectedPart, stepIndex)} className="absolute right-2 top-1.5 p-1 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="w-4 h-4"><path d="M12 5v14M5 12h14" /></svg></button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="space-y-8">
                  <div className="bg-slate-900 rounded-3xl p-6 text-white shadow-xl">
                    <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-500 mb-6">Tracking Summary</h3>
                    <div className="space-y-6">
                      <div>
                        <div className="text-[10px] font-bold text-slate-500 uppercase mb-2">Completion Progress</div>
                        <div className="flex items-end gap-3 mb-2">
                          <div className="text-4xl font-black text-blue-400">{Math.round((selectedPart.steps.flatMap(s => s.subSteps).filter(ss => ss.completed).length / Math.max(1, selectedPart.steps.flatMap(s => s.subSteps).length)) * 100)}%</div>
                          <div className="text-[10px] font-bold text-slate-400 pb-1 mb-1">UNITS VERIFIED</div>
                        </div>
                        <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden">
                          <div className="bg-blue-500 h-full transition-all duration-1000 ease-out shadow-[0_0_15px_rgba(59,130,246,0.5)]" style={{ width: `${(selectedPart.steps.flatMap(s => s.subSteps).filter(ss => ss.completed).length / Math.max(1, selectedPart.steps.flatMap(s => s.subSteps).length)) * 100}%` }} />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
                          <div className="text-[10px] font-bold text-slate-500 uppercase mb-1">Start Date</div>
                          <div className="text-sm font-bold text-slate-200">{selectedPart.estStartDate}</div>
                        </div>
                        <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
                          <div className="text-[10px] font-bold text-slate-500 uppercase mb-1">Deadline</div>
                          <div className="text-sm font-bold text-slate-200">{selectedPart.estFinishDate}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 px-1">Phase Management</h3>
                    <div className="space-y-2">
                      {selectedPart.lifecyclePhases.map((phase, phaseIndex) => (
                        <div key={phase.id} draggable onDragStart={() => handleDragStart(phaseIndex, 'phase')} onDragOver={handleDragOver} onDrop={() => handleDrop(selectedPart, phaseIndex, 'phase')} className="flex items-center justify-between p-3.5 bg-white border border-slate-100 rounded-2xl hover:border-blue-100 hover:shadow-md transition-all cursor-move group">
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black ${phase.status === 'completed' ? 'bg-emerald-50 text-emerald-600' : phase.status === 'in-progress' ? 'bg-blue-50 text-blue-600' : 'bg-slate-50 text-slate-400'}`}>{phaseIndex + 1}</div>
                            <span className="text-sm font-bold text-slate-700">{phase.name}</span>
                          </div>
                          <div className="flex items-center gap-2"><div className={`w-2 h-2 rounded-full ${phase.status === 'completed' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]' : phase.status === 'in-progress' ? 'bg-blue-500 animate-pulse' : 'bg-slate-200'}`} /></div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-4">
                    <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 px-1">Log / Notes</h3>
                    <textarea value={selectedPart.notes} onChange={(e) => updatePart({ ...selectedPart, notes: e.target.value })} placeholder="Add production notes here..." className="w-full h-32 bg-slate-50 border border-slate-100 rounded-2xl p-4 text-sm font-medium outline-none focus:bg-white focus:border-blue-300 transition-all resize-none shadow-inner" />
                  </div>
                </div>
              </div>
            </div>
            <div className="p-6 md:p-8 bg-slate-50 border-t border-slate-100 flex justify-end items-center gap-4">
              <button onClick={() => setSelectedPartId(null)} className="px-6 py-2.5 text-sm font-bold text-slate-500 hover:text-slate-900 transition-colors">Close</button>
              <button onClick={() => { if (viewMode === 'active') { setFinishedParts(prev => [...prev, selectedPart]); setParts(prev => prev.filter(p => p.id !== selectedPart.id)); } else { setParts(prev => [...prev, selectedPart]); setFinishedParts(prev => prev.filter(p => p.id !== selectedPart.id)); } setSelectedPartId(null); }} className={`px-8 py-2.5 rounded-xl text-sm font-black transition-all shadow-lg active:scale-95 ${viewMode === 'active' ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-100' : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-100'}`}>{viewMode === 'active' ? 'Mark as Finished' : 'Move to Active'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
