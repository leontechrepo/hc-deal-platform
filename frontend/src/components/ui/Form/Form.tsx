import { useId, type ComponentPropsWithoutRef, type FormEventHandler, type ReactNode } from 'react'
import { Field, FieldLabel, Input } from '@leontechrepo/leon-ui'
import styles from './Form.module.css'

export { Field, FieldLabel, Input }

/** `<form>` column layout used inside Modals and drawers. */
export function Form({
  onSubmit,
  children,
  className,
}: {
  onSubmit?: FormEventHandler<HTMLFormElement>
  children: ReactNode
  className?: string
}) {
  return (
    <form className={[styles.form, className].filter(Boolean).join(' ')} onSubmit={onSubmit}>
      {children}
    </form>
  )
}

/** Equal-width fields side by side; wraps below ~560px. */
export function FormRow({ children }: { children: ReactNode }) {
  return <div className={styles.row}>{children}</div>
}

export function FormSection({ children, note }: { children: ReactNode; note?: ReactNode }) {
  return (
    <div className={styles.section}>
      {children}
      {note ? <span className={styles.note}> {note}</span> : null}
    </div>
  )
}

export function FormActions({ children }: { children: ReactNode }) {
  return <div className={styles.actions}>{children}</div>
}

export function FormError({ children }: { children: ReactNode }) {
  return (
    <div className={styles.error} role="alert">
      {children}
    </div>
  )
}

interface FieldProps {
  label: ReactNode
  hint?: ReactNode
}

/** Label + leon-ui Input. */
export function TextField({
  label,
  hint,
  ...input
}: FieldProps & ComponentPropsWithoutRef<typeof Input>) {
  const id = useId()
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input id={id} {...input} />
      {hint ? <span className={styles.hint}>{hint}</span> : null}
    </Field>
  )
}

/** Label + native select, styled with leon-ui's `.input` class. */
export function SelectField({
  label,
  hint,
  children,
  className,
  ...select
}: FieldProps & ComponentPropsWithoutRef<'select'>) {
  const id = useId()
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <select id={id} className={['input', styles.select, className].filter(Boolean).join(' ')} {...select}>
        {children}
      </select>
      {hint ? <span className={styles.hint}>{hint}</span> : null}
    </Field>
  )
}

/** Label + textarea, styled with leon-ui's `.input` class. */
export function TextareaField({
  label,
  hint,
  className,
  ...textarea
}: FieldProps & ComponentPropsWithoutRef<'textarea'>) {
  const id = useId()
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <textarea id={id} className={['input', styles.textarea, className].filter(Boolean).join(' ')} {...textarea} />
      {hint ? <span className={styles.hint}>{hint}</span> : null}
    </Field>
  )
}

/** Plain select/textarea without a label (inline editors, filter bars). */
export function SelectInput({ className, ...rest }: ComponentPropsWithoutRef<'select'>) {
  return <select className={['input', styles.select, className].filter(Boolean).join(' ')} {...rest} />
}
export function TextareaInput({ className, ...rest }: ComponentPropsWithoutRef<'textarea'>) {
  return <textarea className={['input', styles.textarea, className].filter(Boolean).join(' ')} {...rest} />
}
