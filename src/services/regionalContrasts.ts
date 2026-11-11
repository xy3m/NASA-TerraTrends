import { RegionalContrastScenario } from '../types/earthScience';

export const REGIONAL_CONTRASTS: RegionalContrastScenario[] = [
  {
    id: 'contrast_hydrology_paradox',
    title: 'The Global Precipitation Paradox: Wet Gets Wetter vs Dry Gets Drier',
    commonDriver: 'Planetary Thermodynamic Warming (Clausius-Clapeyron Relation)',
    description: 'Under global atmospheric warming, warm air holds approximately 7% more water vapor per 1°C of warming. However, atmospheric circulation does not distribute this rain evenly! It intensifies both ascending storm branches (more rain) and descending subtropical dry zones (worse drought).',
    variableId: 'precip',
    regionA: {
      hotspotId: 'sahel_belt',
      trendDescription: 'Modest upward precipitation trend (+3.8 mm/decade) and monsoon recovery since the severe 1980s droughts.',
      mechanism: 'Warming Atlantic SST gradients and enhanced Sahara thermal low draw stronger West African Monsoon moisture inland.',
    },
    regionB: {
      hotspotId: 'central_valley',
      trendDescription: 'Persistent downward precipitation trend (-2.2 mm/decade) with extended dry spells between rare flood storms.',
      mechanism: 'Poleward expansion of the descending Hadley cell branch pushes storm tracks northward away from mid-latitude subtropics.',
    },
    scientificTakeaway: 'The exact same planetary temperature increase causes precipitation to surge in monsoon corridors while starving mid-latitude agricultural regions of reliable rainfall.',
  },
  {
    id: 'contrast_vegetation_forces',
    title: 'Vegetation Greenness (NDVI): Land Clearing vs Semi-Arid Greening',
    commonDriver: 'Coupled Human-Climate Forcing on Earth\'s Vegetative Surface',
    description: 'Satellite optical indices like NDVI monitor global photosynthetic activity. While tropical forests face direct mechanical clearing and fragmentation, marginal semi-arid ecotones can experience surprising vegetative recovery when rainfall cycles or atmospheric CO2 fertilization shift.',
    variableId: 'ndvi',
    regionA: {
      hotspotId: 'rondonia',
      trendDescription: 'Severe statistically significant decline in vegetation greenness (-0.042 NDVI/decade, p < 0.001).',
      mechanism: 'Mechanical clearcutting, logging, and pasture burning convert continuous rainforest canopies into open cattle pasture and bare dirt.',
    },
    regionB: {
      hotspotId: 'sahel_belt',
      trendDescription: 'Positive, statistically significant greening trend (+0.022 NDVI/decade, p < 0.01).',
      mechanism: 'Partial recovery from historical droughts, increased shrub and acacia tree cover, and farmer-managed natural regeneration (FMNR).',
    },
    scientificTakeaway: 'Earth\'s biosphere is not uniform: tropical biomes are losing dense carbon-storing canopies to human agriculture, while some marginal arid belts are experiencing localized greening.',
  },
  {
    id: 'contrast_polar_warming_asymmetry',
    title: 'Polar Warming Asymmetry: Arctic Amplification vs Antarctic Ocean Buffering',
    commonDriver: 'Global Radiative Forcing & Sea Ice Albedo Dynamics',
    description: 'Both the Arctic and Antarctic are frozen polar extremes, but their geographic geometry produces opposite short-to-medium term atmospheric response rates. The Arctic is an ocean surrounded by land; Antarctica is a continent surrounded by oceans.',
    variableId: 'temp_air',
    regionA: {
      hotspotId: 'svalbard',
      trendDescription: 'Accelerated thermal warming (+0.82°C/decade, p < 0.001), over 3 times the global average.',
      mechanism: 'Sea ice retreat exposes dark ocean water, which absorbs sunlight and dumps heat back into the winter atmosphere (ice-albedo feedback).',
    },
    regionB: {
      hotspotId: 'amundsen_coast',
      trendDescription: 'Delayed atmospheric warming and high interannual variability (+0.12°C/decade, p > 0.05).',
      mechanism: 'Strong circumpolar westerly winds and the deep Southern Ocean thermal sink absorb vast quantities of atmospheric heat, sequestering it below the surface.',
    },
    scientificTakeaway: 'The same global greenhouse forcing produces rapid runaway atmospheric warming in the Arctic while Southern Ocean circulation buffers Antarctic atmospheric surface temperatures.',
  },
];
