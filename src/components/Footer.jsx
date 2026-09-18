import packageJson from '../../package.json'

export default function Footer() {
  const releaseUrl = `https://github.com/inotives/inotives.github.io/releases/tag/v${packageJson.version}`

  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <p>
          &copy; {new Date().getFullYear()} inoTives. Built with React + Vite.{' '}
          <a href={releaseUrl}>Release v{packageJson.version}</a>
        </p>
      </div>
    </footer>
  )
}
