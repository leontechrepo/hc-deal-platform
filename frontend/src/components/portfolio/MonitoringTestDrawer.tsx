import { useState } from 'react'
import { DataTable, type Column } from '../ui/DataTable/DataTable'
import { Button } from '../ui/Button/Button'
import { InlineEditText } from '../ui/InlineEditText/InlineEditText'
import { PaymentStatusBadge, RiskBadge } from './PortfolioBadges'
import { usePortfolioTests, useCreatePortfolioTest, useUpdatePortfolioPosition } from '../../hooks/usePortfolio'
import { useToast } from '../Toast/Toast'
import type { PortfolioMonitoringTest, PortfolioPosition, PortfolioTestInput } from '../../types'
import formStyles from '../shared/Form.module.css'
import styles from './MonitoringTestDrawer.module.css'

function fmtM(value: number | null): string {
  return value === null ? '—' : `$${value.toFixed(2)}M`
}

function fmtX(value: number | null): string {
  return value === null ? '—' : `${value.toFixed(2)}x`
}

const EMPTY_TEST: PortfolioTestInput = { test_date: '', leverage: null, dscr: null, fccr: null, covenant_status: '', notes: '' }

function toNullableNumber(v: string): number | null {
  if (v.trim() === '') return null
  const n = Number(v)
  return Number.isNaN(n) ? null : n
}

interface Props {
  position: PortfolioPosition
}

export function MonitoringTestDrawer({ position }: Props) {
  const { data: tests = [] } = usePortfolioTests(position.deal_id)
  const createTest = useCreatePortfolioTest()
  const updatePosition = useUpdatePortfolioPosition()
  const { showToast } = useToast()

  const [testForm, setTestForm] = useState<PortfolioTestInput>(EMPTY_TEST)
  const [showNextTestPrompt, setShowNextTestPrompt] = useState(false)
  const [nextTestDate, setNextTestDate] = useState('')

  async function handleLogTest(e: React.FormEvent) {
    e.preventDefault()
    if (!testForm.test_date) {
      showToast('Test date is required', true)
      return
    }
    try {
      await createTest.mutateAsync({ dealId: position.deal_id, body: testForm })
      showToast('Test logged — leverage/DSCR/covenant status updated on the position.')
      setTestForm(EMPTY_TEST)
      setShowNextTestPrompt(true)
    } catch {
      showToast('Failed to log test', true)
    }
  }

  async function handleSetNextTestDate() {
    if (!nextTestDate) return
    await updatePosition.mutateAsync({ dealId: position.deal_id, body: { next_test_date: nextTestDate } })
    setShowNextTestPrompt(false)
    setNextTestDate('')
    showToast('Next test date set')
  }

  const testColumns: Column<PortfolioMonitoringTest>[] = [
    { key: 'test_date', header: 'Test Date', render: t => t.test_date },
    { key: 'leverage', header: 'Leverage', render: t => fmtX(t.leverage), mono: true },
    { key: 'dscr', header: 'DSCR', render: t => fmtX(t.dscr), mono: true },
    { key: 'fccr', header: 'FCCR', render: t => fmtX(t.fccr), mono: true },
    { key: 'covenant_status', header: 'Covenant Status', render: t => t.covenant_status || '—' },
    { key: 'notes', header: 'Notes', render: t => t.notes || '—' },
  ]

  return (
    <div className={styles.drawer}>
      <div className={styles.snapshot}>
        <div className={styles.snapshotRow}>
          <span className={styles.snapshotLabel}>Funded</span>
          <span>{position.funded_date || '—'}</span>
        </div>
        <div className={styles.snapshotRow}>
          <span className={styles.snapshotLabel}>Balance</span>
          <span>{fmtM(position.current_balance_m)}</span>
        </div>
        <div className={styles.snapshotRow}>
          <span className={styles.snapshotLabel}>Rate</span>
          <span>{position.rate !== null ? `${position.rate.toFixed(2)}%` : '—'}</span>
        </div>
        <div className={styles.snapshotRow}>
          <span className={styles.snapshotLabel}>Payment Status</span>
          <select
            className={formStyles.select}
            value={position.payment_status ?? ''}
            onChange={e => updatePosition.mutate({ dealId: position.deal_id, body: { payment_status: (e.target.value || null) as PortfolioPosition['payment_status'] } })}
          >
            <option value="">—</option>
            <option value="Current">Current</option>
            <option value="PIK">PIK</option>
            <option value="Past Due">Past Due</option>
            <option value="Default">Default</option>
          </select>
          <PaymentStatusBadge status={position.payment_status} />
        </div>
        <div className={styles.snapshotRow}>
          <span className={styles.snapshotLabel}>Risk</span>
          <select
            className={formStyles.select}
            value={position.risk ?? ''}
            onChange={e => updatePosition.mutate({ dealId: position.deal_id, body: { risk: (e.target.value || null) as PortfolioPosition['risk'] } })}
          >
            <option value="">—</option>
            <option value="Pass">Pass</option>
            <option value="Watch">Watch</option>
          </select>
          <RiskBadge risk={position.risk} />
        </div>
        <div className={styles.snapshotRow}>
          <span className={styles.snapshotLabel}>Covenant Status</span>
          <InlineEditText
            value={position.covenant_status}
            onSave={v => updatePosition.mutateAsync({ dealId: position.deal_id, body: { covenant_status: v } })}
          />
        </div>
        <div className={styles.snapshotRow}>
          <span className={styles.snapshotLabel}>Next Test Date</span>
          <input
            className={formStyles.input}
            type="date"
            value={position.next_test_date ?? ''}
            onChange={e => updatePosition.mutate({ dealId: position.deal_id, body: { next_test_date: e.target.value || null } })}
          />
        </div>
      </div>

      {showNextTestPrompt && (
        <div className={styles.followUp}>
          <span>When is the next test due?</span>
          <input
            className={formStyles.input}
            type="date"
            value={nextTestDate}
            onChange={e => setNextTestDate(e.target.value)}
          />
          <Button variant="primary" onClick={handleSetNextTestDate} disabled={!nextTestDate}>Set</Button>
          <button className={styles.skipLink} onClick={() => setShowNextTestPrompt(false)}>Skip for now</button>
        </div>
      )}

      <div className={styles.section}>
        <div className={styles.sectionTitle}>Test History</div>
        <DataTable columns={testColumns} rows={tests} rowKey={t => t.id} emptyMessage="No tests logged yet." />
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>Log New Test</div>
        <form className={formStyles.form} onSubmit={handleLogTest} style={{ minWidth: 'auto' }}>
          <div className={formStyles.row}>
            <div className={formStyles.field}>
              <label className={formStyles.label}>Test Date *</label>
              <input
                className={formStyles.input}
                type="date"
                value={testForm.test_date}
                onChange={e => setTestForm(f => ({ ...f, test_date: e.target.value }))}
              />
            </div>
            <div className={formStyles.field}>
              <label className={formStyles.label}>Leverage (x)</label>
              <input
                className={formStyles.input}
                type="number"
              step="any"
                value={testForm.leverage ?? ''}
                onChange={e => setTestForm(f => ({ ...f, leverage: toNullableNumber(e.target.value) }))}
              />
            </div>
          </div>
          <div className={formStyles.row}>
            <div className={formStyles.field}>
              <label className={formStyles.label}>DSCR (x)</label>
              <input
                className={formStyles.input}
                type="number"
              step="any"
                value={testForm.dscr ?? ''}
                onChange={e => setTestForm(f => ({ ...f, dscr: toNullableNumber(e.target.value) }))}
              />
            </div>
            <div className={formStyles.field}>
              <label className={formStyles.label}>FCCR (x)</label>
              <input
                className={formStyles.input}
                type="number"
              step="any"
                value={testForm.fccr ?? ''}
                onChange={e => setTestForm(f => ({ ...f, fccr: toNullableNumber(e.target.value) }))}
              />
            </div>
          </div>
          <div className={formStyles.field}>
            <label className={formStyles.label}>Covenant Status</label>
            <input
              className={formStyles.input}
              value={testForm.covenant_status ?? ''}
              onChange={e => setTestForm(f => ({ ...f, covenant_status: e.target.value }))}
            />
          </div>
          <div className={formStyles.field}>
            <label className={formStyles.label}>Notes</label>
            <textarea
              className={formStyles.textarea}
              value={testForm.notes ?? ''}
              onChange={e => setTestForm(f => ({ ...f, notes: e.target.value }))}
            />
          </div>
          <div className={formStyles.actions}>
            <Button type="submit" variant="primary" disabled={createTest.isPending}>
              {createTest.isPending ? 'Logging…' : 'Log Test'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
