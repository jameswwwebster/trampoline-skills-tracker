import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  CalendarDaysIcon,
  WrenchScrewdriverIcon,
  XCircleIcon,
  UsersIcon,
  IdentificationIcon,
  CreditCardIcon,
  BanknotesIcon,
  EnvelopeIcon,
  ShoppingBagIcon,
  AcademicCapIcon,
  TrophyIcon,
  ChartBarIcon,
  DocumentTextIcon,
  Cog6ToothIcon,
  PaintBrushIcon,
  QuestionMarkCircleIcon,
  ClipboardDocumentListIcon,
  ArrowLeftIcon,
} from '@heroicons/react/24/outline';

const AdminDashboard = () => {
  const { canManageGymnasts, isClubAdmin } = useAuth();
  const navigate = useNavigate();

  if (!canManageGymnasts) {
    navigate('/dashboard', { replace: true });
    return null;
  }

  const Section = ({ title, children }) => (
    <div className="admin-hub__section">
      <div className="admin-hub__section-title">{title}</div>
      <div className="admin-hub__tiles">{children}</div>
    </div>
  );

  const Tile = ({ to, icon: Icon, label }) => (
    <Link to={to} className="dashboard-tile">
      <Icon className="dashboard-tile__icon" />
      <span className="dashboard-tile__label">{label}</span>
    </Link>
  );

  return (
    <div className="admin-hub">
      <div className="admin-hub__header">
        <button className="admin-hub__back" onClick={() => navigate('/dashboard')}>
          <ArrowLeftIcon style={{ width: 16, height: 16 }} /> Home
        </button>
        <h1 className="admin-hub__title">Admin</h1>
      </div>

      <Section title="Sessions">
        <Tile to="/booking/admin" icon={CalendarDaysIcon} label="Sessions" />
        <Tile to="/booking/admin/session-management" icon={WrenchScrewdriverIcon} label="Session Management" />
        <Tile to="/booking/admin/closures" icon={XCircleIcon} label="Closures" />
        <Tile to="/booking/admin/competitions" icon={TrophyIcon} label="Competitions" />
      </Section>

      <Section title="Members">
        <Tile to="/booking/admin/members" icon={UsersIcon} label="Members" />
        <Tile to="/booking/admin/bg-numbers" icon={IdentificationIcon} label="BG Numbers" />
        <Tile to="/booking/admin/memberships" icon={BanknotesIcon} label="Memberships" />
        <Tile to="/booking/admin/credits" icon={BanknotesIcon} label="Credits" />
        <Tile to="/booking/admin/charges" icon={CreditCardIcon} label="Charges" />
        <Tile to="/booking/admin/payments" icon={BanknotesIcon} label="Payments" />
      </Section>

      <Section title="Communications">
        <Tile to="/booking/admin/messages" icon={EnvelopeIcon} label="Messages" />
        <Tile to="/booking/admin/shop-orders" icon={ShoppingBagIcon} label="Shop Orders" />
      </Section>

      <Section title="Skill Tracking">
        <Tile to="/gymnasts" icon={UsersIcon} label="Gymnasts" />
        <Tile to="/certificates" icon={AcademicCapIcon} label="Certificates" />
        {isClubAdmin && <>
          <Tile to="/levels" icon={ChartBarIcon} label="Levels & Skills" />
          <Tile to="/competitions" icon={TrophyIcon} label="Competitions" />
          <Tile to="/certificate-designer" icon={DocumentTextIcon} label="Certificate Setup" />
        </>}
      </Section>

      {isClubAdmin && (
        <Section title="Settings">
          <Tile to="/club-settings" icon={Cog6ToothIcon} label="Club Settings" />
          <Tile to="/branding" icon={PaintBrushIcon} label="Club Branding" />
          <Tile to="/booking/admin/recipient-groups" icon={UsersIcon} label="Recipient Groups" />
          <Tile to="/booking/admin/help" icon={QuestionMarkCircleIcon} label="Help Page" />
        </Section>
      )}

      <Section title="Logs">
        <Tile to="/booking/admin/audit-log" icon={ClipboardDocumentListIcon} label="Audit Log" />
      </Section>
    </div>
  );
};

export default AdminDashboard;
