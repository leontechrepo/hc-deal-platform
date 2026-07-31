import { PIPELINE_STAGES, formatPipelineStage } from './PipelineStageBadge'
import styles from './StageTracker.module.css'

interface Props {
  currentStage: string | null
}

export function StageTracker({ currentStage }: Props) {
  const currentIndex = currentStage ? PIPELINE_STAGES.indexOf(currentStage as (typeof PIPELINE_STAGES)[number]) : -1

  return (
    <div className={styles.wrap}>
      <div className={styles.track}>
        {PIPELINE_STAGES.map((stage, i) => {
          const state = i < currentIndex ? 'done' : i === currentIndex ? 'active' : 'upcoming'
          return (
            <div key={stage} className={styles.step}>
              <div className={styles.connectorRow}>
                <span className={`${styles.dot} ${styles[state]}`} />
                {i < PIPELINE_STAGES.length - 1 && <span className={`${styles.line} ${i < currentIndex ? styles.lineDone : ''}`} />}
              </div>
              <span className={`${styles.label} ${styles[state]}`}>{formatPipelineStage(stage)}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
