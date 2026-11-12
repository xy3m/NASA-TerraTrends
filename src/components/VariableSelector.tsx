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
  Sparkles
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

  const categories = ['All', 'Atmosphere', 'Land', 'Hydrosphere', 'Biosphere'];

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
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                activeCategory === cat
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              {cat}
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

      {/* Variable Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {filteredVariables.map(variable => {
          const isSelected = selectedVariableId === variable.id;
          const isRecommended = recommendedVariableId === variable.id;

          return (
            <div
              key={variable.id}
              onClick={() => onSelectVariable(variable)}
              className={`relative group p-3.5 rounded-xl border cursor-pointer transition-all duration-200 flex flex-col justify-between ${
                isSelected
                  ? 'bg-slate-900/90 border-blue-500 shadow-lg shadow-blue-500/10 ring-1 ring-blue-500/50'
                  : 'bg-slate-950/60 hover:bg-slate-900/60 border-slate-800 hover:border-slate-700'
              }`}
            >
              {/* Recommended Badge */}
              {isRecommended && (
                <div className="absolute -top-2 right-2 flex items-center space-x-1 px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-[10px] font-bold text-slate-950 shadow-md">
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
