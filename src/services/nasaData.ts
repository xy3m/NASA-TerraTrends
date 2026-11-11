import { EarthVariable, HotspotRegion, TimeSeriesPoint, VariableId } from '../types/earthScience';
import { processTimeSeries } from './statistics';

export const EARTH_VARIABLES: EarthVariable[] = [
  {
    id: 'temp_air',
    name: 'Surface Air Temperature (2-Meter)',
    shortName: 'Air Temp',
    unit: '°C',
    category: 'Atmosphere',
    description: 'The temperature of ambient air at 2 meters above the Earth surface, representing the fundamental thermal state of the lower troposphere.',
    studentExplanation: 'Think of this as what a standard weather thermometer would read outside in the shade. Satellites and weather stations track this to see if regions are warming up or cooling down over decades.',
    missions: ['MERRA-2 Reanalysis', 'AIRS (Aqua)', 'MODIS (Terra/Aqua)'],
    measurementType: 'Combined Reanalysis',
    typicalRange: [-40, 45],
    color: '#EF4444', // red
    iconName: 'Thermometer',
    driverExamples: ['Greenhouse gas forcing', 'Urban heat retention', 'Arctic sea ice albedo loss', 'Solar radiation variations'],
  },
  {
    id: 'precip',
    name: 'Total Monthly Precipitation',
    shortName: 'Precipitation',
    unit: 'mm/month',
    category: 'Hydrosphere',
    description: 'The cumulative liquid water equivalent of all rain, snow, and hail falling to the surface over a monthly period.',
    studentExplanation: 'The total amount of rain and snow collected in a rain gauge over an entire month. Satellites use radar and microwave sensors in orbit to watch rain clouds across the whole planet.',
    missions: ['GPM (Global Precipitation Measurement)', 'TRMM', 'MERRA-2'],
    measurementType: 'Satellite Instrument',
    typicalRange: [0, 450],
    color: '#3B82F6', // blue
    iconName: 'CloudRain',
    driverExamples: ['Atmospheric river tracks', 'Monsoon circulation shifts', 'El Niño / La Niña teleconnections', 'Hadley Cell expansion'],
  },
  {
    id: 'ndvi',
    name: 'Normalized Difference Vegetation Index (NDVI)',
    shortName: 'Vegetation Greenness',
    unit: 'index (0–1)',
    category: 'Biosphere',
    description: 'A spectral ratio comparing near-infrared reflectance (reflected by healthy leaf cellular structure) to red light absorbance (absorbed by chlorophyll).',
    studentExplanation: 'A satellite "plant health detector". Healthy lush forests reflect lots of near-infrared light and absorb red light (NDVI ~0.7-0.9), while deserts, rocks, and deforested fields have low NDVI (<0.2).',
    missions: ['MODIS (Terra/Aqua)', 'Landsat 8/9 OLI', 'VIIRS (Suomi NPP)'],
    measurementType: 'Satellite Instrument',
    typicalRange: [0.05, 0.95],
    color: '#10B981', // emerald
    iconName: 'Trees',
    driverExamples: ['Deforestation & logging', 'Agricultural irrigation expansion', 'Sahel greening / drought recovery', 'Wildfire burn scars'],
  },
  {
    id: 'soil_moist',
    name: 'Root Zone Soil Moisture',
    shortName: 'Soil Moisture',
    unit: 'm³/m³',
    category: 'Land',
    description: 'Volumetric water content stored within the top 0–100 cm of soil accessible to plant root systems.',
    studentExplanation: 'How much water is trapped in the dirt where tree and crop roots drink. When soil moisture drops for months, plants wither, fire risk soars, and farmers lose crops.',
    missions: ['SMAP (Soil Moisture Active Passive)', 'GLDAS-2 Model', 'AMSR-2'],
    measurementType: 'Global Assimilation Model',
    typicalRange: [0.04, 0.45],
    color: '#D97706', // amber
    iconName: 'Sprout',
    driverExamples: ['Prolonged meteorological drought', 'Aquifer extraction drawdown', 'Snowpack early melt', 'Intense convective precipitation'],
  },
  {
    id: 'evapo',
    name: 'Total Evapotranspiration Flux',
    shortName: 'Evaporation',
    unit: 'mm/month',
    category: 'Hydrosphere',
    description: 'The combined transfer of moisture from land surface evaporation and plant transpiration into the atmosphere.',
    studentExplanation: 'The planet sweating and exhaling water vapor! It combines puddles evaporating in the sun and trees "breathing out" moisture from their leaves.',
    missions: ['GLDAS-2 Model', 'ECOSTRESS (ISS)', 'MODIS MOD16'],
    measurementType: 'Global Assimilation Model',
    typicalRange: [5, 220],
    color: '#06B6D4', // cyan
    iconName: 'Droplets',
    driverExamples: ['Solar radiation heating', 'Canopy tree cover loss', 'Soil water availability limits', 'Wind speed and vapor pressure deficit'],
  },
  {
    id: 'aod',
    name: 'Aerosol Optical Depth (AOD at 550nm)',
    shortName: 'Aerosols / Haze',
    unit: 'unitless',
    category: 'Atmosphere',
    description: 'A measure of how much airborne particulates (smoke, dust, sulfates, smog) scatter and absorb sunlight passing through the atmosphere column.',
    studentExplanation: 'How cloudy or hazy the sky is from microscopic particles like smoke, dust storms, or car exhaust. An AOD of 0.1 is crystal clear blue sky; 0.8+ is thick choking smog.',
    missions: ['MODIS (Terra/Aqua)', 'OMI (Aura)', 'CALIOP (CALIPSO)'],
    measurementType: 'Satellite Instrument',
    typicalRange: [0.02, 1.20],
    color: '#8B5CF6', // purple
    iconName: 'Wind',
    driverExamples: ['Crop stubble burning & wildfires', 'Saharan mineral dust transport', 'Industrial coal & fossil fuel emissions', 'Volcanic eruptions'],
  },
  {
    id: 'lst_day',
    name: 'Land Surface Temperature (Daytime)',
    shortName: 'Surface Temp',
    unit: '°C',
    category: 'Land',
    description: 'Radiative skin temperature of the land surface detected via thermal infrared satellite channels.',
    studentExplanation: 'The "touch temperature" of the ground. On a hot summer day, dark asphalt might have an LST of 55°C even if the air is only 32°C. Tracks urban heat islands and scorched soils.',
    missions: ['MODIS (Terra/Aqua)', 'ECOSTRESS (ISS)', 'VIIRS'],
    measurementType: 'Satellite Instrument',
    typicalRange: [-35, 58],
    color: '#F97316', // orange
    iconName: 'Sun',
    driverExamples: ['Urban concrete/asphalt paving', 'Deforestation removing shade', 'Soil drying allowing skin heating', 'Glacier & snow cover reduction'],
  },
  {
    id: 'ozone',
    name: 'Tropospheric Ozone Column',
    shortName: 'Ozone Column',
    unit: 'Dobson Units (DU)',
    category: 'Atmosphere',
    description: 'The integrated amount of ozone molecules in the atmospheric column between the surface and the tropopause.',
    studentExplanation: 'In the stratosphere, ozone shields us from UV rays; but down near the ground in the troposphere, it is a harmful pollutant and greenhouse gas created by traffic exhaust reacting in sunlight.',
    missions: ['OMI (Aura)', 'TROPOMI (Sentinel-5P)', 'MERRA-2'],
    measurementType: 'Satellite Instrument',
    typicalRange: [15, 60],
    color: '#EC4899', // pink
    iconName: 'ShieldAlert',
    driverExamples: ['Photochemical smog formation', 'Lightning-generated nitrogen oxides', 'Stratospheric-tropospheric exchange folds', 'Fossil fuel combustion'],
  },
];

export const HOTSPOT_REGIONS: HotspotRegion[] = [
  {
    id: 'svalbard',
    name: 'Svalbard Archipelago, High Arctic',
    countryOrOcean: 'Norway / Arctic Ocean',
    coordinates: [78.22, 15.65],
    category: 'Polar',
    description: 'The fastest warming inhabited place on Earth, experiencing Arctic Amplification driven by sea ice loss and albedo feedbacks.',
    keyPhenomenon: 'Arctic Amplification & Polar Warming',
    primaryVariable: 'temp_air',
    oppositePairId: 'amundsen_coast',
    oppositeExplanation: 'While Svalbard warms at over 3x the global rate, parts of Coastal Antarctica have exhibited cooling or delayed warming due to strengthening circumpolar westerly winds and ozone recovery shielding.',
  },
  {
    id: 'rondonia',
    name: 'Rondônia Basin, Southern Amazon',
    countryOrOcean: 'Brazil',
    coordinates: [-10.83, -62.33],
    category: 'Tropical Rainforest',
    description: 'Famous "fishbone" deforestation frontier where vast rainforest canopies have been converted to cattle pasture, severely altering local moisture cycling.',
    keyPhenomenon: 'Canopy Loss & Moisture Decline',
    primaryVariable: 'ndvi',
    oppositePairId: 'sahel_belt',
    oppositeExplanation: 'While the Southern Amazon suffers sharp vegetation and evapotranspiration declines from land clearing, the African Sahel has shown "greening" and vegetation rebound since the 1980s droughts.',
  },
  {
    id: 'aral_sea',
    name: 'Aral Sea Basin (Former Seabed)',
    countryOrOcean: 'Kazakhstan / Uzbekistan',
    coordinates: [45.00, 59.50],
    category: 'Arid / Desert',
    description: 'One of the twentieth century’s greatest ecological disasters: massive Soviet river diversions caused a 90% shrinkage, creating the toxic Aralkum Desert.',
    keyPhenomenon: 'Catastrophic Lake Desiccation & Desertification',
    primaryVariable: 'evapo',
  },
  {
    id: 'central_valley',
    name: 'Central Valley (San Joaquin)',
    countryOrOcean: 'California, USA',
    coordinates: [36.75, -119.77],
    category: 'Agricultural',
    description: 'America’s most productive agricultural basin, subjected to recurring multi-year megadroughts, depleting root-zone moisture and triggering extensive groundwater overdraft.',
    keyPhenomenon: 'Megadrought & Root-Zone Desiccation',
    primaryVariable: 'soil_moist',
  },
  {
    id: 'sahel_belt',
    name: 'Sahel Transition Belt (Niamey)',
    countryOrOcean: 'Niger / West Africa',
    coordinates: [13.51, 2.11],
    category: 'Arid / Desert',
    description: 'Semi-arid ecotone between Sahara and tropical savanna, displaying a famous "Sahel Greening" trend and partial rainfall recovery following the devastating 1970s–1980s famines.',
    keyPhenomenon: 'Monsoon Recovery & Sahel Greening',
    primaryVariable: 'precip',
    oppositePairId: 'rondonia',
    oppositeExplanation: 'While Amazonian vegetation declines due to deforestation, the Sahel has demonstrated a greening comeback fueled by modest rainfall recovery.',
  },
  {
    id: 'indo_gangetic',
    name: 'Indo-Gangetic Plain (New Delhi)',
    countryOrOcean: 'India',
    coordinates: [28.61, 77.21],
    category: 'Urban',
    description: 'Densely populated river valley basin prone to severe seasonal temperature inversions, trapping agricultural stubble fire plumes, industrial emissions, and vehicle exhaust.',
    keyPhenomenon: 'Extreme Atmospheric Aerosol & Smog Surge',
    primaryVariable: 'aod',
  },
  {
    id: 'great_barrier_reef',
    name: 'Great Barrier Reef (Cairns Sector)',
    countryOrOcean: 'Coral Sea / Australia',
    coordinates: [-16.92, 145.77],
    category: 'Marine',
    description: 'The world’s largest coral reef ecosystem, suffering repeated mass thermal bleaching events due to rising tropical ocean heat and persistent marine heatwaves.',
    keyPhenomenon: 'Marine Thermal Stress & Bleaching',
    primaryVariable: 'temp_air',
  },
  {
    id: 'tibetan_plateau',
    name: 'Tibetan Plateau ("Third Pole")',
    countryOrOcean: 'China / Central Asia',
    coordinates: [32.00, 85.00],
    category: 'High Altitude',
    description: 'The highest plateau on Earth, acting as an atmospheric heat pump for Asian monsoons; its rapid warming accelerates glacial retreat, affecting water supplies for 1.5 billion people.',
    keyPhenomenon: 'High-Altitude Warming Amplification',
    primaryVariable: 'temp_air',
  },
  {
    id: 'tokyo_metro',
    name: 'Tokyo Metropolitan Core',
    countryOrOcean: 'Japan',
    coordinates: [35.68, 139.77],
    category: 'Urban',
    description: 'The world’s most populous megacity, illustrating intense Urban Heat Island (UHI) daytime surface heating from dense asphalt, steel, and anthropogenic air-conditioning heat rejection.',
    keyPhenomenon: 'Urban Heat Island Microclimate Heating',
    primaryVariable: 'lst_day',
  },
  {
    id: 'lake_urmia',
    name: 'Lake Urmia Saline Basin',
    countryOrOcean: 'Northwestern Iran',
    coordinates: [37.75, 45.30],
    category: 'Arid / Desert',
    description: 'Once the second-largest hypersaline lake on Earth, dam building and agricultural water extraction shrank its surface area by over 85%, sparking severe toxic salt dust storms.',
    keyPhenomenon: 'Saline Wetland Collapse & Salt Dust',
    primaryVariable: 'soil_moist',
  },
  {
    id: 'congo_basin',
    name: 'Central Congo Basin Rainforest',
    countryOrOcean: 'Democratic Republic of Congo',
    coordinates: [0.50, 25.00],
    category: 'Tropical Rainforest',
    description: 'The world’s second-largest contiguous tropical rainforest, exhibiting unique drought resilience despite rising temperatures and localized logging pressures.',
    keyPhenomenon: 'Tropical Canopy Resilience & Moisture Recycling',
    primaryVariable: 'evapo',
  },
  {
    id: 'amundsen_coast',
    name: 'Amundsen Sea Embayment',
    countryOrOcean: 'West Antarctica',
    coordinates: [-74.50, -111.00],
    category: 'Polar',
    description: 'Home to the Pine Island and Thwaites "Doomsday" Glaciers, where warm Circumpolar Deep Water intrudes beneath floating ice shelves.',
    keyPhenomenon: 'Ocean Thermal Intrusion & Ice Mass Loss',
    primaryVariable: 'temp_air',
    oppositePairId: 'svalbard',
    oppositeExplanation: 'Contrasts with Arctic Svalbard: while Svalbard experiences extreme atmospheric air warming, West Antarctica is primarily destabilized by warm oceanic currents beneath the ice shelves.',
  },
];

/**
 * Calibrated synthetic historical generator based on published NASA/NOAA observations (1990-2024)
 * Ensures instantaneous, flawless offline operation during hackathon presentations and testing!
 */
export function generateCuratedTimeSeries(region: HotspotRegion, variable: EarthVariable): TimeSeriesPoint[] {
  const startYear = 1990;
  const endYear = 2024;
  const rawPoints: { date: string; value: number }[] = [];

  // Seed baseline parameters tailored to region & variable
  const config = getRegionVariableBaseline(region.id, variable.id);

  let currentYear = startYear;
  let currentMonth = 1;

  while (currentYear <= endYear) {
    const fractionalYear = currentYear + (currentMonth - 1) / 12;
    const yearOffset = fractionalYear - startYear;

    // 1. Base value + linear trend
    let value = config.baseline + config.trendPerYear * yearOffset;

    // 2. Strong seasonal cycle (amplitude varies by variable & latitude)
    const monthAngle = ((currentMonth - 1) / 12) * 2 * Math.PI;
    const seasonalComponent = config.seasonalAmp * Math.sin(monthAngle + config.seasonalPhase);
    value += seasonalComponent;

    // 3. Climate oscillations: ENSO (3-7 yr), Solar (11 yr), Volcanic Pinatubo (1991-1993)
    const ensoCycle = 0.4 * Math.sin((fractionalYear / 4.2) * 2 * Math.PI);
    if (variable.id === 'temp_air' || variable.id === 'precip') {
      value += ensoCycle * (config.baseline > 0 ? 0.3 : 0.6);
    }

    // Volcanic aerosols in 1991-1993 (Mount Pinatubo eruption)
    if (variable.id === 'aod' && currentYear >= 1991 && currentYear <= 1993) {
      const pinatubo = Math.exp(-Math.pow(fractionalYear - 1991.6, 2) / 0.8) * 0.35;
      value += pinatubo;
    }

    // 4. Realistic pseudo-random stochastic noise (reproducible with sine hash)
    const hash = Math.sin(fractionalYear * 123.456 + region.coordinates[0] * 78.9) * 43758.5453;
    const noise = (hash - Math.floor(hash) - 0.5) * 2 * config.noiseStd;
    value += noise;

    // Clamping to realistic physical boundaries
    if (variable.id === 'ndvi') value = Math.max(0.01, Math.min(0.98, value));
    if (variable.id === 'aod') value = Math.max(0.02, Math.min(1.8, value));
    if (variable.id === 'precip') value = Math.max(0, value);
    if (variable.id === 'soil_moist') value = Math.max(0.02, Math.min(0.55, value));
    if (variable.id === 'evapo') value = Math.max(2, value);

    const monthStr = currentMonth < 10 ? `0${currentMonth}` : `${currentMonth}`;
    rawPoints.push({
      date: `${currentYear}-${monthStr}`,
      value: +value.toFixed(2),
    });

    currentMonth++;
    if (currentMonth > 12) {
      currentMonth = 1;
      currentYear++;
    }
  }

  return processTimeSeries(rawPoints);
}

interface BaselineConfig {
  baseline: number;
  trendPerYear: number;
  seasonalAmp: number;
  seasonalPhase: number;
  noiseStd: number;
}

function getRegionVariableBaseline(regionId: string, varId: VariableId): BaselineConfig {
  // Defaults based on variable
  const defaults: Record<VariableId, BaselineConfig> = {
    temp_air: { baseline: 14.5, trendPerYear: 0.028, seasonalAmp: 8.0, seasonalPhase: 0, noiseStd: 0.6 },
    precip: { baseline: 75.0, trendPerYear: -0.15, seasonalAmp: 45.0, seasonalPhase: 1.2, noiseStd: 12.0 },
    ndvi: { baseline: 0.62, trendPerYear: -0.0012, seasonalAmp: 0.15, seasonalPhase: 0.8, noiseStd: 0.02 },
    soil_moist: { baseline: 0.28, trendPerYear: -0.0015, seasonalAmp: 0.08, seasonalPhase: 1.0, noiseStd: 0.015 },
    evapo: { baseline: 85.0, trendPerYear: -0.35, seasonalAmp: 30.0, seasonalPhase: 0.5, noiseStd: 6.0 },
    aod: { baseline: 0.22, trendPerYear: 0.003, seasonalAmp: 0.09, seasonalPhase: 2.1, noiseStd: 0.035 },
    lst_day: { baseline: 22.0, trendPerYear: 0.038, seasonalAmp: 11.0, seasonalPhase: 0, noiseStd: 0.9 },
    ozone: { baseline: 34.0, trendPerYear: 0.08, seasonalAmp: 7.0, seasonalPhase: 1.5, noiseStd: 1.8 },
  };

  const res = { ...defaults[varId] };

  // Calibrate specific real-world documented trends
  if (regionId === 'svalbard') {
    if (varId === 'temp_air') {
      res.baseline = -6.8;
      res.trendPerYear = 0.082; // +0.82°C/decade (Extreme Arctic Amplification)
      res.seasonalAmp = 14.5;
    }
  } else if (regionId === 'rondonia') {
    if (varId === 'ndvi') {
      res.baseline = 0.82;
      res.trendPerYear = -0.0042; // -0.042/decade (Strong deforestation drop)
      res.seasonalAmp = 0.08;
    } else if (varId === 'evapo') {
      res.baseline = 135;
      res.trendPerYear = -0.72; // Decreased tree transpiration
    } else if (varId === 'temp_air') {
      res.baseline = 25.4;
      res.trendPerYear = 0.041;
      res.seasonalAmp = 2.0;
    }
  } else if (regionId === 'aral_sea') {
    if (varId === 'evapo') {
      res.baseline = 110;
      res.trendPerYear = -1.45; // Extreme collapse as lake desiccated
      res.seasonalAmp = 50;
    } else if (varId === 'soil_moist') {
      res.baseline = 0.32;
      res.trendPerYear = -0.0055;
    }
  } else if (regionId === 'central_valley') {
    if (varId === 'soil_moist') {
      res.baseline = 0.24;
      res.trendPerYear = -0.0028; // Megadrought soil moisture drop
      res.seasonalAmp = 0.09;
    } else if (varId === 'precip') {
      res.baseline = 32;
      res.trendPerYear = -0.22;
      res.seasonalAmp = 28;
    }
  } else if (regionId === 'sahel_belt') {
    if (varId === 'precip') {
      res.baseline = 42;
      res.trendPerYear = 0.38; // Sahel recovery/greening
      res.seasonalAmp = 55;
    } else if (varId === 'ndvi') {
      res.baseline = 0.25;
      res.trendPerYear = 0.0022; // Greening trend
      res.seasonalAmp = 0.18;
    }
  } else if (regionId === 'indo_gangetic') {
    if (varId === 'aod') {
      res.baseline = 0.42;
      res.trendPerYear = 0.0095; // Extreme aerosol growth (+0.095/decade)
      res.seasonalAmp = 0.25;
    }
  } else if (regionId === 'tokyo_metro') {
    if (varId === 'lst_day') {
      res.baseline = 21.0;
      res.trendPerYear = 0.052; // Strong Urban Heat Island warming
      res.seasonalAmp = 13.0;
    }
  } else if (regionId === 'great_barrier_reef') {
    if (varId === 'temp_air') {
      res.baseline = 25.8;
      res.trendPerYear = 0.024; // Marine heat trend
      res.seasonalAmp = 4.2;
    }
  } else if (regionId === 'tibetan_plateau') {
    if (varId === 'temp_air') {
      res.baseline = 1.2;
      res.trendPerYear = 0.048; // High altitude warming amplification
      res.seasonalAmp = 11.5;
    }
  }

  return res;
}

/**
 * Fetch live data from official NASA POWER API (https://power.larc.nasa.gov)
 * Public, free, CORS-enabled NASA Earth Science endpoint!
 */
export async function fetchLiveNasaPowerData(
  lat: number,
  lon: number,
  variableId: VariableId
): Promise<{ points: TimeSeriesPoint[]; isLiveNasa: boolean }> {
  // Map our internal variables to NASA POWER parameter codes
  const paramMap: Partial<Record<VariableId, string>> = {
    temp_air: 'T2M',          // Temperature at 2 Meters (°C)
    precip: 'PRECTOTCORR',    // Precipitation Corrected (mm/day)
    lst_day: 'TS',            // Earth Skin Temperature (°C)
    evapo: 'EVPTRNS',         // Evapotranspiration
  };

  const nasaParam = paramMap[variableId] || 'T2M';

  const startYear = 1995;
  const endYear = 2024;
  const url = `https://power.larc.nasa.gov/api/temporal/monthly/point?parameters=${nasaParam}&community=RE&longitude=${lon.toFixed(2)}&latitude=${lat.toFixed(2)}&start=${startYear}&end=${endYear}&format=JSON`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 7000); // 7s timeout

    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`NASA API returned status ${response.status}`);
    }

    const json = await response.json();
    const parameterData = json?.properties?.parameter?.[nasaParam];

    if (!parameterData || typeof parameterData !== 'object') {
      throw new Error('Invalid NASA POWER payload format');
    }

    const rawPoints: { date: string; value: number }[] = [];

    // Keys are in format "YYYYMM" (e.g. "199501") or "199513" (13 is annual summary)
    for (const key of Object.keys(parameterData)) {
      if (key.length === 6) {
        const year = key.substring(0, 4);
        const month = key.substring(4, 6);
        const monthNum = parseInt(month, 10);

        // Exclude month 13 (annual mean)
        if (monthNum >= 1 && monthNum <= 12) {
          let val = parameterData[key];
          // NASA fill value is -999
          if (val > -900) {
            // For precipitation, NASA POWER returns mm/day; convert to mm/month
            if (nasaParam === 'PRECTOTCORR') {
              val = val * 30.4;
            }
            rawPoints.push({
              date: `${year}-${month}`,
              value: +val.toFixed(2),
            });
          }
        }
      }
    }

    if (rawPoints.length < 24) {
      throw new Error('Insufficient points returned from live NASA API');
    }

    return {
      points: processTimeSeries(rawPoints),
      isLiveNasa: true,
    };
  } catch (err) {
    console.warn(`NASA POWER API request failed (${err}), falling back to calibrated model:`, err);
    // Fall back smoothly to our calibrated generator for the custom lat/lon
    const tempRegion: HotspotRegion = {
      id: `custom_${lat.toFixed(1)}_${lon.toFixed(1)}`,
      name: `Custom Location (${lat >= 0 ? lat.toFixed(2) + '°N' : Math.abs(lat).toFixed(2) + '°S'}, ${lon >= 0 ? lon.toFixed(2) + '°E' : Math.abs(lon).toFixed(2) + '°W'})`,
      countryOrOcean: 'User Query',
      coordinates: [lat, lon],
      category: 'Arid / Desert',
      description: 'User-specified geographic coordinates',
      keyPhenomenon: 'Geographic Trend Exploration',
      primaryVariable: variableId,
    };

    const targetVar = EARTH_VARIABLES.find(v => v.id === variableId) || EARTH_VARIABLES[0];
    const points = generateCuratedTimeSeries(tempRegion, targetVar);

    return {
      points,
      isLiveNasa: false,
    };
  }
}

/**
 * Parse custom CSV data uploaded by user
 * Supports formats with date (YYYY-MM or YYYY-MM-DD) and value columns
 */
export function parseCustomCsv(csvText: string): { date: string; value: number }[] {
  const lines = csvText.trim().split(/\r?\n/);
  if (lines.length < 3) throw new Error('CSV file must have a header and at least 2 data rows.');

  const header = lines[0].toLowerCase();
  const sep = header.includes(';') ? ';' : header.includes('\t') ? '\t' : ',';
  const cols = lines[0].split(sep).map(c => c.trim().toLowerCase());

  let dateIdx = cols.findIndex(c => c.includes('date') || c.includes('time') || c.includes('year') || c.includes('month'));
  let valIdx = cols.findIndex(c => c.includes('val') || c.includes('temp') || c.includes('precip') || c.includes('ndvi') || c.includes('data') || c.includes('meas'));

  if (dateIdx === -1) dateIdx = 0;
  if (valIdx === -1) valIdx = 1;

  const results: { date: string; value: number }[] = [];

  for (let i = 1; i < lines.length; i++) {
    const row = lines[i].split(sep);
    if (row.length > Math.max(dateIdx, valIdx)) {
      const rawDate = row[dateIdx].trim();
      const rawVal = parseFloat(row[valIdx].trim());

      if (!isNaN(rawVal)) {
        // Normalize date to YYYY-MM
        let formattedDate = rawDate;
        if (/^\d{4}-\d{2}/.test(rawDate)) {
          formattedDate = rawDate.substring(0, 7);
        } else if (/^\d{4}\/\d{2}/.test(rawDate)) {
          formattedDate = rawDate.substring(0, 7).replace('/', '-');
        } else if (/^\d{4}$/.test(rawDate)) {
          formattedDate = `${rawDate}-01`;
        }

        results.push({ date: formattedDate, value: rawVal });
      }
    }
  }

  if (results.length < 5) {
    throw new Error('Could not parse sufficient valid rows from CSV. Please check formatting.');
  }

  // Sort chronologically
  results.sort((a, b) => a.date.localeCompare(b.date));
  return results;
}
