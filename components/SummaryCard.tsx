
import React from 'react';

interface SummaryCardProps {
  title: string;
  value: string | number;
  description?: string;
  valueColorClass?: string; // Tailwind class for text color, e.g., 'text-green-600'
}

const SummaryCard: React.FC<SummaryCardProps> = ({ title, value, description, valueColorClass }) => {
  return (
    <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
      <h3 className="text-sm font-medium text-gray-500">{title}</h3>
      <p className={`mt-1 text-2xl font-bold ${valueColorClass || 'text-gray-900'}`}>{value}</p>
      {description && <p className="mt-2 text-xs text-gray-500">{description}</p>}
    </div>
  );
};

export default SummaryCard;