import { supabase } from './src/supabaseClient';
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

  useEffect(() => {
    const fetchParts = async () => {
      const { data, error } = await supabase
        .from('Parts')
        .select('*');
      
      if (error) {
        console.error("Error fetching:", error);
      } else if (data && data.length > 0) {
        setParts(data);
      } else {
        setParts(INITIAL_PARTS);
      }
    };
    fetchParts();
  }, []);

  useEffect(() => {
    document.body.style.overflow = selectedPart ? 'hidden' : 'unset';
  }, [selectedPart]);

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

    const { error } = await supabase.from('Parts').insert([newPart]);

    if (error) {
      console.error("Error saving:", error);
      alert("Database error. Check your Supabase RLS policies.");
    } else {
      setParts(prev => [...prev, newPart]);
      setSelectedPartId(newId);
      setViewMode('active');
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
