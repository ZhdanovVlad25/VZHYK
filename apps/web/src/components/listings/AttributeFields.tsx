import { Dropdown, Input } from '@/components/ui';
import type { CategoryAttribute } from '@/lib/api';

export type AttributeValues = Record<string, unknown>;

interface AttributeFieldsProps {
  attributes: CategoryAttribute[];
  values: AttributeValues;
  onChange: (categoryAttributeId: string, value: unknown) => void;
}

/** Динамічні поля форми оголошення за CategoryAttribute.dataType (docs/categories.md §2). */
export function AttributeFields({ attributes, values, onChange }: AttributeFieldsProps) {
  if (attributes.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-4">
      {attributes.map((attr) => (
        <AttributeField key={attr.id} attr={attr} value={values[attr.id]} onChange={(v) => onChange(attr.id, v)} />
      ))}
    </div>
  );
}

function AttributeField({
  attr,
  value,
  onChange,
}: {
  attr: CategoryAttribute;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  // Не додаємо "*" вручну до label — Input/Dropdown самі малюють зірочку з required/isRequired,
  // подвійне "* *" саме так і з'являлось раніше на обов'язкових атрибутах.
  const label = attr.labelUk;
  const options = attr.enumOptions?.values ?? [];

  switch (attr.dataType) {
    case 'string':
      return (
        <Input
          label={label}
          value={(value as string) ?? ''}
          onChange={(e) => onChange(e.target.value)}
          required={attr.isRequired}
        />
      );

    case 'number':
      return (
        <Input
          label={label}
          type="number"
          value={value === undefined || value === null ? '' : String(value)}
          onChange={(e) => onChange(e.target.value === '' ? undefined : Number(e.target.value))}
          required={attr.isRequired}
        />
      );

    case 'boolean':
      return (
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={Boolean(value)}
            onChange={(e) => onChange(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300"
          />
          {label}
          {attr.isRequired && (
            <span className="text-accent-600 dark:text-accent-500" aria-hidden="true">
              *
            </span>
          )}
        </label>
      );

    case 'enum':
      return (
        <Dropdown
          label={label}
          options={options.map((o) => ({ value: o, label: o }))}
          value={(value as string) ?? null}
          onChange={onChange}
        />
      );

    case 'multi_enum': {
      const selected = Array.isArray(value) ? (value as string[]) : [];
      return (
        <fieldset>
          <legend className="mb-1 text-sm font-medium text-gray-700">{label}</legend>
          <div className="flex flex-wrap gap-3">
            {options.map((option) => (
              <label key={option} className="flex items-center gap-1.5 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={selected.includes(option)}
                  onChange={(e) =>
                    onChange(e.target.checked ? [...selected, option] : selected.filter((v) => v !== option))
                  }
                  className="h-4 w-4 rounded border-gray-300"
                />
                {option}
              </label>
            ))}
          </div>
        </fieldset>
      );
    }

    case 'range': {
      const range = (value as { min?: number; max?: number } | undefined) ?? {};
      return (
        <div>
          <p className="mb-1 text-sm font-medium text-gray-700">{label}</p>
          <div className="flex gap-2">
            <Input
              label="Від"
              type="number"
              value={range.min ?? ''}
              onChange={(e) => onChange({ ...range, min: e.target.value === '' ? undefined : Number(e.target.value) })}
            />
            <Input
              label="До"
              type="number"
              value={range.max ?? ''}
              onChange={(e) => onChange({ ...range, max: e.target.value === '' ? undefined : Number(e.target.value) })}
            />
          </div>
        </div>
      );
    }

    default:
      return null;
  }
}
