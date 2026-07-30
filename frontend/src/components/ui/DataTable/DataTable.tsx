import styles from './DataTable.module.css'

export interface Column<T> {
  key: string
  header: string
  render: (row: T) => React.ReactNode
  width?: number | string
  mono?: boolean
}

interface Props<T> {
  columns: Column<T>[]
  rows: T[]
  rowKey: (row: T) => string | number
  emptyMessage?: string
}

export function DataTable<T>({ columns, rows, rowKey, emptyMessage = 'No data.' }: Props<T>) {
  if (rows.length === 0) {
    return <div className={styles.empty}>{emptyMessage}</div>
  }

  return (
    <table className={styles.table}>
      <thead>
        <tr>
          {columns.map(col => (
            <th key={col.key} style={col.width ? { minWidth: col.width } : undefined}>
              {col.header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map(row => (
          <tr key={rowKey(row)}>
            {columns.map(col => (
              <td key={col.key} className={col.mono ? 'mono' : undefined}>
                {col.render(row)}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}
