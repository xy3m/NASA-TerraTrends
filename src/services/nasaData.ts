import { EarthVariable, HotspotRegion, TimeSeriesPoint, VariableId } from '../types/earthScience';
import { processTimeSeries } from './statistics';
import { ADDITIONAL_EARTH_VARIABLES } from './nasaDataExpanded';

const CORE_EARTH_VARIABLES: EarthVariable[] = [
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

export const EARTH_VARIABLES: EarthVariable[] = [
  ...CORE_EARTH_VARIABLES,
  ...ADDITIONAL_EARTH_VARIABLES,
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
 * Produces hemisphere-aware, multi-harmonic, regionally distinct climate time series for offline
 * operation and variables not served by the NASA POWER monthly API.
 */
export function generateCuratedTimeSeries(region: HotspotRegion, variable: EarthVariable): TimeSeriesPoint[] {
  const startYear = 1990;
  const endYear = 2024;
  const rawPoints: { date: string; value: number }[] = [];

  const config = getRegionVariableBaseline(region, variable.id);
  const [lat, lon] = region.coordinates;
  const regionSeed = Math.abs(Math.sin(lat * 12.9898 + lon * 78.233)) * 10;
  const arPersistence = config.arPersistence ?? (variable.id === 'precip' ? 0.2 : 0.5);

  let currentYear = startYear;
  let currentMonth = 1;
  let prevArNoise = 0;

  while (currentYear <= endYear) {
    const fractionalYear = currentYear + (currentMonth - 1) / 12;
    const yearOffset = fractionalYear - startYear;

    // 1. Base value + linear trend
    let value = config.baseline + config.trendPerYear * yearOffset;

    // 2. Asymmetric multi-harmonic seasonal cycle (annual + semi-annual monsoon/phenology)
    const monthAngle = ((currentMonth - 1) / 12) * 2 * Math.PI;
    const primaryWave = Math.sin(monthAngle + config.seasonalPhase);
    const secondaryWave =
      (config.harmonic2Amp ?? config.seasonalAmp * 0.16) *
      Math.sin(2 * monthAngle + (config.harmonic2Phase ?? config.seasonalPhase * 1.4 + regionSeed));

    if (config.skewPositive) {
      // Concentrate wet/haze seasons into sharper peaks with flatter dry seasons
      const shaped = primaryWave > 0 ? Math.pow(primaryWave, 0.78) : -Math.pow(-primaryWave, 1.35);
      value += config.seasonalAmp * shaped + secondaryWave;
    } else {
      value += config.seasonalAmp * primaryWave + secondaryWave;
    }

    // 3. Region-specific multi-year climate oscillations (ENSO ~3.8-5.5y + decadal PDO/AMO ~11y)
    const ensoPeriod = 3.8 + (regionSeed % 1.7);
    const ensoWave = Math.sin((fractionalYear / ensoPeriod) * 2 * Math.PI + regionSeed);
    const decadalWave = Math.sin((fractionalYear / 11.2) * 2 * Math.PI + regionSeed * 0.5);
    const oscillationScale =
      variable.id === 'temp_air' || variable.id === 'lst_day'
        ? 0.35
        : variable.id === 'precip'
          ? config.seasonalAmp * 0.12
          : config.noiseStd * 1.4;
    value += oscillationScale * (0.7 * ensoWave + 0.3 * decadalWave);

    // Major historical El Niño anomalies (1997-98, 2015-16) modulated by region
    const ensoWeight = Math.cos(lon * 0.03 + lat * 0.02);
    const elNino98 = Math.exp(-Math.pow(fractionalYear - 1998.2, 2) / 0.25);
    const elNino16 = Math.exp(-Math.pow(fractionalYear - 2016.1, 2) / 0.25);
    if (variable.id === 'temp_air' || variable.id === 'lst_day') {
      value += (elNino98 + elNino16) * (0.45 + 0.35 * Math.abs(ensoWeight));
    } else if (variable.id === 'precip') {
      value += (elNino98 + elNino16) * ensoWeight * config.seasonalAmp * 0.22;
    }

    // Volcanic aerosols in 1991-1993 (Mount Pinatubo eruption)
    if (variable.id === 'aod' && currentYear >= 1991 && currentYear <= 1993) {
      const pinatubo = Math.exp(-Math.pow(fractionalYear - 1991.6, 2) / 0.8) * 0.35;
      value += pinatubo;
    }

    // 4. Reproducible AR(1) weather persistence + stochastic innovation
    const hash = Math.sin(fractionalYear * 123.456 + lat * 78.9 + lon * 31.7) * 43758.5453;
    const uniform = hash - Math.floor(hash) - 0.5;
    const innovation = uniform * 2 * config.noiseStd;
    prevArNoise = arPersistence * prevArNoise + Math.sqrt(1 - arPersistence * arPersistence) * innovation;
    value += prevArNoise;

    // Clamping to realistic physical boundaries
    if (variable.id === 'ndvi') value = Math.max(0.01, Math.min(0.98, value));
    if (variable.id === 'aod') value = Math.max(0.02, Math.min(1.8, value));
    if (variable.id === 'precip') value = Math.max(0, value);
    if (variable.id === 'soil_moist') value = Math.max(0.02, Math.min(0.55, value));
    if (variable.id === 'evapo') value = Math.max(2, value);
    if (variable.id === 'ozone') value = Math.max(10, Math.min(80, value));

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
  harmonic2Amp?: number;
  harmonic2Phase?: number;
  arPersistence?: number;
  skewPositive?: boolean;
}

const REGION_OVERRIDES: Record<string, Partial<Record<VariableId, Partial<BaselineConfig>>>> = {
  svalbard: {
    temp_air: { baseline: -6.8, trendPerYear: 0.082, seasonalAmp: 14.5, noiseStd: 1.1, arPersistence: 0.6 },
    lst_day: { baseline: -4.2, trendPerYear: 0.09, seasonalAmp: 16.0, noiseStd: 1.3 },
    precip: { baseline: 34, trendPerYear: 0.25, seasonalAmp: 16, seasonalPhase: 3.1, skewPositive: true, noiseStd: 8 },
    ndvi: { baseline: 0.16, trendPerYear: 0.0018, seasonalAmp: 0.14, seasonalPhase: 4.5, harmonic2Amp: 0.05, noiseStd: 0.015 },
    soil_moist: { baseline: 0.22, trendPerYear: 0.0009, seasonalAmp: 0.06, seasonalPhase: 4.4, noiseStd: 0.012 },
    evapo: { baseline: 18, trendPerYear: 0.18, seasonalAmp: 14, seasonalPhase: 4.5, skewPositive: true, noiseStd: 3 },
    aod: { baseline: 0.08, trendPerYear: -0.0005, seasonalAmp: 0.04, seasonalPhase: 0.3, noiseStd: 0.015 },
    ozone: { baseline: 29.0, trendPerYear: 0.03, seasonalAmp: 6.5, seasonalPhase: 0.4, harmonic2Amp: 2.0, noiseStd: 1.9 },
  },
  rondonia: {
    temp_air: { baseline: 25.4, trendPerYear: 0.041, seasonalAmp: 1.8, harmonic2Amp: 0.7, noiseStd: 0.45 },
    lst_day: { baseline: 29.2, trendPerYear: 0.065, seasonalAmp: 3.2, harmonic2Amp: 1.1, noiseStd: 0.7 },
    precip: { baseline: 175, trendPerYear: -0.65, seasonalAmp: 115, seasonalPhase: 1.5, harmonic2Amp: 35, skewPositive: true, noiseStd: 22 },
    ndvi: { baseline: 0.82, trendPerYear: -0.0042, seasonalAmp: 0.07, harmonic2Amp: 0.025, noiseStd: 0.02 },
    soil_moist: { baseline: 0.35, trendPerYear: -0.0022, seasonalAmp: 0.06, harmonic2Amp: 0.02, noiseStd: 0.015 },
    evapo: { baseline: 135, trendPerYear: -0.72, seasonalAmp: 18, harmonic2Amp: 8, noiseStd: 5 },
    aod: { baseline: 0.26, trendPerYear: 0.005, seasonalAmp: 0.22, seasonalPhase: 2.8, skewPositive: true, noiseStd: 0.05 },
    ozone: { baseline: 33.5, trendPerYear: 0.11, seasonalAmp: 8.5, seasonalPhase: 2.9, harmonic2Amp: 3.0, noiseStd: 2.0 },
  },
  aral_sea: {
    temp_air: { baseline: 11.4, trendPerYear: 0.055, seasonalAmp: 16.5, noiseStd: 1.0 },
    lst_day: { baseline: 17.8, trendPerYear: 0.075, seasonalAmp: 21.0, noiseStd: 1.2 },
    precip: { baseline: 12, trendPerYear: -0.08, seasonalAmp: 7, seasonalPhase: 0.5, skewPositive: true, noiseStd: 5 },
    ndvi: { baseline: 0.19, trendPerYear: -0.0025, seasonalAmp: 0.09, noiseStd: 0.015 },
    soil_moist: { baseline: 0.32, trendPerYear: -0.0055, seasonalAmp: 0.05, noiseStd: 0.014 },
    evapo: { baseline: 110, trendPerYear: -1.45, seasonalAmp: 46, harmonic2Amp: 12, noiseStd: 7.0 },
    aod: { baseline: 0.31, trendPerYear: 0.006, seasonalAmp: 0.14, skewPositive: true, noiseStd: 0.045 },
    ozone: { baseline: 35.5, trendPerYear: 0.05, seasonalAmp: 7.5, seasonalPhase: 4.8, noiseStd: 1.8 },
  },
  central_valley: {
    temp_air: { baseline: 17.6, trendPerYear: 0.036, seasonalAmp: 9.2, noiseStd: 0.65 },
    lst_day: { baseline: 26.4, trendPerYear: 0.048, seasonalAmp: 14.5, noiseStd: 1.0 },
    precip: { baseline: 32, trendPerYear: -0.22, seasonalAmp: 30, seasonalPhase: 1.4, harmonic2Amp: 10, skewPositive: true, noiseStd: 11 },
    ndvi: { baseline: 0.38, trendPerYear: -0.0014, seasonalAmp: 0.14, seasonalPhase: 0.5, harmonic2Amp: 0.04, noiseStd: 0.02 },
    soil_moist: { baseline: 0.24, trendPerYear: -0.0028, seasonalAmp: 0.085, arPersistence: 0.65, noiseStd: 0.014 },
    evapo: { baseline: 58, trendPerYear: -0.28, seasonalAmp: 28, harmonic2Amp: 9, noiseStd: 5 },
    aod: { baseline: 0.20, trendPerYear: 0.0025, seasonalAmp: 0.10, seasonalPhase: 2.7, skewPositive: true, noiseStd: 0.04 },
    ozone: { baseline: 39.0, trendPerYear: -0.03, seasonalAmp: 9.0, seasonalPhase: 4.6, harmonic2Amp: 2.2, noiseStd: 1.9 },
  },
  sahel_belt: {
    temp_air: { baseline: 29.1, trendPerYear: 0.034, seasonalAmp: 4.6, seasonalPhase: 5.5, harmonic2Amp: 2.2, noiseStd: 0.55 },
    lst_day: { baseline: 38.5, trendPerYear: 0.042, seasonalAmp: 7.5, seasonalPhase: 5.5, harmonic2Amp: 3.1, noiseStd: 0.85 },
    precip: { baseline: 42, trendPerYear: 0.38, seasonalAmp: 58, seasonalPhase: 4.0, harmonic2Amp: 24, skewPositive: true, noiseStd: 14 },
    ndvi: { baseline: 0.25, trendPerYear: 0.0022, seasonalAmp: 0.16, seasonalPhase: 3.6, harmonic2Amp: 0.05, skewPositive: true, noiseStd: 0.022 },
    soil_moist: { baseline: 0.13, trendPerYear: 0.0008, seasonalAmp: 0.08, seasonalPhase: 3.7, skewPositive: true, noiseStd: 0.012 },
    evapo: { baseline: 44, trendPerYear: 0.32, seasonalAmp: 38, seasonalPhase: 3.8, skewPositive: true, noiseStd: 6 },
    aod: { baseline: 0.52, trendPerYear: 0.002, seasonalAmp: 0.24, seasonalPhase: 0.8, harmonic2Amp: 0.08, skewPositive: true, noiseStd: 0.06 },
    ozone: { baseline: 31.5, trendPerYear: 0.09, seasonalAmp: 6.2, seasonalPhase: 0.6, harmonic2Amp: 2.5, noiseStd: 1.6 },
  },
  indo_gangetic: {
    temp_air: { baseline: 25.1, trendPerYear: 0.031, seasonalAmp: 8.8, seasonalPhase: 5.2, harmonic2Amp: 2.4, noiseStd: 0.65 },
    lst_day: { baseline: 31.0, trendPerYear: 0.044, seasonalAmp: 11.2, seasonalPhase: 5.3, harmonic2Amp: 3.2, noiseStd: 0.9 },
    precip: { baseline: 68, trendPerYear: -0.25, seasonalAmp: 88, seasonalPhase: 3.9, harmonic2Amp: 36, skewPositive: true, noiseStd: 18 },
    ndvi: { baseline: 0.48, trendPerYear: 0.0011, seasonalAmp: 0.14, harmonic2Amp: 0.09, noiseStd: 0.02 },
    soil_moist: { baseline: 0.24, trendPerYear: -0.0018, seasonalAmp: 0.09, seasonalPhase: 3.7, noiseStd: 0.015 },
    evapo: { baseline: 72, trendPerYear: -0.18, seasonalAmp: 36, harmonic2Amp: 12, noiseStd: 6 },
    aod: { baseline: 0.42, trendPerYear: 0.0095, seasonalAmp: 0.25, seasonalPhase: 1.9, harmonic2Amp: 0.11, skewPositive: true, noiseStd: 0.055 },
    ozone: { baseline: 43.0, trendPerYear: 0.16, seasonalAmp: 10.5, seasonalPhase: 5.4, harmonic2Amp: 3.5, noiseStd: 2.2 },
  },
  great_barrier_reef: {
    temp_air: { baseline: 25.8, trendPerYear: 0.024, seasonalAmp: 3.6, noiseStd: 0.45 },
    lst_day: { baseline: 26.6, trendPerYear: 0.028, seasonalAmp: 3.8, noiseStd: 0.5 },
    precip: { baseline: 145, trendPerYear: 0.35, seasonalAmp: 110, harmonic2Amp: 38, skewPositive: true, noiseStd: 28 },
    ndvi: { baseline: 0.44, trendPerYear: -0.0006, seasonalAmp: 0.08, noiseStd: 0.02 },
    soil_moist: { baseline: 0.29, trendPerYear: 0.0003, seasonalAmp: 0.06, noiseStd: 0.015 },
    evapo: { baseline: 130, trendPerYear: 0.28, seasonalAmp: 24, noiseStd: 6 },
    aod: { baseline: 0.11, trendPerYear: 0.0004, seasonalAmp: 0.04, skewPositive: true, noiseStd: 0.02 },
    ozone: { baseline: 22.0, trendPerYear: 0.025, seasonalAmp: 4.5, seasonalPhase: 2.6, noiseStd: 1.4 },
  },
  tibetan_plateau: {
    temp_air: { baseline: 1.2, trendPerYear: 0.048, seasonalAmp: 11.5, noiseStd: 0.85 },
    lst_day: { baseline: 6.5, trendPerYear: 0.062, seasonalAmp: 14.5, noiseStd: 1.1 },
    precip: { baseline: 28, trendPerYear: 0.22, seasonalAmp: 32, seasonalPhase: 4.1, harmonic2Amp: 12, skewPositive: true, noiseStd: 7 },
    ndvi: { baseline: 0.24, trendPerYear: 0.0019, seasonalAmp: 0.15, seasonalPhase: 4.2, harmonic2Amp: 0.05, noiseStd: 0.018 },
    soil_moist: { baseline: 0.21, trendPerYear: 0.0007, seasonalAmp: 0.06, seasonalPhase: 4.0, noiseStd: 0.014 },
    evapo: { baseline: 36, trendPerYear: 0.25, seasonalAmp: 24, seasonalPhase: 4.2, skewPositive: true, noiseStd: 4 },
    aod: { baseline: 0.13, trendPerYear: 0.0015, seasonalAmp: 0.06, seasonalPhase: 5.4, noiseStd: 0.02 },
    ozone: { baseline: 34.0, trendPerYear: 0.06, seasonalAmp: 8.0, seasonalPhase: 5.1, harmonic2Amp: 2.4, noiseStd: 2.1 },
  },
  tokyo_metro: {
    temp_air: { baseline: 15.8, trendPerYear: 0.039, seasonalAmp: 9.8, noiseStd: 0.7 },
    lst_day: { baseline: 21.0, trendPerYear: 0.052, seasonalAmp: 13.0, noiseStd: 0.95 },
    precip: { baseline: 128, trendPerYear: 0.42, seasonalAmp: 62, harmonic2Amp: 28, skewPositive: true, noiseStd: 22 },
    ndvi: { baseline: 0.28, trendPerYear: -0.001, seasonalAmp: 0.09, noiseStd: 0.015 },
    soil_moist: { baseline: 0.26, trendPerYear: -0.0008, seasonalAmp: 0.05, noiseStd: 0.014 },
    evapo: { baseline: 68, trendPerYear: 0.15, seasonalAmp: 26, noiseStd: 5 },
    aod: { baseline: 0.27, trendPerYear: -0.0038, seasonalAmp: 0.09, seasonalPhase: 5.5, noiseStd: 0.03 },
    ozone: { baseline: 41.0, trendPerYear: -0.04, seasonalAmp: 9.5, seasonalPhase: 5.2, harmonic2Amp: 2.8, noiseStd: 2.0 },
  },
  lake_urmia: {
    temp_air: { baseline: 12.1, trendPerYear: 0.046, seasonalAmp: 13.2, noiseStd: 0.85 },
    lst_day: { baseline: 18.4, trendPerYear: 0.068, seasonalAmp: 17.5, noiseStd: 1.1 },
    precip: { baseline: 26, trendPerYear: -0.24, seasonalAmp: 18, seasonalPhase: 0.6, harmonic2Amp: 7, skewPositive: true, noiseStd: 8 },
    ndvi: { baseline: 0.27, trendPerYear: -0.0022, seasonalAmp: 0.13, seasonalPhase: 5.4, noiseStd: 0.02 },
    soil_moist: { baseline: 0.26, trendPerYear: -0.0034, seasonalAmp: 0.08, seasonalPhase: 0.4, arPersistence: 0.65, noiseStd: 0.015 },
    evapo: { baseline: 76, trendPerYear: -0.92, seasonalAmp: 34, harmonic2Amp: 10, noiseStd: 6 },
    aod: { baseline: 0.34, trendPerYear: 0.0072, seasonalAmp: 0.15, seasonalPhase: 4.5, skewPositive: true, noiseStd: 0.045 },
    ozone: { baseline: 38.0, trendPerYear: 0.07, seasonalAmp: 8.0, seasonalPhase: 4.8, noiseStd: 1.8 },
  },
  congo_basin: {
    temp_air: { baseline: 24.9, trendPerYear: 0.025, seasonalAmp: 1.4, harmonic2Amp: 0.8, noiseStd: 0.45 },
    lst_day: { baseline: 27.8, trendPerYear: 0.031, seasonalAmp: 2.2, harmonic2Amp: 1.1, noiseStd: 0.6 },
    precip: { baseline: 148, trendPerYear: -0.18, seasonalAmp: 42, seasonalPhase: 1.2, harmonic2Amp: 38, skewPositive: true, noiseStd: 20 },
    ndvi: { baseline: 0.84, trendPerYear: -0.0005, seasonalAmp: 0.04, harmonic2Amp: 0.03, noiseStd: 0.018 },
    soil_moist: { baseline: 0.36, trendPerYear: -0.0004, seasonalAmp: 0.035, harmonic2Amp: 0.025, noiseStd: 0.012 },
    evapo: { baseline: 124, trendPerYear: 0.08, seasonalAmp: 14, harmonic2Amp: 11, noiseStd: 4.5 },
    aod: { baseline: 0.32, trendPerYear: 0.0028, seasonalAmp: 0.16, harmonic2Amp: 0.12, skewPositive: true, noiseStd: 0.04 },
    ozone: { baseline: 28.0, trendPerYear: 0.055, seasonalAmp: 5.5, harmonic2Amp: 4.2, noiseStd: 1.7 },
  },
  amundsen_coast: {
    temp_air: { baseline: -11.5, trendPerYear: 0.011, seasonalAmp: 9.2, harmonic2Amp: 2.1, noiseStd: 1.5, arPersistence: 0.55 },
    lst_day: { baseline: -13.2, trendPerYear: 0.014, seasonalAmp: 10.5, harmonic2Amp: 2.4, noiseStd: 1.6 },
    precip: { baseline: 52, trendPerYear: 0.18, seasonalAmp: 20, skewPositive: true, noiseStd: 11 },
    ndvi: { baseline: 0.04, trendPerYear: 0.0, seasonalAmp: 0.02, noiseStd: 0.008 },
    soil_moist: { baseline: 0.14, trendPerYear: 0.0002, seasonalAmp: 0.03, noiseStd: 0.01 },
    evapo: { baseline: 10, trendPerYear: 0.05, seasonalAmp: 6, noiseStd: 2.5 },
    aod: { baseline: 0.05, trendPerYear: 0.0, seasonalAmp: 0.02, noiseStd: 0.012 },
    ozone: { baseline: 20.5, trendPerYear: 0.015, seasonalAmp: 5.2, seasonalPhase: 1.8, harmonic2Amp: 1.8, noiseStd: 1.6 },
  },
};

function getRegionVariableBaseline(region: HotspotRegion, varId: VariableId): BaselineConfig {
  const lat = region.coordinates[0];
  const absLat = Math.abs(lat);
  const hemisphereShift = lat < 0 ? Math.PI : 0;
  // Scale seasonality by latitude (flat near equator, strong at mid/high latitudes)
  const latScale = Math.max(0.22, Math.min(1.35, absLat / 40));

  const defaults: Partial<Record<VariableId, BaselineConfig>> = {
    temp_air: {
      baseline: +(27 - absLat * 0.45).toFixed(1),
      trendPerYear: 0.028,
      seasonalAmp: +(9.5 * latScale).toFixed(1),
      seasonalPhase: 4.6 + hemisphereShift, // Peak Jul (NH) / Jan (SH)
      noiseStd: 0.65,
    },
    precip: {
      baseline: 75.0,
      trendPerYear: -0.15,
      seasonalAmp: 45.0,
      seasonalPhase: 4.2 + hemisphereShift,
      harmonic2Amp: absLat < 15 ? 24 : 12,
      skewPositive: true,
      noiseStd: 14.0,
    },
    ndvi: {
      baseline: absLat > 60 ? 0.22 : 0.56,
      trendPerYear: -0.001,
      seasonalAmp: +(0.15 * latScale).toFixed(3),
      seasonalPhase: 4.4 + hemisphereShift,
      harmonic2Amp: 0.035,
      noiseStd: 0.02,
    },
    soil_moist: {
      baseline: 0.27,
      trendPerYear: -0.0012,
      seasonalAmp: +(0.075 * Math.max(0.4, latScale)).toFixed(3),
      seasonalPhase: 1.2 + hemisphereShift,
      arPersistence: 0.6,
      noiseStd: 0.015,
    },
    evapo: {
      baseline: +(120 - absLat * 1.1).toFixed(1),
      trendPerYear: -0.25,
      seasonalAmp: +(32 * latScale).toFixed(1),
      seasonalPhase: 4.5 + hemisphereShift,
      noiseStd: 6.0,
    },
    aod: {
      baseline: 0.20,
      trendPerYear: 0.0025,
      seasonalAmp: 0.09,
      seasonalPhase: 2.1 + hemisphereShift,
      skewPositive: true,
      noiseStd: 0.035,
    },
    lst_day: {
      baseline: +(31 - absLat * 0.48).toFixed(1),
      trendPerYear: 0.038,
      seasonalAmp: +(12.5 * latScale).toFixed(1),
      seasonalPhase: 4.6 + hemisphereShift,
      noiseStd: 0.9,
    },
    ozone: {
      baseline: +(28 + (absLat / 90) * 10).toFixed(1),
      trendPerYear: 0.05,
      seasonalAmp: 6.8,
      seasonalPhase: 4.7 + hemisphereShift,
      harmonic2Amp: 2.1,
      noiseStd: 1.8,
    },
  };

  const base = defaults[varId] || defaults['temp_air']!;
  const override = REGION_OVERRIDES[region.id]?.[varId];
  if (!override) return base;

  return {
    ...base,
    ...override,
    // Keep Southern Hemisphere seasonal peak inverted unless region override explicitly specifies seasonalPhase
    seasonalPhase: override.seasonalPhase ?? base.seasonalPhase,
  };
}

/**
 * NASA POWER monthly parameters mapped 1:1 to matching units/definitions in EARTH_VARIABLES.
 * Variables absent from NASA POWER monthly (ndvi, soil_moist m³/m³, tropospheric-only ozone)
 * are intentionally unmapped so they never silently substitute temperature (T2M).
 */
export const NASA_POWER_PARAM_MAP: Partial<Record<VariableId, string>> = {
  temp_air: 'T2M',          // Temperature at 2 Meters (°C)
  precip: 'PRECTOTCORR',    // Precipitation Corrected (mm/day -> mm/month)
  lst_day: 'TS',            // Earth Skin Temperature (°C)
  evapo: 'EVLAND',          // Evaporation Land (mm/day -> mm/month)
  aod: 'AOD_55',            // Aerosol Optical Depth 550nm (dimensionless)
  pressure: 'PS',           // Surface Pressure (kPa)
  humidity: 'RH2M',         // Relative Humidity at 2m (%)
  specific_humidity: 'QV2M',// Specific Humidity at 2m (g/kg)
  wind_speed: 'WS10M',      // Wind Speed at 10m (m/s)
  radiation_sw: 'ALLSKY_SFC_SW_DWN', // Shortwave Radiation (W/m²)
  radiation_lw: 'ALLSKY_SFC_LW_DWN', // Longwave Radiation (W/m²)
  albedo: 'ALLSKY_SRF_ALB', // Surface Albedo (fraction)
  snow_depth: 'SNODP',      // Snow Depth (cm)
  snow_precip: 'PRECSNO',   // Snowfall (mm/day -> mm/month)
  ozone_total: 'TO3',       // Total Column Ozone (DU)
  soil_moist_top: 'GWETTOP',// Top Soil Wetness (0-1)
  soil_moist_prof: 'GWETPROF',// Profile Soil Wetness (0-1)
  sst: 'TS',                // Sea Surface Temp (°C)
};

function buildCalibratedFallback(
  lat: number,
  lon: number,
  variableId: VariableId
): TimeSeriesPoint[] {
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
  return generateCuratedTimeSeries(tempRegion, targetVar);
}

const livePowerCache = new Map<
  string,
  { points: TimeSeriesPoint[]; isLiveNasa: boolean; statusMessage: string }
>();

/**
 * Fetch live data from official NASA POWER API (https://power.larc.nasa.gov)
 * Public, free, CORS-enabled NASA Earth Science endpoint.
 */
export async function fetchLiveNasaPowerData(
  lat: number,
  lon: number,
  variableId: VariableId
): Promise<{ points: TimeSeriesPoint[]; isLiveNasa: boolean; statusMessage: string }> {
  const nasaParam = NASA_POWER_PARAM_MAP[variableId];
  const targetVar = EARTH_VARIABLES.find(v => v.id === variableId) || EARTH_VARIABLES[0];

  if (!nasaParam) {
    return {
      points: buildCalibratedFallback(lat, lon, variableId),
      isLiveNasa: false,
      statusMessage: `${targetVar.shortName} is not provided by the NASA POWER monthly API; loaded calibrated model data instead.`,
    };
  }

  const cacheKey = `${lat.toFixed(2)}_${lon.toFixed(2)}_${variableId}`;
  const cached = livePowerCache.get(cacheKey);
  if (cached) {
    return {
      ...cached,
      points: cached.points.map(p => ({ ...p })),
    };
  }

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
        const yearStr = key.substring(0, 4);
        const monthStr = key.substring(4, 6);
        const yearNum = parseInt(yearStr, 10);
        const monthNum = parseInt(monthStr, 10);

        // Exclude month 13 (annual mean)
        if (monthNum >= 1 && monthNum <= 12) {
          let val = parameterData[key];
          // NASA fill value is -999
          if (typeof val === 'number' && val > -900) {
            // PRECTOTCORR, EVLAND, and PRECSNO are returned in mm/day; convert to mm/month
            if (nasaParam === 'PRECTOTCORR' || nasaParam === 'EVLAND' || nasaParam === 'PRECSNO') {
              const daysInMonth = new Date(yearNum, monthNum, 0).getDate();
              val = val * daysInMonth;
            }
            rawPoints.push({
              date: `${yearStr}-${monthStr}`,
              value: +val.toFixed(2),
            });
          }
        }
      }
    }

    if (rawPoints.length < 24) {
      throw new Error('Insufficient points returned from live NASA API');
    }

    rawPoints.sort((a, b) => a.date.localeCompare(b.date));

    const result = {
      points: processTimeSeries(rawPoints),
      isLiveNasa: true,
      statusMessage: `Successfully retrieved live NASA POWER (${nasaParam}) data!`,
    };
    livePowerCache.set(cacheKey, {
      ...result,
      points: result.points.map(p => ({ ...p })),
    });
    return result;
  } catch (err) {
    console.warn(`NASA POWER API request failed (${err}), falling back to calibrated model:`, err);
    return {
      points: buildCalibratedFallback(lat, lon, variableId),
      isLiveNasa: false,
      statusMessage: `NASA POWER request unavailable for this point; loaded calibrated model data instead.`,
    };
  }
}

const VARIABLE_CSV_KEYWORDS: Partial<Record<VariableId, string[]>> = {
  temp_air: ['raw_temp_air', 'temp_air', 't2m', 'air_temp', 'temp', 'temperature'],
  precip: ['raw_precip', 'precip', 'prectotcorr', 'prectot', 'rain', 'rainfall', 'precipitation'],
  ndvi: ['raw_ndvi', 'ndvi', 'greenness', 'vegetation', 'veg'],
  soil_moist: ['raw_soil_moist', 'soil_moist', 'rzmc', 'gwetroot', 'soil', 'moisture'],
  evapo: ['raw_evapo', 'evapo', 'evland', 'evptrns', 'evap', 'evapotranspiration'],
  aod: ['raw_aod', 'aod_55', 'aod', 'aerosol', 'haze'],
  lst_day: ['raw_lst_day', 'lst_day', 'lst', 'skin_temp', 'surface_temp', 'ts'],
  ozone: ['raw_ozone', 'ozone', 'to3', 'o3'],
};

function splitCsvRow(line: string, sep: string): string[] {
  if (sep !== ',') {
    return line.split(sep).map(cell => cell.trim().replace(/^"(.*)"$/, '$1').trim());
  }
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      cells.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  cells.push(current.trim());
  return cells;
}

function parseCsvStructure(csvText: string): { lines: string[]; sep: string; cols: string[] } | null {
  const lines = csvText
    .trim()
    .split(/\r?\n/)
    .filter(line => {
      const trimmed = line.trim();
      return trimmed.length > 0 && !trimmed.startsWith('#');
    });
  if (lines.length < 2) return null;

  const header = lines[0].toLowerCase();
  const sep = header.includes(';') ? ';' : header.includes('\t') ? '\t' : ',';
  const cols = splitCsvRow(lines[0], sep).map(c => c.toLowerCase());
  return { lines, sep, cols };
}

function findColumnForVariable(cols: string[], dateIdx: number, variableId: VariableId): number {
  const keywords = VARIABLE_CSV_KEYWORDS[variableId] || [];
  const exactIdx = cols.findIndex((c, idx) => idx !== dateIdx && keywords.includes(c));
  if (exactIdx !== -1) return exactIdx;

  return cols.findIndex(
    (c, idx) =>
      idx !== dateIdx &&
      keywords.some(kw => kw.length >= 3 && c.includes(kw))
  );
}

/**
 * Detect a matching VariableId when an uploaded CSV has a single clearly named variable column
 */
export function detectCsvPrimaryVariable(csvText: string): VariableId | null {
  const parsed = parseCsvStructure(csvText);
  if (!parsed) return null;
  const { cols } = parsed;
  const dateIdx = cols.findIndex(c => c.includes('date') || c.includes('time') || c.includes('year') || c.includes('month'));

  const matched = EARTH_VARIABLES.filter(v => findColumnForVariable(cols, dateIdx, v.id) !== -1);
  return matched.length === 1 ? matched[0].id : null;
}

/**
 * Extract optional latitude/longitude columns from a custom CSV if present
 */
export function extractCsvCoordinates(csvText: string): [number, number] | null {
  const parsed = parseCsvStructure(csvText);
  if (!parsed) return null;

  const { lines, sep, cols } = parsed;
  const latIdx = cols.findIndex(c => c === 'lat' || c === 'latitude');
  const lonIdx = cols.findIndex(c => c === 'lon' || c === 'lng' || c === 'long' || c === 'longitude');
  if (latIdx === -1 || lonIdx === -1) return null;

  const firstRow = splitCsvRow(lines[1], sep);
  const lat = parseFloat(firstRow[latIdx] ?? '');
  const lon = parseFloat(firstRow[lonIdx] ?? '');
  if (isNaN(lat) || isNaN(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    return null;
  }
  return [lat, lon];
}

/**
 * Parse custom CSV data uploaded by user
 * Supports single- and multi-variable CSVs, matching targetVariableId when present
 */
export function parseCustomCsv(
  csvText: string,
  targetVariableId?: VariableId
): { date: string; value: number }[] {
  const parsed = parseCsvStructure(csvText);
  if (!parsed || parsed.lines.length < 3) {
    throw new Error('CSV file must have a header and at least 2 data rows.');
  }

  const { lines, sep, cols } = parsed;

  let dateIdx = cols.findIndex(c => c.includes('date') || c.includes('time') || c.includes('year') || c.includes('month'));
  if (dateIdx === -1) dateIdx = 0;

  let valIdx = targetVariableId ? findColumnForVariable(cols, dateIdx, targetVariableId) : -1;

  if (valIdx === -1) {
    valIdx = cols.findIndex(
      (c, idx) =>
        idx !== dateIdx &&
        (c.startsWith('raw_') ||
          c.includes('val') ||
          c.includes('temp') ||
          c.includes('precip') ||
          c.includes('ndvi') ||
          c.includes('soil') ||
          c.includes('evap') ||
          c.includes('aod') ||
          c.includes('lst') ||
          c.includes('ozone') ||
          c.includes('data') ||
          c.includes('meas'))
    );
  }

  if (valIdx === -1) {
    const ignoredCols = new Set(['year', 'month', 'lat', 'latitude', 'lon', 'lng', 'long', 'longitude']);
    valIdx = cols.findIndex((c, idx) => idx !== dateIdx && !ignoredCols.has(c));
  }
  if (valIdx === -1) valIdx = dateIdx === 0 ? 1 : 0;

  const results: { date: string; value: number }[] = [];

  for (let i = 1; i < lines.length; i++) {
    const row = splitCsvRow(lines[i], sep);
    if (row.length > Math.max(dateIdx, valIdx)) {
      const rawDate = row[dateIdx];
      const rawVal = parseFloat(row[valIdx]);

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
