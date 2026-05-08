import * as React from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface PhoneInputProps extends Omit<React.ComponentProps<"input">, "onChange"> {
  value?: string;
  onChange?: (value: string) => void;
}

const PhoneInput = React.forwardRef<HTMLInputElement, PhoneInputProps>(
  ({ className, value = "", onChange, ...props }, ref) => {
    const [displayValue, setDisplayValue] = React.useState("");

    React.useEffect(() => {
      setDisplayValue(formatPhoneForDisplay(value));
    }, [value]);

    const formatPhoneForDisplay = (phone: string): string => {
      const cleaned = phone.replace(/\D/g, "");
      
      if (cleaned.length === 0) return "";
      if (cleaned.length <= 2) return `(${cleaned}`;
      if (cleaned.length <= 7) return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2)}`;
      if (cleaned.length <= 11) {
        return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`;
      }
      
      return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7, 11)}`;
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const input = e.target.value;
      const cleaned = input.replace(/\D/g, "");
      
      // Limita a 11 dígitos (DDD + número)
      const limited = cleaned.slice(0, 11);
      
      const formatted = formatPhoneForDisplay(limited);
      setDisplayValue(formatted);
      
      if (onChange) {
        onChange(limited);
      }
    };

    return (
      <Input
        type="tel"
        className={cn(className)}
        value={displayValue}
        onChange={handleChange}
        placeholder="(11) 99999-9999"
        ref={ref}
        {...props}
      />
    );
  }
);

PhoneInput.displayName = "PhoneInput";

export { PhoneInput };
