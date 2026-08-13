import { NavLink } from 'react-router-dom';

const links = [
  { to: '/', label: 'Dashboard' },
  { to: '/assets', label: 'Asset Register' },
  { to: '/locations', label: 'Locations' },
  { to: '/service-requests', label: 'Complaints Status' },
];

export default function Sidebar() {
  return (
    <nav className="sidebar">
      {links.map((link) => (
        <NavLink key={link.to} to={link.to} className={({ isActive }) => (isActive ? 'active-link' : '')}>
          {link.label}
        </NavLink>
      ))}
    </nav>
  );
}
