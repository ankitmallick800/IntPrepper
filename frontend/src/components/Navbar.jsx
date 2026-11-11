import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Zap, Menu, X } from 'lucide-react'
import { useState } from 'react'
import './Navbar.css'

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false)
  const close = () => setMenuOpen(false)

  return (
    <motion.nav
      className="navbar"
      initial={{ y: -60, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
    >
      <Link to="/" className="navbar-brand">
        <Zap size={22} className="brand-icon" />
        <span className="brand-text">Int<span className="brand-accent">Prepper</span></span>
      </Link>

      <button className="menu-toggle" type="button" aria-label="Menu" onClick={() => setMenuOpen(!menuOpen)}>
        {menuOpen ? <X size={22} /> : <Menu size={22} />}
      </button>

      <div className={`navbar-links ${menuOpen ? 'open' : ''}`}>
        <Link to="/about" className="nav-link" onClick={close}>About</Link>
        <Link to="/history" className="nav-link" onClick={close}>History</Link>
        <Link to="/interview" className="btn btn-primary btn-nav-cta" onClick={close}>
          Start
        </Link>
      </div>
    </motion.nav>
  )
}
