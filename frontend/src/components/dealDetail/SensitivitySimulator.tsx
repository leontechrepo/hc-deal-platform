import { Slider } from '../ui/Slider/Slider'
import styles from './SensitivitySimulator.module.css'

export interface SimulatorValues {
  sofrRate: number
  spreadBps: number
  dealSizeM: number
  ltmEbitdaM: number
}

interface Props {
  values: SimulatorValues
  onChange: (values: SimulatorValues) => void
}

export function SensitivitySimulator({ values, onChange }: Props) {
  return (
    <div className={styles.grid}>
      <Slider
        label="SOFR Rate (%)" value={values.sofrRate} min={0} max={10} step={0.1}
        onChange={v => onChange({ ...values, sofrRate: v })}
        format={v => `${v.toFixed(2)}%`}
      />
      <Slider
        label="Spread (bps)" value={values.spreadBps} min={0} max={1200} step={5}
        onChange={v => onChange({ ...values, spreadBps: v })}
        format={v => `${v.toFixed(0)} bps`}
      />
      <Slider
        label="Deal Size ($M)" value={values.dealSizeM} min={0} max={200} step={0.5}
        onChange={v => onChange({ ...values, dealSizeM: v })}
        format={v => `$${v.toFixed(1)}M`}
      />
      <Slider
        label="LTM EBITDA ($M)" value={values.ltmEbitdaM} min={0.1} max={50} step={0.5}
        onChange={v => onChange({ ...values, ltmEbitdaM: v })}
        format={v => `$${v.toFixed(1)}M`}
      />
    </div>
  )
}
