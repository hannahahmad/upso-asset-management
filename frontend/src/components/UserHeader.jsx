import { NavLink } from 'react-router-dom';
import logo from '../assets/indianoil-logo.png';
import './Header.css';

const navItems = [
  { label: 'Home', to: '/' },
  { label: 'Create Complaint', to: '/complaints/new' },
  { label: 'Complaint Status', to: '/complaints' },
];

export default function UserHeader({ user, onLogout }) {
  return (
    <header className="header">
      <div className="header-top">
        <div className="brand-block">
          <img className="logo-image" src={logo} alt="IndianOil" />
        </div>
        <div className="header-actions">
          <span style={{ marginRight: '1rem' }}>{user.name}</span>
          <button className="logout-button" onClick={onLogout}>Logout</button>
        </div>
      </div>

      <div className="nav-shell">
        <ul className="nav-list">
          {navItems.map((item) => (
            <li key={item.to} className="nav-item">
              <NavLink
                to={item.to}
                end
                className={({ isActive }) => `nav-button nav-link${isActive ? ' active-link' : ''}`}
              >
                {item.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </div>
    </header>
  );
}
