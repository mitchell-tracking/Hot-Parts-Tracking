
import React from 'react';
import { Part, ProcessStep } from '../types';

interface ProgressBarProps {
  part: Part;
}

export type ScheduleStatus = 'ahead' | 'on-time' | 'behind';

export const getScheduleStatus = (part: Part): ScheduleStatus => {
  if (part.estStartDate === 'TBD' || part.estFinishDate === 'TBD') return 'on-time';

  const start = new Date(part.estStartDate).getTime();
  const end = new Date(part.estFinishDate).getTime();
  const now = new Date().getTime();

  if (isNaN(start) || isNaN(end)) return 'on-time';
  
  const totalDuration = end - start;
  if (totalDuration <= 0) return 'on-time';

  const elapsed = now - start;
  const expectedProgress = Math.max(0, Math.min(1, elapsed / totalDuration));

  const workUnits = part.steps.flatMap(s => 
    s.subSteps && s.subSteps.length > 0 ? s.subSteps : [s]
  );
  const total = workUnits.length;
  const completed = workUnits.filter(u => u.completed).length;
  const actualProgress = total > 0 ? completed / total : 0;

  if (actualProgress > expectedProgress + 0.1) return 'ahead';
  if (actualProgress < expectedProgress - 0.1 || (now > end && actualProgress < 1)) return 'behind';
  return 'on-time';
};

export const ProgressBar: React.FC<ProgressBarProps> = ({ part }) => {
  const workUnits = part.steps.flatMap(s => 
    s.subSteps && s.subSteps.length > 0 ? s.subSteps : [s]
  );
  
  const total = workUnits.length;
  const completed = workUnits.filter(u => u.completed).length;
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
  
  const status = getScheduleStatus(part);
  
  const colorMap = {
    ahead: 'bg-emerald-500',
    'on-time': 'bg-amber-400',
    behind: 'bg-rose-500'
  };

  const textMap = {
    ahead: 'text-emerald-600',
    'on-time': 'text-amber-600',
    behind: 'text-rose-600'
  };

  let currentUnitCount = 0;
  const markers = part.steps.map((step, index) => {
    const pos = (currentUnitCount / total) * 100;
    const unitsInStep = step.subSteps && step.subSteps.length > 0 ? step.subSteps.length : 1;
    currentUnitCount += unitsInStep;
    
    let bubbleColorClass = 'bg-slate-300 border-slate-400';
    if (step.completed) {
      bubbleColorClass = 'bg-emerald-500 border-emerald-600';
    } else {
      if (status === 'behind') {
        bubbleColorClass = 'bg-rose-500 border-rose-600';
      } else if (status === 'on-time') {
        bubbleColorClass = 'bg-amber-400 border-amber-500';
      } else if (status === 'ahead') {
        bubbleColorClass = 'bg-emerald-500 border-emerald-600';
      }
    }

    return { pos, name: step.name, completed: step.completed, bubbleColorClass };
  });

  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-2">
        <div className="flex items-center space-x-2">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Service Status</span>
          <span className={`text-[10px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded border ${
            status === 'ahead' ? 'bg-emerald-50 border-emerald-100 text-emerald-600' :
            status === 'on-time' ? 'bg-amber-50 border-amber-100 text-amber-600' :
            'bg-rose-50 border-rose-100 text-rose-600'
          }`}>
            {status.replace('-', ' ')}
          </span>
        </div>
        <span className={`text-xs font-black ${textMap[status]}`}>{percentage}%</span>
      </div>
      
      <div className="relative h-6 mt-4 flex items-center">
        {/* Background Track */}
        <div className="absolute inset-x-0 h-1.5 bg-slate-100 rounded-full overflow-hidden">
          <div 
            className={`${colorMap[status]} h-full transition-all duration-700 ease-out`} 
            style={{ width: `${percentage}%` }}
          ></div>
        </div>

        {/* Markers - Labels show strictly on direct hover using named groups */}
        <div className="absolute inset-0 flex items-center">
          {markers.map((marker, i) => (
            <div 
              key={i} 
              className="absolute h-full flex flex-col items-center justify-center z-20" 
              style={{ left: `${marker.pos}%`, width: '16px', marginLeft: '-8px' }}
            >
              {/* Named group/marker isolates hover from the parent card group */}
              <div className="group/marker relative flex items-center justify-center cursor-help">
                <div className={`w-3.5 h-3.5 rounded-full border-2 border-white transition-all duration-200 shadow-sm group-hover/marker:scale-125
                  ${marker.bubbleColorClass}
                `}></div>
                
                {/* Specific Label Tooltip triggered by marker hover only */}
                <div className="absolute bottom-full mb-3 pointer-events-none opacity-0 group-hover/marker:opacity-100 transition-opacity duration-200 z-50 flex flex-col items-center">
                  <div className="bg-slate-900 text-white text-[9px] font-black px-2.5 py-1 rounded-md whitespace-nowrap uppercase tracking-widest shadow-xl border border-white/10">
                    {marker.name}
                  </div>
                  <div className="w-2 h-2 bg-slate-900 rotate-45 -mt-1 border-r border-b border-white/10"></div>
                </div>
              </div>
            </div>
          ))}
          
          {/* Final Finish Marker */}
          <div 
            className="absolute h-full flex flex-col items-center justify-center z-20" 
            style={{ left: '100%', width: '16px', marginLeft: '-8px' }}
          >
            <div className="group/marker relative flex items-center justify-center cursor-help">
              <div className={`w-3.5 h-3.5 rounded-full border-2 border-white transition-all duration-200 shadow-sm group-hover/marker:scale-125
                ${percentage === 100 ? 'bg-emerald-500 border-emerald-600' : 'bg-slate-200 border-slate-300'}
              `}></div>
              <div className="absolute bottom-full mb-3 pointer-events-none opacity-0 group-hover/marker:opacity-100 transition-opacity duration-200 z-50 flex flex-col items-center">
                <div className="bg-slate-900 text-white text-[9px] font-black px-2.5 py-1 rounded-md whitespace-nowrap uppercase tracking-widest shadow-xl border border-white/10">
                  Completion
                </div>
                <div className="w-2 h-2 bg-slate-900 rotate-45 -mt-1 border-r border-b border-white/10"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
