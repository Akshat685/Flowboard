import { useState, useRef, useEffect } from 'react';

export function CustomSelect({ value, onChange, options, disabled, id }) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedOption = options.find((opt) => opt.id === value);

  return (
    <div
      className={`custom-select-container ${disabled ? 'disabled' : ''}`}
      ref={containerRef}
      id={id}
    >
      <div
        className={`custom-select-trigger ${isOpen ? 'open' : ''}`}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        role="button"
        tabIndex={disabled ? -1 : 0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            !disabled && setIsOpen(!isOpen);
            e.preventDefault();
          }
        }}
      >
        <span>{selectedOption ? selectedOption.label : 'Select...'}</span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="custom-select-icon"
        >
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      </div>
      {isOpen && (
        <ul className="custom-select-dropdown">
          {options.map((opt) => (
            <li
              key={opt.id}
              className={`custom-select-option ${value === opt.id ? 'selected' : ''}`}
              onClick={() => {
                onChange(opt.id);
                setIsOpen(false);
              }}
              role="option"
              aria-selected={value === opt.id}
            >
              {opt.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
