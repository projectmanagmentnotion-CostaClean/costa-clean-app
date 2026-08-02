import { useMemo, useState } from 'react'
import {
  getStitchInitials,
  resolveStitchAvatarSource,
  type StitchAvatarKind,
} from './stitchAssets'

type StitchAvatarSize = 'account' | 'workspace' | 'client' | 'staff'

const avatarSizeClassName: Record<StitchAvatarSize, string> = {
  account: 'cc-stitch-avatar--account',
  workspace: 'cc-stitch-avatar--workspace',
  client: 'cc-stitch-avatar--client',
  staff: 'cc-stitch-avatar--staff',
}

interface StitchAvatarProps {
  label: string
  kind: StitchAvatarKind
  size: StitchAvatarSize
  avatarUrl?: string | null
  className?: string
  ariaLabel?: string
  decorative?: boolean
}

export function StitchAvatar({
  label,
  kind,
  size,
  avatarUrl,
  className,
  ariaLabel,
  decorative = true,
}: StitchAvatarProps) {
  const [hasImageError, setHasImageError] = useState(false)

  const resolvedAvatarSource = useMemo(
    () => resolveStitchAvatarSource(avatarUrl, kind),
    [avatarUrl, kind],
  )

  const initials = useMemo(() => getStitchInitials(label), [label])
  const showImage = Boolean(resolvedAvatarSource) && !hasImageError
  const shouldAnnounce = !decorative && Boolean((ariaLabel ?? label).trim())

  return (
    <span
      className={[
        'cc-stitch-avatar',
        avatarSizeClassName[size],
        className,
      ].filter(Boolean).join(' ')}
      aria-hidden={decorative ? 'true' : undefined}
      role={shouldAnnounce ? 'img' : undefined}
      aria-label={shouldAnnounce ? (ariaLabel ?? label) : undefined}
    >
      {showImage ? (
        <img
          src={resolvedAvatarSource}
          alt=""
          className="cc-stitch-avatar__image"
          onError={() => setHasImageError(true)}
        />
      ) : null}

      {!showImage ? (
        <span className="cc-stitch-avatar__fallback" aria-hidden="true">
          {initials}
        </span>
      ) : null}
    </span>
  )
}
