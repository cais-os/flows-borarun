import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useState } from "react";

interface Step4PersonalInfoProps {
  name: string;
  birthDate: string;
  sex?: 'male' | 'female';
  weightKg: number;
  heightCm: number;
  onChange: (field: string, value: string | number) => void;
}

export const Step4PersonalInfo = ({
  name,
  birthDate,
  sex,
  weightKg,
  heightCm,
  onChange,
}: Step4PersonalInfoProps) => {
  const [errors, setErrors] = useState<{
    birthDate?: string;
    weightKg?: string;
    heightCm?: string;
  }>({});

  const validateBirthDate = (date: string) => {
    if (!date) {
      setErrors(prev => ({ ...prev, birthDate: undefined }));
      return;
    }

    const selectedDate = new Date(date + 'T12:00:00');
    const today = new Date();
    const minDate = new Date();
    minDate.setFullYear(today.getFullYear() - 120); // 120 anos atrás

    if (isNaN(selectedDate.getTime())) {
      setErrors(prev => ({ ...prev, birthDate: 'Data inválida' }));
      return;
    }

    if (selectedDate > today) {
      setErrors(prev => ({ ...prev, birthDate: 'A data não pode ser no futuro' }));
      return;
    }

    if (selectedDate < minDate) {
      setErrors(prev => ({ ...prev, birthDate: 'Data muito antiga' }));
      return;
    }

    setErrors(prev => ({ ...prev, birthDate: undefined }));
  };

  const validateWeight = (weight: number) => {
    if (!weight || weight === 0) {
      setErrors(prev => ({ ...prev, weightKg: undefined }));
      return;
    }

    if (weight < 30 || weight > 300) {
      setErrors(prev => ({ ...prev, weightKg: 'Peso deve estar entre 30 e 300 kg' }));
      return;
    }

    setErrors(prev => ({ ...prev, weightKg: undefined }));
  };

  const validateHeight = (height: number) => {
    if (!height || height === 0) {
      setErrors(prev => ({ ...prev, heightCm: undefined }));
      return;
    }

    if (height < 100 || height > 250) {
      setErrors(prev => ({ ...prev, heightCm: 'Altura deve estar entre 100 e 250 cm' }));
      return;
    }

    setErrors(prev => ({ ...prev, heightCm: undefined }));
  };
  return (
    <div className="space-y-2 md:space-y-3 w-full overflow-x-hidden">
      <div className="text-center pt-2 pb-4">
        <h2 className="text-lg font-bold tracking-wide">Insira seus dados pessoais para personalizarmos seu plano</h2>
        {/* <p className="text-muted-foreground text-sm mt-2 font-brand-tertiary">
          Preencha as informações a seguir para personalizarmos seu plano de corrida
        </p> */}
      </div>

      <div className="space-y-2 md:space-y-3 max-w-md mx-auto w-full overflow-x-hidden">
        <div className="space-y-1 px-1 md:px-2">
          <Label htmlFor="name" className="text-sm">Nome</Label>
          <Input
            id="name"
            type="text"
            value={name}
            onChange={(e) => onChange('name', e.target.value)}
            placeholder="Digite seu nome"
            className="h-9 text-base md:text-sm min-w-0 border border-gray-300 w-full bg-white"
          />
        </div>

        <div className="space-y-1 w-full px-1 md:px-2">
          <Label htmlFor="birthDate" className="text-sm">Data de nascimento</Label>
          <Input
            id="birthDate"
            type="date"
            value={birthDate}
            onChange={(e) => {
              onChange('birthDate', e.target.value);
              validateBirthDate(e.target.value);
            }}
            onBlur={() => validateBirthDate(birthDate)}
            max={new Date().toISOString().split('T')[0]}
            className={`min-h-9 h-9 w-full text-sm min-w-0 border bg-white ${errors.birthDate ? 'border-red-500' : 'border-gray-300'}`}
            style={{ maxWidth: '100%', boxSizing: 'border-box', width: '100%', minWidth: 0 }}
          />
          {errors.birthDate && (
            <p className="text-xs text-red-500 mt-1">{errors.birthDate}</p>
          )}
        </div>

        <div className="space-y-1 px-1 md:px-2">
          <Label className="text-sm">Sexo</Label>
          <RadioGroup value={sex} onValueChange={(value) => onChange('sex', value)}>
            <div className="flex gap-4">
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="male" id="male" className="border border-gray-300" />
                <Label htmlFor="male" className="cursor-pointer text-sm">Masculino</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="female" id="female" className="border border-gray-300" />
                <Label htmlFor="female" className="cursor-pointer text-sm">Feminino</Label>
              </div>
            </div>
          </RadioGroup>
        </div>

        <div className="grid grid-cols-2 gap-3 px-1 md:px-2">
          <div className="space-y-1">
            <Label htmlFor="weight" className="text-sm">Peso (kg)</Label>
            <Input
              id="weight"
              type="number"
              min="30"
              max="300"
              step="0.1"
              value={weightKg || ''}
              onChange={(e) => {
                const value = parseFloat(e.target.value) || 0;
                onChange('weightKg', value);
                validateWeight(value);
              }}
              onBlur={() => validateWeight(weightKg)}
              placeholder="Ex: 75"
              inputMode="decimal"
              className={`h-9 text-base md:text-sm min-w-0 border bg-white ${errors.weightKg ? 'border-red-500' : 'border-gray-300'}`}
            />
            {errors.weightKg && (
              <p className="text-xs text-red-500 mt-1">{errors.weightKg}</p>
            )}
          </div>

          <div className="space-y-1">
            <Label htmlFor="height" className="text-sm">Altura (cm)</Label>
            <Input
              id="height"
              type="number"
              min="100"
              max="250"
              value={heightCm || ''}
              onChange={(e) => {
                const value = parseInt(e.target.value) || 0;
                onChange('heightCm', value);
                validateHeight(value);
              }}
              onBlur={() => validateHeight(heightCm)}
              placeholder="Ex: 175"
              inputMode="numeric"
              className={`h-9 text-base md:text-sm min-w-0 border bg-white ${errors.heightCm ? 'border-red-500' : 'border-gray-300'}`}
            />
            {errors.heightCm && (
              <p className="text-xs text-red-500 mt-1">{errors.heightCm}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
