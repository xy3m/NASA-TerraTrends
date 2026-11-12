import React, { useState } from 'react';
import { EarthVariable, VariableId } from '../types/earthScience';
import { EARTH_VARIABLES } from '../services/nasaData';
import { 
  Thermometer, 
  CloudRain, 
  Trees, 
  Sprout, 
  Droplets, 
  Wind, 
  Sun, 
  ShieldAlert, 
  Satellite, 
  Cpu,
  HelpCircle,
  Sparkles,
  Gauge,
  Flame,
  Snowflake,
  Waves,
  Activity,
  Layers,
  Check
} from 'lucide-react';

interface VariableSelectorProps {
  selectedVariableId: VariableId;
  onSelectVariable: (variable: EarthVariable) => void;
  recommendedVariableId?: VariableId;
}

export const VariableSelector: React.FC<VariableSelectorProps> = ({
  selectedVariableId,
  onSelectVariable,
  recommendedVariableId,
}) => {
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const categories = [
    { label: 'All', count: EARTH_VARIABLES.length },
    { label: 'Atmosphere', count: EARTH_VARIABLES.filter(v => v.category === 'Atmosphere').length },
    { label: 'Land', count: EARTH_VARIABLES.filter(v => v.category === 'Land').length },
    { label: 'Hydrosphere', count: EARTH_VARIABLES.filter(v => v.category === 'Hydrosphere').length },
    { label: 'Biosphere', count: EARTH_VARIABLES.filter(v => v.category === 'Biosphere').length },
    { label: 'Cryosphere', count: EARTH_VARIABLES.filter(v => v.category === 'Cryosphere').length },
    { label: 'Ocean', count: EARTH_VARIABLES.filter(v => v.category === 'Ocean').length },
  ];

  const filteredVariables = EARTH_VARIABLES.filter(v => {
    const matchesCategory = activeCategory === 'All' || v.category === activeCategory;
    const matchesSearch = v.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          v.shortName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          v.missions.some(m => m.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  const getVariableIcon = (id: VariableId) => {
    switch (id) {
      case 'temp_air': return <Thermometer className="w-4 h-4 text-rose-400" />;
      case 'precip': return <CloudRain className="w-4 h-4 text-blue-400" />;
      case 'ndvi': return <Trees className="w-4 h-4 text-emerald-400" />;
      case 'soil_moist': return <Sprout className="w-4 h-4 text-amber-400" />;
      case 'evapo': return <Droplets className="w-4 h-4 text-cyan-400" />;
      case 'aod': return <Wind className="w-4 h-4 text-purple-400" />;
      case 'lst_day': return <Sun className="w-4 h-4 text-orange-400" />;
      case 'ozone': return <ShieldAlert className="w-4 h-4 text-pink-400" />;
      case 'pressure': return <Gauge className="w-4 h-4 text-indigo-400" />;
      case 'humidity': return <Droplets className="w-4 h-4 text-sky-400" />;
      case 'specific_humidity': return <CloudRain className="w-4 h-4 text-cyan-400" />;
      case 'wind_speed': return <Wind className="w-4 h-4 text-purple-400" />;
      case 'radiation_sw': return <Sun className="w-4 h-4 text-amber-400" />;
      case 'radiation_lw': return <Flame className="w-4 h-4 text-rose-400" />;
      case 'albedo': return <Sparkles className="w-4 h-4 text-slate-300" />;
      case 'snow_depth': return <Snowflake className="w-4 h-4 text-sky-200" />;
      case 'snow_precip': return <CloudRain className="w-4 h-4 text-sky-300" />;
      case 'ozone_total': return <ShieldAlert className="w-4 h-4 text-fuchsia-400" />;
      case 'soil_moist_top': return <Sprout className="w-4 h-4 text-yellow-500" />;
      case 'soil_moist_prof': return <Layers className="w-4 h-4 text-yellow-700" />;
      case 'sea_level': return <Waves className="w-4 h-4 text-blue-500" />;
      case 'sst': return <Thermometer className="w-4 h-4 text-blue-400" />;
      case 'streamflow': return <Activity className="w-4 h-4 text-teal-400" />;
      case 'evi': return <Trees className="w-4 h-4 text-green-500" />;
      default: return <Satellite className="w-4 h-4 text-slate-400" />;
    }
  };

  return (
    <div className="space-y-4">
      {/* Category Pills & Search */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center space-x-1.5 overflow-x-auto w-full sm:w-auto p-1 bg-slate-900/90 rounded-xl border border-slate-800">
          {categories.map(cat => (
            <button
              key={cat.label}
              onClick={() => setActiveCategory(cat.label)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-all whitespace-nowrap flex items-center space-x-1.5 ${
                activeCategory === cat.label
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <span>{cat.label}</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                activeCategory === cat.label ? 'bg-blue-800 text-white' : 'bg-slate-800 text-slate-400'
              }`}>
                {cat.count}
              </span>
            </button>
          ))}
        </div>

        <input
          type="text"
          placeholder="Filter by variable or mission..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full sm:w-64 px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-all"
        />
      </div>

      {/* Variable Count Summary Banner */}
      <div className="flex items-center justify-between px-1 text-xs text-slate-400">
        <span>
          Showing <strong className="text-cyan-400">{filteredVariables.length}</strong> of <strong>{EARTH_VARIABLES.length}</strong> Earth system variables
        </span>
        {activeCategory !== 'All' && (
          <button
            onClick={() => setActiveCategory('All')}
            className="text-[11px] text-blue-400 hover:underline"
          >
            Show all 24 variables
          </button>
        )}
      </div>

      {/* Variable Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {filteredVariables.map(variable => {
          const isSelected = selectedVariableId === variable.id;
          const isRecommended = recommendedVariableId === variable.id;

          return (
            <div
              key={variable.id}
              role="button"
              tabIndex={0}
              onClick={() => onSelectVariable(variable)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelectVariable(variable);
                }
              }}
              className={`relative group p-3.5 rounded-xl border cursor-pointer transition-all duration-200 flex flex-col justify-between ${
                isSelected
                  ? 'bg-slate-900/95 border-cyan-400 shadow-xl shadow-cyan-500/20 ring-2 ring-cyan-400/70'
                  : 'bg-slate-950/60 hover:bg-slate-900/60 border-slate-800 hover:border-slate-700'
              }`}
            >
              {/* Selected Active Badge */}
              {isSelected && (
                <div className="absolute -top-2.5 left-2 flex items-center space-x-1 px-2 py-0.5 rounded-full bg-cyan-400 text-slate-950 text-[10px] font-black shadow-md shadow-cyan-400/30 ring-2 ring-slate-950 z-10">
                  <Check className="w-2.5 h-2.5 stroke-[3]" />
                  <span>ACTIVE</span>
                </div>
              )}

              {/* Recommended Badge */}
              {isRecommended && (
                <div className="absolute -top-2 right-2 flex items-center space-x-1 px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-[10px] font-bold text-slate-950 shadow-md z-10">
                  <Sparkles className="w-2.5 h-2.5" />
                  <span>Key Indicator</span>
                </div>
              )}

              <div>
                {/* Header: Icon, Category & Unit */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <div className="p-1.5 rounded-lg bg-slate-900 border border-slate-800">
                      {getVariableIcon(variable.id)}
                    </div>
                    <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                      {variable.category}
                    </span>
                  </div>
                  <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-slate-800/80 text-cyan-300 border border-slate-700/60">
                    {variable.unit}
                  </span>
                </div>

                {/* Variable Name */}
                <h4 className="text-sm font-bold text-slate-100 group-hover:text-blue-300 transition-colors">
                  {variable.shortName}
                </h4>

                {/* Plain English Student Explanation */}
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  {variable.studentExplanation}
                </p>
              </div>

              {/* Mission / Model Tag Footer */}
              <div className="mt-3 pt-2.5 border-t border-slate-800/60">
                <div className="flex items-start space-x-1.5 text-[11px] text-slate-400">
                  {variable.measurementType === 'Satellite Instrument' ? (
                    <Satellite className="w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5" />
                  ) : (
                    <Cpu className="w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5" />
                  )}
                  <span>
                    <span className="text-slate-300 font-semibold">
                      {variable.measurementType === 'Satellite Instrument' ? 'Mission:' : 'Model:'}
                    </span>{' '}
                    {variable.missions[0]}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
