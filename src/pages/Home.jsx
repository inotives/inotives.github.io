import { Link } from 'react-router-dom'
import { getAllPosts } from '../utils/content'
import PostCard from '../components/PostCard'

export default function Home() {
  const recentPosts = getAllPosts().slice(0, 3)

  return (
    <div className="space-y-16">
      {/* Hero */}
      <section className="text-center py-20">
        <h1 className="text-5xl font-bold text-white mb-4">inoTives</h1>
        <p className="text-xl text-gray-400 max-w-2xl mx-auto">
          Crypto dashboards, projects, and notes — all in one place.
        </p>
      </section>

      {/* Quick links */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Link
          to="/dashboards"
          className="group p-6 rounded-lg border border-gray-800 hover:border-gray-600 transition-colors"
        >
          <h2 className="text-lg font-semibold text-white mb-2 group-hover:text-blue-400">
            Dashboards
          </h2>
          <p className="text-sm text-gray-400">
            Live crypto monitoring and exchange metrics.
          </p>
        </Link>

        <Link
          to="/blog"
          className="group p-6 rounded-lg border border-gray-800 hover:border-gray-600 transition-colors"
        >
          <h2 className="text-lg font-semibold text-white mb-2 group-hover:text-blue-400">
            Blog
          </h2>
          <p className="text-sm text-gray-400">
            Notes, tutorials, and write-ups.
          </p>
        </Link>

        <Link
          to="/portfolio"
          className="group p-6 rounded-lg border border-gray-800 hover:border-gray-600 transition-colors"
        >
          <h2 className="text-lg font-semibold text-white mb-2 group-hover:text-blue-400">
            Portfolio
          </h2>
          <p className="text-sm text-gray-400">
            Projects and things I've built.
          </p>
        </Link>
      </section>

      {/* Recent posts */}
      {recentPosts.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-white">Recent Posts</h2>
            <Link to="/blog" className="text-sm text-gray-400 hover:text-white transition-colors">
              View all &rarr;
            </Link>
          </div>
          <div className="space-y-4">
            {recentPosts.map((post) => (
              <PostCard key={post.slug} post={post} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
