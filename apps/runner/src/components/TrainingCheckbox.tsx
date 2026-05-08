import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { Check } from "lucide-react";

interface TrainingCheckboxProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  color?: string;
}

export const TrainingCheckbox = ({ checked, onCheckedChange, color = '#22c55e' }: TrainingCheckboxProps) => {
  return (
    <CheckboxPrimitive.Root
      checked={checked}
      onCheckedChange={onCheckedChange}
      style={{
        width: '24px',
        height: '24px',
        borderRadius: '8px',
        backgroundColor: checked ? color : '#ffffff',
        borderWidth: '2px',
        borderStyle: 'solid',
        borderColor: checked ? color : '#d1d5db',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        boxSizing: 'border-box'
      }}
    >
      <CheckboxPrimitive.Indicator
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
          height: '100%'
        }}
      >
        <Check 
          size={16}
          color="#ffffff" 
          strokeWidth={3}
          style={{ display: 'block' }}
        />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
};
