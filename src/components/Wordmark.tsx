import { Anchor } from '@mantine/core'
import { Link } from 'react-router-dom'
import classes from './Wordmark.module.css'

export function Wordmark() {
  return (
    <Anchor component={Link} to="/" underline="never" className={classes.wordmark}>
      <span className={classes.yo}>Yo</span>
      <span className={classes.union}>Union</span>
      <span className={classes.ize}>ize</span>
    </Anchor>
  )
}
