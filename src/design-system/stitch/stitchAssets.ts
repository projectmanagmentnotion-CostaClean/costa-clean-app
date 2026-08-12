export const stitchAssetPaths = {
  branding: {
    horizontalDark: '/branding/Costa_Clean-LOGO-HORIZONTAL.png',
    horizontalLight: '/branding/Costa_Clean-LOGO-AZUL.png',
    waveBackground: '/branding/wave-bg.png',
  },
  avatars: {
    accountFallback: '/ui-assets/avatars/admin-default.svg',
    clientFallback: '/ui-assets/avatars/client-default-person.svg',
    staffFallback: '/ui-assets/avatars/staff-default.svg',
  },
  properties: {
    fallback: '/ui-assets/properties/property-default.svg',
  },
  emptyStates: {
    clients: '/ui-assets/empty-states/clients-empty.svg',
  },
} as const

export const stitchVisualMetrics = {
  shell: {
    desktopRail: 72,
    desktopTopbar: 64,
    mobileTopbar: 60,
    mobileDock: 72,
  },
  avatar: {
    accountDesktop: 36,
    accountMobile: 40,
    clientList: 48,
    clientWorkspace: 72,
    staff: 28,
  },
  controls: {
    compact: 40,
    standard: 44,
    mobilePrimary: 52,
  },
  layout: {
    mobileGutter: 16,
    tabletGutter: 24,
    desktopGutter: 32,
    masterListWidth: 384,
    contentMax: 1440,
  },
} as const

export type StitchAvatarKind = 'account' | 'client' | 'property' | 'staff'

const avatarFallbackByKind: Record<StitchAvatarKind, string> = {
  account: stitchAssetPaths.avatars.accountFallback,
  client: stitchAssetPaths.avatars.clientFallback,
  property: stitchAssetPaths.properties.fallback,
  staff: stitchAssetPaths.avatars.staffFallback,
}

export function resolveStitchAvatarSource(
  avatarUrl: string | null | undefined,
  kind: StitchAvatarKind,
): string {
  const normalizedAvatarUrl = avatarUrl?.trim()
  return normalizedAvatarUrl || avatarFallbackByKind[kind]
}

export function getStitchInitials(label: string | null | undefined): string {
  const normalizedLabel = label?.trim()
  if (!normalizedLabel) return 'CC'

  return normalizedLabel
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('') || 'CC'
}
