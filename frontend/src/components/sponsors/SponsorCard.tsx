import { Button, Card, KeyValue, KeyValueGrid } from '@leontechrepo/leon-ui'
import { TonedBadge } from '../ui/TonedBadge'
import { InlineEditText } from '../ui/InlineEditText/InlineEditText'
import { PipelineDealsMiniTable } from '../shared/PipelineDealsMiniTable'
import type { Sponsor, SponsorInput } from '../../types'
import styles from './SponsorCard.module.css'

interface Props {
  sponsor: Sponsor
  onEdit: () => void
  onDelete: () => void
  onUpdateField: (field: keyof SponsorInput, value: string | null) => Promise<unknown>
}

export function SponsorCard({ sponsor, onEdit, onDelete, onUpdateField }: Props) {
  const items = [
    { label: 'AUM', value: sponsor.aum_m !== null ? `$${sponsor.aum_m.toFixed(0)}M` : '—' },
    { label: 'Active Deals', value: sponsor.active_deal_count },
    { label: 'Total Exposure', value: `$${sponsor.total_exposure_m.toFixed(1)}M` },
    { label: 'Coverage', value: sponsor.coverage_cadence || '—' },
  ]

  return (
    <Card className={styles.card}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={styles.name}>{sponsor.name}</span>
          {sponsor.sponsor_type && <TonedBadge tone="navy">{sponsor.sponsor_type}</TonedBadge>}
        </div>
        <div className={styles.headerActions}>
          <Button variant="ghost" size="sm" onClick={onEdit} title="Edit sponsor">Edit</Button>
          <Button variant="ghost" size="sm" onClick={onDelete} title="Delete sponsor">Delete</Button>
        </div>
      </div>

      <KeyValueGrid>
        {items.map(item => (
          <KeyValue key={item.label} label={item.label} value={item.value} />
        ))}
      </KeyValueGrid>

      <div className={styles.details}>
        <div className={styles.detailRow}>
          <span className={styles.detailLabel}>HQ</span>
          <span className={styles.detailValue}>{sponsor.hq_location || '—'}</span>
        </div>
        <div className={styles.detailRow}>
          <span className={styles.detailLabel}>Focus</span>
          <span className={styles.detailValue}>{sponsor.focus || '—'}</span>
        </div>
        <div className={styles.detailRow}>
          <span className={styles.detailLabel}>Fund Vintage</span>
          <span className={styles.detailValue}>{sponsor.fund_vintage || '—'}</span>
        </div>
        <div className={styles.detailRow}>
          <span className={styles.detailLabel}>Contact</span>
          <InlineEditText
            value={sponsor.contact_name}
            onSave={v => onUpdateField('contact_name', v)}
          />
        </div>
        <div className={styles.detailRow}>
          <span className={styles.detailLabel}>Role</span>
          <InlineEditText
            value={sponsor.contact_role}
            onSave={v => onUpdateField('contact_role', v)}
          />
        </div>
        <div className={styles.detailRow}>
          <span className={styles.detailLabel}>Email</span>
          <InlineEditText
            value={sponsor.contact_email}
            onSave={v => onUpdateField('contact_email', v)}
          />
        </div>
        <div className={styles.detailRow}>
          <span className={styles.detailLabel}>Phone</span>
          <InlineEditText
            value={sponsor.contact_phone}
            onSave={v => onUpdateField('contact_phone', v)}
          />
        </div>
        <div className={styles.detailRow}>
          <span className={styles.detailLabel}>Last Contact</span>
          <span className={styles.detailValue}>{sponsor.last_contact_date || '—'}</span>
        </div>
      </div>

      <div className={styles.note}>
        <span className={styles.detailLabel}>Relationship Note</span>
        <InlineEditText
          value={sponsor.relationship_note}
          onSave={v => onUpdateField('relationship_note', v)}
          multiline
        />
      </div>

      <div className={styles.dealsSection}>
        <div className={styles.dealsSectionTitle}>Deals</div>
        <PipelineDealsMiniTable deals={sponsor.deals} />
      </div>
    </Card>
  )
}
