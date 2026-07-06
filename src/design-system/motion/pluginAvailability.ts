import {
  approvedGsapPlugins,
  getDisabledGsapPlugins,
  loadGsapPlugin,
  type GsapPluginName,
  type GsapPluginResolution,
} from './gsapPlugins'

export interface GsapPluginAvailabilitySummary {
  available: GsapPluginName[]
  details: GsapPluginResolution[]
  disabledByPolicy: GsapPluginName[]
  notAvailable: GsapPluginName[]
}

export async function getGsapPluginAvailability(): Promise<GsapPluginAvailabilitySummary> {
  const recommendedResults = await Promise.all(approvedGsapPlugins.map((pluginName) => loadGsapPlugin(pluginName)))
  const disabledResults = await Promise.all(getDisabledGsapPlugins().map((pluginName) => loadGsapPlugin(pluginName)))
  const details = [...recommendedResults, ...disabledResults]

  return {
    available: details.filter((item) => item.state === 'available').map((item) => item.name),
    details,
    disabledByPolicy: details.filter((item) => item.state === 'disabledByPolicy').map((item) => item.name),
    notAvailable: details.filter((item) => item.state === 'notAvailable').map((item) => item.name),
  }
}
