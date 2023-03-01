import { useMemo } from 'react'
import classes from './svg.module.css'

export default function Svg({ className, fontSize = 24, color, fill = 'none', ...props }) {
  const fsize = useMemo(() => typeof fontSize === 'string' ? fontSize : `${fontSize}px`, [fontSize])

  return (
    <svg
      {...props}
      width="1em" height="1em"
      xmlns="http://www.w3.org/2000/svg"
      fill={fill}
      className={[className, classes.svg].join(' ')}
      style={{ fontSize: fsize, color }}
    />
  )
}
