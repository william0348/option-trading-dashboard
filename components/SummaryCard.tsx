
import React from 'react';

interface SummaryCardProps {
  title: string;
  value: string | number;
  description?: string;
  valueColorClass?: string;
  icon?: React.ReactNode;
  trend?: 'up' | 'down' | 'neutral';
}

const SummaryCard: React.FC<SummaryCardProps> = ({ title, value, description, valueColorClass, icon }) => {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex flex-col gap-3 hover:shadow-md transition-shadow duration-200">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{title}</p>
        {icon && (
          <div className="w-8 h-8 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 border border-slate-100">
            {icon}
          </div>
        )}
      </div>
      <div>
        <p className={`text-2xl font-black tracking-tight ${valueColorClass || 'text-slate-900'}`}>{value}</p>
        {description && (
          <p className="mt-1 text-[10px] text-slate-400 font-medium leading-tight">{description}</p>
        )}
      </div>
    </div>
  );
};

export default React.memo(SummaryCard);
