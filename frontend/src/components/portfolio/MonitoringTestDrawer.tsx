import { useState } from 'react'
import { DataTable, type Column } from '../ui/DataTable/DataTable'
import { Button } from '@leontechrepo/leon-ui'
import { InlineEditText } from '../ui/InlineEditText/InlineEditText'
import { PaymentStatusBadge, RiskBadge } from './PortfolioBadges'
import { usePortfolioTests, useCreatePortfolioTest, useUpdatePortfolioPosition } from '../../hooks/usePortfolio'
import { useToast } from '../Toast/Toast'
import type { PortfolioMonitoringTest, PortfolioPosition, PortfolioTestInput } from '../../types'
import { Form, FormActions, FormRow, TextField, TextareaField } from '../ui/Form/Form'
import { toNullableNumber } from '../../domain/format'
import { fmtM as fmtMoney, fmtX } from '../../domain/format'
import styles from './MonitoringTestDrawer.module.css'

const EMPTY_TEST: PortfolioTestInput = { test_date: '', leverage: null, dscr: null, fccr: null, covenant_status: '', notes: '' }

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
          <span>{fmtMoney(position.current_balance_m)}</span>
        </div>
        <div className={styles.snapshotRow}>
          <span className={styles.snapshotLabel}>Rate</span>
          <span>{position.rate !== null ? `${position.rate.toFixed(2)}%` : '—'}</span>
        </div>
        <div className={styles.snapshotRow}>
          <span className={styles.snapshotLabel}>Payment Status</span>
          <select
            className="input"
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
            className="input"
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
            className="input"
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
            className="input"
            type="date"
            value={nextTestDate}
            onChange={e => setNextTestDate(e.target.value)}
          />
          <Button onClick={handleSetNextTestDate} disabled={!nextTestDate}>Set</Button>
          <button className={styles.skipLink} onClick={() => setShowNextTestPrompt(false)}>Skip for now</button>
        </div>
      )}

      <div className={styles.section}>
        <div className={styles.sectionTitle}>Test History</div>
        <DataTable columns={testColumns} rows={tests} rowKey={t => t.id} emptyMessage="No tests logged yet." />
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>Log New Test</div>
        <Form onSubmit={handleLogTest}>
          <FormRow>
            <TextField
              label="Test Date *"
              type="date"
              value={testForm.test_date}
              onChange={e => setTestForm(f => ({ ...f, test_date: e.target.value }))}
            />
            <TextField
              label="Leverage (x)"
              type="number"
              step="any"
              value={testForm.leverage ?? ''}
              onChange={e => setTestForm(f => ({ ...f, leverage: toNullableNumber(e.target.value) }))}
            />
          </FormRow>
          <FormRow>
            <TextField
              label="DSCR (x)"
              type="number"
              step="any"
              value={testForm.dscr ?? ''}
              onChange={e => setTestForm(f => ({ ...f, dscr: toNullableNumber(e.target.value) }))}
            />
            <TextField
              label="FCCR (x)"
              type="number"
              step="any"
              value={testForm.fccr ?? ''}
              onChange={e => setTestForm(f => ({ ...f, fccr: toNullableNumber(e.target.value) }))}
            />
          </FormRow>
          <TextField
            label="Covenant Status"
            value={testForm.covenant_status ?? ''}
            onChange={e => setTestForm(f => ({ ...f, covenant_status: e.target.value }))}
          />
          <TextareaField
            label="Notes"
            value={testForm.notes ?? ''}
            onChange={e => setTestForm(f => ({ ...f, notes: e.target.value }))}
          />
          <FormActions>
            <Button type="submit" disabled={createTest.isPending}>
              {createTest.isPending ? 'Logging…' : 'Log Test'}
            </Button>
          </FormActions>
        </Form>
      </div>
    </div>
  )
}
