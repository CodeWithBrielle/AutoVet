import React, { useEffect } from 'react';
import { PHILIPPINE_CITIES } from '../../constants/locations';
import SearchableSelect from './SearchableSelect';
import clsx from 'clsx';

/**
 * SmartAddressGroup Component
 * 
 * Handles intelligent auto-fill for PH addresses based on Zip or City.
 * Optimized for Phase 3 usability to minimize retyping.
 */
const SmartAddressGroup = ({ 
  register, 
  setValue, 
  watch, 
  errors,
  prefix = "owner_" 
}) => {
  const city = watch(`${prefix}city`);
  const province = watch(`${prefix}province`);
  const zip = watch(`${prefix}zip`);

  // Prepare city options for SearchableSelect
  const cityOptions = Object.keys(PHILIPPINE_CITIES).sort().map(name => ({
    value: name,
    label: name,
    sublabel: PHILIPPINE_CITIES[name].province
  }));

  // Logic: When city changes via Select, update others
  const handleCityChange = (selectedCity) => {
    setValue(`${prefix}city`, selectedCity);
    const data = PHILIPPINE_CITIES[selectedCity];
    if (data) {
      setValue(`${prefix}province`, data.province, { shouldValidate: true });
      setValue(`${prefix}zip`, data.zip, { shouldValidate: true });
    }
  };

  // Logic: When zip changes via Manual Input, check for match
  const handleZipBlur = (e) => {
    const enteredZip = e.target.value;
    if (!enteredZip) return;

    // Find city with matching zip
    const matchedCity = Object.keys(PHILIPPINE_CITIES).find(
      key => PHILIPPINE_CITIES[key].zip === enteredZip
    );

    if (matchedCity) {
      setValue(`${prefix}city`, matchedCity, { shouldValidate: true });
      setValue(`${prefix}province`, PHILIPPINE_CITIES[matchedCity].province, { shouldValidate: true });
    }
  };

  const getInputClass = (err) => clsx(
    "w-full rounded-lg border px-3 py-2 text-sm transition-all outline-none bg-white dark:bg-dark-surface/50",
    err ? "border-red-500 focus:ring-red-500/10" : "border-slate-200 focus:border-primary focus:ring-primary/10 dark:border-zinc-700"
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <div className="lg:col-span-1">
        <label className="mb-1 block text-sm font-semibold text-slate-600 dark:text-zinc-300">City *</label>
        <SearchableSelect 
          options={cityOptions}
          value={city}
          onChange={handleCityChange}
          placeholder="Select or search city..."
          error={errors[`${prefix}city`]?.message}
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-semibold text-slate-600 dark:text-zinc-300">Province</label>
        <input 
          {...register(`${prefix}province`)} 
          className={getInputClass(errors[`${prefix}province`])} 
          placeholder="Province" 
        />
        {errors[`${prefix}province`] && <p className="mt-1 text-xs text-red-500">{errors[`${prefix}province`].message}</p>}
      </div>

      <div>
        <label className="mb-1 block text-sm font-semibold text-slate-600 dark:text-zinc-300">Zip Code</label>
        <input 
          {...register(`${prefix}zip`)} 
          onBlur={handleZipBlur}
          className={getInputClass(errors[`${prefix}zip`])} 
          placeholder="Zip" 
        />
        {errors[`${prefix}zip`] && <p className="mt-1 text-xs text-red-500">{errors[`${prefix}zip`].message}</p>}
      </div>
    </div>
  );
};

export default SmartAddressGroup;
