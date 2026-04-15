export default function DashboardEmbed({ url, title }) {
  return (
    <div className="w-full rounded-lg overflow-hidden border border-gray-800">
      <iframe
        src={url}
        title={title}
        className="w-full bg-white"
        style={{ height: '80vh' }}
        sandbox="allow-scripts allow-same-origin allow-popups"
      />
    </div>
  )
}
