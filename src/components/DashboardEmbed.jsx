export default function DashboardEmbed({ url, title }) {
  return (
    <div className="dashboard-frame">
      <iframe
        src={url}
        title={title}
        sandbox="allow-scripts allow-same-origin allow-popups"
      />
    </div>
  )
}
