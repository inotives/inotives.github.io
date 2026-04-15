export default function Footer() {
  return (
    <footer className="border-t border-gray-800 py-8 mt-auto">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 text-center text-sm text-gray-500">
        <p>&copy; {new Date().getFullYear()} inoTives. Built with React + Vite.</p>
      </div>
    </footer>
  )
}
