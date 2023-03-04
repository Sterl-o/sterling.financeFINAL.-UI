import classes from './poweredBy.module.css'

export default function PoweredBy() {
  return (
    <div className={classes.wrapper}>
      <span>Powered by</span>
      <a href="https://firebird.finance/" target="_blank" rel="noreferrer noopener" className={classes.externalLink}>
        <img src="/images/logo-firebird-color.svg" alt="" width="12px" height="12px" />
        <span>Firebird</span>
      </a>
    </div>
  )
}
