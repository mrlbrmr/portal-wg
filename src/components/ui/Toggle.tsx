interface ToggleProps {
  checked: boolean;
  onChange: () => void;
  label: string;
  description?: string;
}

export function Toggle({ checked, onChange, label, description }: ToggleProps) {
  return (
    <label className="flex items-center justify-between gap-4 cursor-pointer group py-2">
      <div className="flex-1 min-w-0">
        <span className="text-sm text-gray-800 select-none leading-snug">{label}</span>
        {description && (
          <span className="block text-xs text-gray-500 mt-0.5">{description}</span>
        )}
      </div>
      <input type="checkbox" checked={checked} onChange={onChange} className="sr-only" />
      {/* Track */}
      <div
        className={`relative w-10 h-[22px] rounded-full shrink-0 transition-colors duration-200 ${
          checked ? "bg-[#90CB46]" : "bg-gray-200 group-hover:bg-gray-300"
        }`}
        aria-hidden="true"
      >
        {/* Thumb */}
        <span
          className={`absolute top-[2px] left-[2px] w-[18px] h-[18px] bg-white rounded-full shadow-sm transition-transform duration-200 ${
            checked ? "translate-x-[18px]" : "translate-x-0"
          }`}
        />
      </div>
    </label>
  );
}
