import React from 'react';

type FilterButtonProps = {
  label: string;
  isActive: boolean;
  onClick: () => void;
};

const FilterButton: React.FC<FilterButtonProps> = ({ label, isActive, onClick }) => (
  <button
    className={`px-4 py-2 rounded-full ${
      isActive ? `bg-${label.toLowerCase()}-500 text-white` : 'bg-gray-200'
    }`}
    onClick={onClick}
  >
    {label}
  </button>
);

export default FilterButton;