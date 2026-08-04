import { useState } from 'react'
import type { FormEvent } from 'react'
import { isClerkAPIResponseError } from '@clerk/react/errors'
import { useAuth } from '@clerk/react'
import { useSignIn } from '@clerk/react/legacy'
import styles from './LoginPage.module.css'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function MicrosoftMark() {
  return (
    <span className={styles.msGrid} aria-hidden="true">
      <span className={styles.msRed} />
      <span className={styles.msGreen} />
      <span className={styles.msBlue} />
      <span className={styles.msYellow} />
    </span>
  )
}

function getClerkErrorMessage(error: unknown): string {
  if (isClerkAPIResponseError(error)) {
    return error.errors[0]?.longMessage || error.errors[0]?.message || 'Unable to start Microsoft SSO.'
  }
  if (error instanceof Error) return error.message
  return 'Unable to start Microsoft SSO.'
}

export function LoginPage() {
  const { isLoaded: authLoaded, isSignedIn } = useAuth()
  const { signIn, isLoaded: signInLoaded } = useSignIn()
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const isReady = authLoaded && signInLoaded && !!signIn

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const identifier = email.trim()
    setError('')

    if (!identifier) {
      setError('Enter your work email to continue.')
      return
    }
    if (!EMAIL_PATTERN.test(identifier)) {
      setError('Enter a valid work email address.')
      return
    }
    if (!isReady) {
      setError('Authentication is still loading. Try again in a moment.')
      return
    }

    setIsSubmitting(true)
    try {
      await signIn.authenticateWithRedirect({
        strategy: 'enterprise_sso',
        identifier,
        redirectUrl: '/sso-callback',
        redirectUrlComplete: '/',
      })
    } catch (err) {
      setIsSubmitting(false)
      setError(getClerkErrorMessage(err))
    }
  }

  if (authLoaded && isSignedIn) return null

  return (
    <div className={styles.page}>
      <div className={styles.grid}>
        <main className={styles.main}>
          <section className={styles.heroSection}>
            <div className={styles.eyebrow}>Corporate Credit &mdash; Deal Platform</div>
            <h2 className={styles.displayHeading}>
              HC Deal<br />
              <span className={styles.accent}>Pipeline</span>
            </h2>
          </section>

          <section className={styles.formSection}>
            <form className={styles.form} onSubmit={handleSubmit} noValidate>
              <div className={styles.formHeader}>
                <h1 className={styles.formTitle}>Sign in to your account</h1>
                <p className={styles.formSubtitle}>
                  Use your company Microsoft account to continue.
                </p>
              </div>

              <div className={styles.field}>
                <label htmlFor="work-email" className={styles.label}>Work email</label>
                <input
                  id="work-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  aria-invalid={!!error}
                  aria-describedby={error ? 'sign-in-error' : undefined}
                  required
                  className={styles.input}
                />
              </div>

              {error && (
                <div id="sign-in-error" role="alert" className={styles.errorBox}>
                  {error}
                </div>
              )}

              <button
                type="submit"
                className={styles.submitBtn}
                disabled={!isReady || isSubmitting}
              >
                <MicrosoftMark />
                {isSubmitting ? 'Redirecting to Microsoft…' : 'Continue with Microsoft'}
                {!isSubmitting && <span aria-hidden="true" className={styles.arrow}>→</span>}
              </button>

              <p className={styles.hint}>
                Access is restricted to provisioned internal users. Contact your administrator if sign-in succeeds but access is pending.
              </p>
            </form>
          </section>
        </main>

        <aside className={styles.aside}>
          <div className={styles.brandCard}>
            <div className={styles.brandName}>Corporate Credit</div>
            <div className={styles.brandDivider} />
            <div className={styles.brandSub}>Deal Pipeline</div>
            <div className={styles.brandTagline}>Internal Deal Management Platform</div>
          </div>
        </aside>
      </div>
    </div>
  )
}
