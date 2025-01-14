import React from 'react';
import colors from '../../theme/colors';

type ColorKeys = keyof typeof colors;

type FilterButtonProps = {
  label: ColorKeys;
  isActive: boolean;
  onClick: () => void;
};

function FilterButton({ label, isActive, onClick }: FilterButtonProps) {
  const buttonStyle = {
    backgroundColor: isActive
      ? colors[label.toLowerCase() as ColorKeys]
      : `${colors[label.toLowerCase() as ColorKeys]}33`,
    color: isActive ? 'white' : colors[label.toLowerCase() as ColorKeys],
    padding: '0.5rem 1rem',
    marginRight: '0.3rem',
    borderRadius: '9999px',
    border: 'none',
    cursor: 'pointer',
  };

  return (
    <button type="button" style={buttonStyle} onClick={onClick}>
      {label}
    </button>
  );
}

export default FilterButton;
