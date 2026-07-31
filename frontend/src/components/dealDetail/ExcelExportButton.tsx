import { useState } from 'react'
import { Button } from '../ui/Button/Button'
import { exportDealUnderwriting } from '../../api/dealDetail'
import { useToast } from '../Toast/Toast'

interface Props {
  dealId: number
  companyName: string
}

export function ExcelExportButton({ dealId, companyName }: Props) {
  const [pending, setPending] = useState(false)
  const { showToast } = useToast()

  async function handleExport() {
    setPending(true)
    try {
      const blob = await exportDealUnderwriting(dealId)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${companyName.replace(/\s+/g, '_')}_Underwriting.xlsx`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch {
      showToast('Export failed', true)
    } finally {
      setPending(false)
    }
  }

  return (
    <Button variant="secondary" size="sm" onClick={handleExport} disabled={pending}>
      {pending ? 'Exporting…' : 'Export to Excel'}
    </Button>
  )
}
