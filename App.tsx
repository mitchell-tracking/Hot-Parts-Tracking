import { supabase } from './supabaseClient';
import React, { useState, useMemo, useEffect } from 'react';
import { Part, ViewMode } from './types';
import { INITIAL_PARTS, createCastingProcess, createDefaultLifecyclePhases } from './constants';
import { ProgressBar } from './components/ProgressBar';

const App: React.FC = () => {
  const [parts, setParts] = useState<Part[]>([]);
  const [finishedParts, setFinishedParts] = useState<Part[]>([]);
  const [selectedPartId, setSelectedPartId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('active');

  const activeParts = useMemo(() => parts, [parts]);
  const displayedParts = viewMode === 'active' ? activeParts : finishedParts;
  const selectedPart = displayedParts.find(p => p.id === selectedPartId) || null;

  // 1. FETCH DATA: Load from Supabase when the app starts
  useEffect(() => {
    const fetchParts = async () => {
      const { data, error } = await supabase
        .from('Parts')
        .select('*');
      
      if (error) {
        console.error("Error fetching parts:", error);
      } else if (data && data.length > 0) {
        setParts(data);
      } else {
        // Fallback to initial constants if database is empty
        setParts(INITIAL_PARTS);
      }
    };

    fetchParts();
  }, []);

  // Handle scroll lock for modals
  useEffect(() => {
    document.body.style.overflow = selectedPart ? 'hidden' : 'unset';
  }, [selectedPart]);

  // 2. SAVE DATA: Logic for adding a new part
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

    const { error } = await supabase
      .from('Parts')
      .insert([newPart]);

    if (error) {
      console.error("Error saving part:", error);
      alert("Error saving to database. Make sure your table name is 'Parts' and RLS policies are set.");
    } else {
      setParts(prev => [...prev, newPart]);
      setSelectedPartId(newId);
      setViewMode('active');
    }
  };

  const updatePart = async (updatedPart: Part) => {
    // Local UI update
    if (viewMode === 'active') {
      setParts(prev => prev.map(p => p.id === updatedPart.id ? updatedPart : p));
    } else {
      setFinishedParts(prev => prev.map(p => p.id === updatedPart.id ? updatedPart : p));
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white p-8">
      <header className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-blue-400">Servicetrack Pro</h1>
          <p className="text-slate-400">Industrial Asset Lifecycle Orchestration</p>
        </div>
        <button 
          onClick={handleNewPart}
          className="bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-lg font-semibold transition"
        >
          + New Part
        </button>
      </header>

      <div className="grid gap-4">
        {displayedParts.map(part => (
          <div 
            key={part.id} 
            onClick={() => setSelectedPartId(part.id)}
            className="bg-slate-800 p-6 rounded-xl border border-slate-700 cursor-pointer hover:border-blue-500 transition"
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold">{part.name}</h3>
              <span className="text-slate-400">Qty: {part.quantity}</span>
            </div>
            <ProgressBar part={part} />
          </div>
        ))}
      </div>
    </div>
  );
};

export default App;
