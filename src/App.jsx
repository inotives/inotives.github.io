import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Home from './pages/Home'
import Notes from './pages/Notes'
import Note from './pages/Note'
import Portfolio from './pages/Portfolio'
import About from './pages/About'
import Projects from './pages/Projects'
import AdhocResearchesProject from './pages/AdhocResearchesProject'
import StockPreOpenProject from './pages/StockPreOpenProject'
import StockWeeklyReportsProject from './pages/StockWeeklyReportsProject'
import Resume from './pages/Resume'
import NotFound from './pages/NotFound'

function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/notes" element={<Notes />} />
        <Route path="/notes/:slug" element={<Note />} />
        <Route path="/portfolio" element={<Portfolio />} />
        <Route path="/about" element={<About />} />
        <Route path="/projects" element={<Projects />} />
        <Route
          path="/projects/researches-adhoc"
          element={<AdhocResearchesProject />}
        />
        <Route
          path="/projects/research-stocks-pro-open-price"
          element={<StockPreOpenProject />}
        />
        <Route
          path="/projects/research-stocks-pre-open-price"
          element={<StockPreOpenProject />}
        />
        <Route
          path="/projects/research-stocks-weekly-summary"
          element={<StockWeeklyReportsProject />}
        />
        <Route path="/resume" element={<Resume />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}

export default App
