import { useRef, useState } from 'react';
import { NavLink, Link } from 'react-router-dom';
import logo from '../assets/indianoil-logo.png';
import './Header.css';

const CLOSE_DELAY_MS = 200;

const navSections = [
  { label: 'Home', to: '/' },
  {
    label: 'Complaints Status',
    items: [
      { label: 'Open Complaints', to: '/service-requests' },
      { label: 'New Complaint', to: '/service-requests/new' },
    ],
  },
  {
    label: 'Asset Inventory',
    items: [
      { label: 'Asset Register', to: '/assets' },
      { label: 'Create Asset', to: '/assets/new' },
      { label: 'Locations', to: '/locations' },
    ],
  },
  { label: 'Reports', to: '/reports' },
];

export default function Header({ onLogout }) {
  const [activeDropdown, setActiveDropdown] = useState(null);
  const closeTimer = useRef(null);

  const cancelClose = () => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };

  const openDropdown = (label) => {
    cancelClose();
    setActiveDropdown(label);
  };

  const scheduleClose = () => {
    cancelClose();
    closeTimer.current = setTimeout(() => setActiveDropdown(null), CLOSE_DELAY_MS);
  };

  return (
    <header className="header">
      <div className="header-top">
        <div className="brand-block">
          <img className="logo-image" src={logo} alt="IndianOil" />
        </div>

        <div className="header-actions">
          <button className="logout-button" onClick={onLogout}>Logout</button>
        </div>
      </div>

      <div className="nav-shell">
        <ul className="nav-list">
          {navSections.map((section) => (
            <li
              key={section.label}
              className="nav-item"
              onMouseEnter={() => section.items && openDropdown(section.label)}
              onMouseLeave={() => section.items && scheduleClose()}
            >
              {section.items ? (
                <button
                  className={`nav-button${activeDropdown === section.label ? ' open' : ''}`}
                  onClick={() => setActiveDropdown(activeDropdown === section.label ? null : section.label)}
                >
                  <span>{section.label}</span>
                  <span className="nav-arrow">▾</span>
                </button>
              ) : (
                <NavLink
                  to={section.to}
                  className={({ isActive }) => `nav-button nav-link${isActive ? ' active-link' : ''}`}
                >
                  {section.label}
                </NavLink>
              )}

              {section.items && activeDropdown === section.label && (
                <div
                  className="dropdown-panel"
                  onMouseEnter={cancelClose}
                  onMouseLeave={scheduleClose}
                >
                  {section.items.map((item) => (
                    <Link
                      key={item.to}
                      to={item.to}
                      className="dropdown-link"
                      onClick={() => setActiveDropdown(null)}
                    >
                      {item.label}
                    </Link>
                  ))}
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>
    </header>
  );
}
