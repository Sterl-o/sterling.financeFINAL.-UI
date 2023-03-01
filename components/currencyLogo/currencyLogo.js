import styles from './currencyLogo.module.css'

export default function CurrencyLogo({ src, alt = '', className, ...props }) {
  return (
    <img
      {...props}
      src={src || '/tokens/unknown-logo--dark.svg'}
      alt={alt}
      className={[styles.currencyLogo, className].join(' ')}
      onError={(e) => {
        e.target.onerror = null
        e.target.src = '/tokens/unknown-logo--dark.svg'
      }}
    />
  )
}
