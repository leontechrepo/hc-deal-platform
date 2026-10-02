import type { FeaturesInfo } from '../../api/meta'
import { extractionAvailability } from './extractionModel'
import styles from './Review.module.css'

/** Persistent notices about extraction/storage availability. Never claims extraction is on unless features say so. */
export function ExtractionBanners({ features, loading }: { features: FeaturesInfo | undefined; loading?: boolean }) {
  const a = extractionAvailability(features)
  return (
    <div className={styles.banners}>
      {a.state !== 'on' && !(loading && a.state === 'unknown') && (
        <div
          className={`${styles.banner} ${a.state === 'unknown' ? styles.bannerInfo : styles.bannerWarn}`}
          role="status"
          data-testid="extraction-banner"
          data-state={a.state}
        >
          <strong>{a.title}</strong>
          <span>{a.detail}</span>
        </div>
      )}
      {features && !features.storage_configured && (
        <div className={`${styles.banner} ${styles.bannerWarn}`} role="status" data-testid="storage-banner">
          <strong>Document storage is not configured</strong>
          <span>Uploads and downloads are unavailable until storage is set up on the server.</span>
        </div>
      )}
    </div>
  )
}
