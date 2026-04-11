import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { bookingApi } from '../utils/bookingApi';
import CreateClubForm from '../components/CreateClubForm';
import {
  CalendarDaysIcon,
  ShoppingBagIcon,
  TrophyIcon,
  UserIcon,
  Cog6ToothIcon,
  ExclamationTriangleIcon,
  ShieldExclamationIcon,
} from '@heroicons/react/24/outline';

const Dashboard = () => {
  const {
    user, isClubAdmin, isCoach, canManageGymnasts, canViewWelfare,
    generateShareCode, generateCodeOfTheDay, getCodeOfTheDay, clearCodeOfTheDay, updateUser,
  } = useAuth();
  const navigate = useNavigate();

  const isAdminOrCoach = canManageGymnasts;

  // ── Noticeboard panel ──────────────────────────────────────────────────────
  const [noticeboardPosts, setNoticeboardPosts] = useState([]);
  const [noticeboardLoading, setNoticeboardLoading] = useState(true);

  useEffect(() => {
    bookingApi.getNoticeboard()
      .then(r => setNoticeboardPosts(r.data))
      .catch(() => {})
      .finally(() => setNoticeboardLoading(false));
  }, []);

  const [expandedPostId, setExpandedPostId] = useState(null);

  const unreadCount = noticeboardPosts.filter(p => !p.isRead).length;

  const sortedPosts = [...noticeboardPosts].sort((a, b) => {
    if (a.isRead !== b.isRead) return a.isRead ? 1 : -1;
    const priorityOrder = { URGENT: 0, IMPORTANT: 1, INFO: 2 };
    if (a.priority !== b.priority) return (priorityOrder[a.priority] ?? 2) - (priorityOrder[b.priority] ?? 2);
    return 0;
  });

  const handleExpandPost = async (post) => {
    setExpandedPostId(prev => prev === post.id ? null : post.id);
    if (!post.isRead) {
      try {
        await bookingApi.markNoticeboardRead(post.id);
        setNoticeboardPosts(prev => prev.map(p => p.id === post.id ? { ...p, isRead: true } : p));
      } catch { /* ignore */ }
    }
  };

  function stripHtml(html) {
    return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  }

  function timeAgo(dateStr) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} days ago`;
    return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  }

  // ── Today widget (admin/coach only) ────────────────────────────────────────
  const [todaySessions, setTodaySessions] = useState([]);
  const [activeSessions, setActiveSessions] = useState([]);
  const [overdueCount, setOverdueCount] = useState(0);
  const [todayLoading, setTodayLoading] = useState(false);
  const [birthdays, setBirthdays] = useState([]);

  useEffect(() => {
    if (!isAdminOrCoach) return;
    setTodayLoading(true);
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const nowMins = now.getHours() * 60 + now.getMinutes();

    bookingApi.getSessions(now.getFullYear(), now.getMonth() + 1)
      .then(res => {
        const todays = res.data.filter(s => new Date(s.date).toISOString().split('T')[0] === todayStr);
        setTodaySessions(todays);
        setActiveSessions(todays.filter(s => {
          const [sh, sm] = s.startTime.split(':').map(Number);
          const [eh, em] = s.endTime.split(':').map(Number);
          return nowMins >= sh * 60 + sm - 15 && nowMins <= eh * 60 + em;
        }));
      })
      .catch(() => {})
      .finally(() => setTodayLoading(false));

    bookingApi.getAdminCharges()
      .then(r => {
        const now2 = new Date();
        setOverdueCount(r.data.filter(c => new Date(c.dueDate) < now2 && c.status !== 'PAID').length);
      })
      .catch(() => {});

    bookingApi.getBirthdaysThisWeek()
      .then(r => setBirthdays(r.data))
      .catch(() => {});
  }, [isAdminOrCoach]);

  const showTodayWidget = isAdminOrCoach && (todaySessions.length > 0 || overdueCount > 0);

  // ── Existing metrics (admin/coach) ─────────────────────────────────────────
  const [shareCodeModal, setShareCodeModal] = useState(false);
  const [codeOfDayModal, setCodeOfDayModal] = useState(false);
  const [generatedCode, setGeneratedCode] = useState(null);
  const [codeOfDayInfo, setCodeOfDayInfo] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [loadingMetrics, setLoadingMetrics] = useState(false);
  useEffect(() => {
    if ((isCoach || isClubAdmin) && user?.club) {
      fetchMetrics();
    }
  }, [isCoach, isClubAdmin, user?.club]);

  const fetchMetrics = async () => {
    try {
      setLoadingMetrics(true);
      const response = await axios.get('/api/dashboard/metrics');
      setMetrics(response.data);
    } catch (error) {
      console.error('Failed to fetch metrics:', error);
    } finally {
      setLoadingMetrics(false);
    }
  };

  const handleGenerateShareCode = async () => {
    const result = await generateShareCode();
    if (result.success) {
      setGeneratedCode(result.shareCode);
      setShareCodeModal(true);
    }
  };

  const handleGenerateCodeOfDay = async () => {
    const result = await generateCodeOfTheDay(8);
    if (result.success) {
      setCodeOfDayInfo(result);
      setCodeOfDayModal(true);
    }
  };

  const handleGetCodeOfDay = async () => {
    const result = await getCodeOfTheDay();
    if (result.success) {
      setCodeOfDayInfo(result);
      setCodeOfDayModal(true);
    }
  };

  // ── Competition cells ──────────────────────────────────────────────────────
  const [myCompEntries, setMyCompEntries] = useState([]);
  const [compSummary, setCompSummary] = useState(null); // admin only

  useEffect(() => {
    if (!isAdminOrCoach) {
      bookingApi.getMyCompetitionEntries()
        .then(r => setMyCompEntries(r.data))
        .catch(() => {});
    }
  }, [isAdminOrCoach]);

  useEffect(() => {
    if (isAdminOrCoach) {
      bookingApi.getCompetitionEntrySummary()
        .then(r => setCompSummary(r.data))
        .catch(() => {});
    }
  }, [isAdminOrCoach]);

  // ── Club creation gate ─────────────────────────────────────────────────────
  if (isClubAdmin && !user?.club) {
    return (
      <div>
        <h1>Welcome, {user?.firstName}!</h1>
        <CreateClubForm onClubCreated={(club, updatedUser) => updateUser(updatedUser)} />
      </div>
    );
  }

  // ── Noticeboard panel ──────────────────────────────────────────────────────
  const PRIORITY_CONFIG = {
    URGENT:    { label: 'Urgent',    className: 'dashboard-nb-item--urgent' },
    IMPORTANT: { label: 'Important', className: 'dashboard-nb-item--important' },
    INFO:      { label: null,        className: '' },
  };

  const noticeboardPanel = (
    <div className="dashboard-nb">
      <div className="dashboard-nb__header">
        <span className="dashboard-nb__title">📢 Noticeboard</span>
        {unreadCount > 0 && (
          <span className="dashboard-nb__badge">{unreadCount} unread</span>
        )}
      </div>

      {noticeboardLoading ? (
        <p className="dashboard-nb__empty">Loading…</p>
      ) : sortedPosts.length === 0 ? (
        <p className="dashboard-nb__empty">No notices at the moment.</p>
      ) : (
        <ul className="dashboard-nb__list">
          {sortedPosts.slice(0, 3).map(post => {
            const cfg = PRIORITY_CONFIG[post.priority] ?? PRIORITY_CONFIG.INFO;
            const isExpanded = expandedPostId === post.id;
            const snippet = stripHtml(post.body);
            return (
              <li
                key={post.id}
                className={`dashboard-nb__item${!post.isRead ? ' dashboard-nb__item--unread' : ''} ${cfg.className}`}
                onClick={() => handleExpandPost(post)}
              >
                <div className="dashboard-nb__item-top">
                  <div className="dashboard-nb__item-title-row">
                    {cfg.label && (
                      <span className={`dashboard-nb__priority-badge dashboard-nb__priority-badge--${post.priority.toLowerCase()}`}>
                        {cfg.label}
                      </span>
                    )}
                    <span className="dashboard-nb__item-title">{post.title}</span>
                  </div>
                  <span className="dashboard-nb__item-time">{timeAgo(post.createdAt)}</span>
                </div>
                {!isExpanded && snippet && (
                  <p className="dashboard-nb__item-snippet">
                    {snippet.length > 120 ? snippet.slice(0, 120) + '…' : snippet}
                  </p>
                )}
                {isExpanded && (
                  <div
                    className="dashboard-nb__item-body"
                    dangerouslySetInnerHTML={{ __html: post.body }}
                    onClick={e => e.stopPropagation()}
                  />
                )}
              </li>
            );
          })}
        </ul>
      )}

      <div className="dashboard-nb__footer">
        <Link to="/booking/noticeboard" className="dashboard-nb__cta">View all notices →</Link>
      </div>
    </div>
  );

  // ── Section tiles ──────────────────────────────────────────────────────────
  const memberTiles = (
    <div className="dashboard-tiles">
      <Link to="/booking" className="dashboard-tile dashboard-tile--bookings" state={{ skipAdminRedirect: true }}>
        <CalendarDaysIcon className="dashboard-tile__icon" />
        <span className="dashboard-tile__label">Bookings</span>
      </Link>
      <Link to="/booking/shop" className="dashboard-tile dashboard-tile--shop">
        <ShoppingBagIcon className="dashboard-tile__icon" />
        <span className="dashboard-tile__label">Shop</span>
      </Link>
      <Link to="/my-progress" className="dashboard-tile dashboard-tile--tracking">
        <TrophyIcon className="dashboard-tile__icon" />
        <span className="dashboard-tile__label">Skill Tracking</span>
      </Link>
      <Link to="/booking/my-account" className="dashboard-tile dashboard-tile--account">
        <UserIcon className="dashboard-tile__icon" />
        <span className="dashboard-tile__label">My Account</span>
      </Link>
    </div>
  );

  const adminTiles = (
    <div className="dashboard-tiles">
      <Link to="/booking/admin" className="dashboard-tile dashboard-tile--bookings">
        <CalendarDaysIcon className="dashboard-tile__icon" />
        <span className="dashboard-tile__label">Bookings</span>
      </Link>
      <Link to="/booking/shop" className="dashboard-tile dashboard-tile--shop">
        <ShoppingBagIcon className="dashboard-tile__icon" />
        <span className="dashboard-tile__label">Shop</span>
      </Link>
      <Link to="/gymnasts" className="dashboard-tile dashboard-tile--tracking">
        <TrophyIcon className="dashboard-tile__icon" />
        <span className="dashboard-tile__label">Skill Tracking</span>
      </Link>
      <Link to="/admin-hub" className="dashboard-tile dashboard-tile--admin">
        <Cog6ToothIcon className="dashboard-tile__icon" />
        <span className="dashboard-tile__label">Admin</span>
      </Link>
    </div>
  );

  // ── Member competition cell ────────────────────────────────────────────────
  const COMP_STATUS = {
    INVITED:         { label: 'Respond',         color: '#1565c0',                         action: true },
    ACCEPTED:        { label: 'Awaiting review',  color: 'var(--text-muted, #888)',         action: false },
    PAYMENT_PENDING: { label: 'Pay now',          color: 'var(--warning-color, #e67e22)',   action: true },
    PAID:            { label: 'Entered',          color: 'var(--success-color, #27ae60)',   action: false },
    WAIVED:          { label: 'Entered',          color: 'var(--success-color, #27ae60)',   action: false },
    DECLINED:        { label: 'Declined',         color: 'var(--text-muted, #888)',         action: false },
  };

  const upcomingCompEntries = myCompEntries
    .filter(e => new Date(e.competitionEvent.startDate) >= new Date() && e.status !== 'DECLINED')
    .slice(0, 4);

  const memberCompCell = upcomingCompEntries.length > 0 ? (
    <div className="card" style={{ marginBottom: '1.25rem' }}>
      <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 className="card-title" style={{ margin: 0 }}>Competitions</h3>
        <Link to="/booking/competitions" style={{ fontSize: '0.85rem', color: 'var(--primary-color)' }}>View all →</Link>
      </div>
      <div style={{ marginTop: '0.5rem' }}>
        {upcomingCompEntries.map(entry => {
          const ev = entry.competitionEvent;
          const cfg = COMP_STATUS[entry.status] || { label: entry.status, color: 'inherit', action: false };
          return (
            <div
              key={entry.id}
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.6rem 0', borderBottom: '1px solid #eee' }}
            >
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{ev.name}</div>
                <div style={{ fontSize: '0.8rem', color: '#888' }}>
                  {entry.gymnast.firstName} {entry.gymnast.lastName} &middot;{' '}
                  {new Date(ev.startDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                </div>
              </div>
              {cfg.action ? (
                <Link
                  to={`/booking/competitions/${entry.id}/enter`}
                  style={{ fontSize: '0.82rem', fontWeight: 700, color: '#fff', background: cfg.color, padding: '0.3rem 0.75rem', borderRadius: 5, textDecoration: 'none', whiteSpace: 'nowrap' }}
                >
                  {cfg.label}
                </Link>
              ) : (
                <span style={{ fontSize: '0.82rem', fontWeight: 600, color: cfg.color, whiteSpace: 'nowrap' }}>{cfg.label}</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  ) : null;

  // ── Today widget ───────────────────────────────────────────────────────────
  const todayWidget = showTodayWidget && (
    <div className="dashboard-today">
      <div className="dashboard-today__title">Today</div>
      {todaySessions.length > 0 && (
        <div className="dashboard-today__sessions">
          {todaySessions.map(s => {
            const isActive = activeSessions.some(a => a.id === s.id);
            return isActive ? (
              <button
                key={s.id}
                className="dashboard-today__register-btn"
                onClick={() => navigate(`/booking/admin/register/${s.id}`)}
              >
                Register — {s.startTime}–{s.endTime}
              </button>
            ) : (
              <span key={s.id} className="dashboard-today__session">
                {s.startTime}–{s.endTime}
              </span>
            );
          })}
        </div>
      )}
      {overdueCount > 0 && (
        <Link to="/booking/admin/charges" className="dashboard-today__alert">
          {overdueCount} overdue charge{overdueCount !== 1 ? 's' : ''}
        </Link>
      )}
    </div>
  );

  return (
    <div className="dashboard">
      <h1 className="dashboard__welcome">Welcome back, {user?.firstName}!</h1>

      {isAdminOrCoach ? (
        <>
          {todayWidget}
          {birthdays.length > 0 && (
            <div className="dashboard-birthdays">
              <div className="dashboard-birthdays__title">Birthdays this week</div>
              {birthdays.map(g => (
                <div key={g.id} className="dashboard-birthdays__row">
                  {g.firstName} {g.lastName} turns {g.turnsAge} — {g.dayOfWeek}
                </div>
              ))}
            </div>
          )}
          {adminTiles}
          <div className="dashboard-tiles" style={{ marginTop: '0.75rem' }}>
            <Link to="/booking/admin/incidents" className="dashboard-tile dashboard-tile--incidents">
              <ExclamationTriangleIcon className="dashboard-tile__icon" />
              <span className="dashboard-tile__label">Incident Reports</span>
            </Link>
            {canViewWelfare && (
              <Link to="/booking/admin/welfare" className="dashboard-tile dashboard-tile--welfare">
                <ShieldExclamationIcon className="dashboard-tile__icon" />
                <span className="dashboard-tile__label">Welfare Reports</span>
              </Link>
            )}
          </div>
          {noticeboardPanel}
          {/* Existing metrics below */}
          {compSummary && (compSummary.accepted.length > 0 || compSummary.paymentPending.length > 0) && (
            <div className="card" style={{ marginBottom: '1.25rem' }}>
              <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 className="card-title" style={{ margin: 0 }}>Competition Entries</h3>
                <Link to="/booking/admin/competitions" style={{ fontSize: '0.85rem', color: 'var(--primary-color)' }}>Manage →</Link>
              </div>
              {compSummary.accepted.length > 0 && (
                <div style={{ marginTop: '0.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
                    <span style={{ background: '#7c35e8', color: '#fff', borderRadius: 4, padding: '0.15rem 0.5rem', fontSize: '0.78rem', fontWeight: 700 }}>
                      {compSummary.accepted.length}
                    </span>
                    <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>Awaiting your review</span>
                  </div>
                  {compSummary.accepted.slice(0, 3).map(e => (
                    <Link
                      key={e.id}
                      to={`/booking/admin/competitions/${e.competitionEvent.id}`}
                      className="dashboard-metric-link"
                      style={{ display: 'flex', justifyContent: 'space-between', padding: '0.45rem 0.5rem', borderBottom: '1px solid #eee', fontSize: '0.85rem' }}
                    >
                      <span>{e.gymnast.firstName} {e.gymnast.lastName}</span>
                      <span style={{ color: '#888', fontSize: '0.8rem' }}>{e.competitionEvent.name}</span>
                    </Link>
                  ))}
                  {compSummary.accepted.length > 3 && (
                    <p style={{ fontSize: '0.8rem', color: '#888', margin: '0.35rem 0.5rem 0' }}>
                      +{compSummary.accepted.length - 3} more
                    </p>
                  )}
                </div>
              )}
              {compSummary.paymentPending.length > 0 && (
                <div style={{ marginTop: compSummary.accepted.length > 0 ? '1rem' : '0.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
                    <span style={{ background: '#e67e22', color: '#fff', borderRadius: 4, padding: '0.15rem 0.5rem', fontSize: '0.78rem', fontWeight: 700 }}>
                      {compSummary.paymentPending.length}
                    </span>
                    <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>Awaiting payment</span>
                  </div>
                  {compSummary.paymentPending.slice(0, 3).map(e => (
                    <Link
                      key={e.id}
                      to={`/booking/admin/competitions/${e.competitionEvent.id}`}
                      className="dashboard-metric-link"
                      style={{ display: 'flex', justifyContent: 'space-between', padding: '0.45rem 0.5rem', borderBottom: '1px solid #eee', fontSize: '0.85rem' }}
                    >
                      <span>{e.gymnast.firstName} {e.gymnast.lastName}</span>
                      <span style={{ color: '#888', fontSize: '0.8rem' }}>{e.competitionEvent.name}</span>
                    </Link>
                  ))}
                  {compSummary.paymentPending.length > 3 && (
                    <p style={{ fontSize: '0.8rem', color: '#888', margin: '0.35rem 0.5rem 0' }}>
                      +{compSummary.paymentPending.length - 3} more
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="grid">
            {(isCoach || isClubAdmin) && (
              <>
                {loadingMetrics ? (
                  <div className="loading" style={{ padding: '1rem' }}>
                    <div className="spinner"></div>
                    <p>Loading metrics...</p>
                  </div>
                ) : metrics ? (
                  <>
                    {/* Level Distribution */}
                    <div className="card">
                      <div className="card-header">
                        <h3 className="card-title">Gymnast Level Distribution</h3>
                        <p className="text-muted" style={{ marginTop: '0.5rem', fontSize: '0.875rem' }}>
                          Current working levels - Click on a level to view gymnasts working at that level
                        </p>
                      </div>
                      <div>
                        {Object.entries(metrics.levelDistribution)
                          .filter(([_, data]) => data.count > 0)
                          .map(([identifier, data]) => (
                            <Link
                              key={identifier}
                              to={`/gymnasts?level=${encodeURIComponent(identifier)}`}
                              className="dashboard-metric-link"
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                padding: '0.75rem 0.5rem',
                                borderBottom: '1px solid #eee'
                              }}
                            >
                              <span><strong>Level {identifier}</strong> - {data.levelName}</span>
                              <span className="badge badge-info">{data.count} gymnast{data.count !== 1 ? 's' : ''}</span>
                            </Link>
                          ))}
                        {Object.values(metrics.levelDistribution).every(data => data.count === 0) && (
                          <p className="text-muted">No gymnast progress data available yet.</p>
                        )}
                      </div>
                    </div>

                    {/* Competition Readiness */}
                    <div className="card">
                      <div className="card-header">
                        <h3 className="card-title">Competition Readiness</h3>
                        <p className="text-muted" style={{ marginTop: '0.5rem', fontSize: '0.875rem' }}>
                          Gymnasts who have completed levels associated with competitions - Click to view
                        </p>
                      </div>
                      <div>
                        {Object.entries(metrics.competitionReadiness).length > 0 ? (
                          Object.entries(metrics.competitionReadiness).map(([competitionName, data]) => (
                            <Link
                              key={competitionName}
                              to={`/gymnasts?competition=${encodeURIComponent(competitionName)}`}
                              className="dashboard-metric-link"
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                padding: '0.75rem 0.5rem',
                                borderBottom: '1px solid #eee'
                              }}
                            >
                              <div><span><strong>{competitionName}</strong></span></div>
                              <span className="badge badge-success">{data.ready} ready</span>
                            </Link>
                          ))
                        ) : (
                          <p className="text-muted">No competition data available.</p>
                        )}
                      </div>
                    </div>

                    {/* Recent Activity */}
                    <div className="card">
                      <div className="card-header">
                        <h3 className="card-title">Recent Activity (30 days)</h3>
                      </div>
                      <div>
                        {metrics.recentActivity.skills.length > 0 || metrics.recentActivity.levels.length > 0 ? (
                          <div>
                            {metrics.recentActivity.levels.slice(0, 5).map((activity, index) => (
                              <div key={`level-${index}`} style={{ padding: '0.5rem 0', borderBottom: '1px solid #eee' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <span>
                                    <strong>{activity.gymnast.firstName} {activity.gymnast.lastName}</strong> completed{' '}
                                    <span className="badge badge-primary">Level {activity.level.identifier}</span>
                                  </span>
                                  <span className="text-muted small">
                                    {new Date(activity.updatedAt).toLocaleDateString()}
                                  </span>
                                </div>
                              </div>
                            ))}
                            {metrics.recentActivity.skills.slice(0, 3).map((activity, index) => (
                              <div key={`skill-${index}`} style={{ padding: '0.5rem 0', borderBottom: '1px solid #eee' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <span>
                                    <strong>{activity.gymnast.firstName} {activity.gymnast.lastName}</strong> mastered{' '}
                                    <em>{activity.skill.name}</em>
                                  </span>
                                  <span className="text-muted small">
                                    {new Date(activity.updatedAt).toLocaleDateString()}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-muted">No recent activity in the last 30 days.</p>
                        )}
                      </div>
                    </div>


                    {/* Code of the Day */}
                    <div className="card">
                      <div className="card-header">
                        <h3 className="card-title">Code of the Day</h3>
                        <p className="text-muted" style={{ marginTop: '0.5rem', fontSize: '0.875rem' }}>
                          Generate a daily access code for gymnasts to view their progress
                        </p>
                      </div>
                      <div className="card-body">
                        <button
                          onClick={handleGetCodeOfDay}
                          className="btn btn-primary"
                          style={{ width: '100%' }}
                        >
                          Generate Code of the Day
                        </button>
                      </div>
                    </div>
                  </>
                ) : null}
              </>
            )}
          </div>
        </>
      ) : (
        <>
          {noticeboardPanel}
          {memberTiles}
          {memberCompCell}
        </>
      )}

      {/* Share Code Modal */}
      {shareCodeModal && (
        <div className="modal-overlay active" onClick={() => setShareCodeModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Share Access Code Generated!</h3>
              <button
                className="modal-close"
                onClick={() => setShareCodeModal(false)}
                aria-label="Close modal"
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                <div style={{
                  fontSize: '2rem',
                  fontWeight: 'bold',
                  backgroundColor: '#f8f9fa',
                  padding: '1rem',
                  borderRadius: '8px',
                  border: '2px solid #28a745',
                  color: '#28a745',
                  letterSpacing: '0.2em'
                }}>
                  {generatedCode}
                </div>
              </div>
              <div style={{ fontSize: '0.9rem', lineHeight: '1.5' }}>
                <p><strong>Share this code with gymnasts so they can:</strong></p>
                <ul style={{ marginLeft: '1rem' }}>
                  <li>Go to the "Kids Login" page</li>
                  <li>Enter their name and this access code</li>
                  <li>View their own progress independently!</li>
                </ul>
                <p style={{ marginTop: '1rem', color: '#dc3545', fontWeight: 'bold' }}>
                  Keep this code safe! You can generate a new one anytime if needed.
                </p>
                {isCoach && (
                  <p style={{ marginTop: '1rem', color: '#0066cc', fontStyle: 'italic' }}>
                    As a coach, this code gives access to all gymnasts in your club.
                  </p>
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button
                onClick={() => setShareCodeModal(false)}
                className="btn btn-primary"
              >
                Got it!
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Code of the Day Modal */}
      {codeOfDayModal && (
        <div className="modal-overlay active" onClick={() => setCodeOfDayModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Code of the Day</h3>
              <button
                className="modal-close"
                onClick={() => setCodeOfDayModal(false)}
                aria-label="Close modal"
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              {codeOfDayInfo?.isActive ? (
                <div>
                  <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                    <div style={{
                      fontSize: '2rem',
                      fontWeight: 'bold',
                      backgroundColor: '#f8f9fa',
                      padding: '1rem',
                      borderRadius: '8px',
                      border: '2px solid #007bff',
                      color: '#007bff',
                      letterSpacing: '0.2em'
                    }}>
                      {codeOfDayInfo.codeOfTheDay}
                    </div>
                  </div>
                  <div style={{ fontSize: '0.9rem', lineHeight: '1.5' }}>
                    <p><strong>Current club-wide access code</strong></p>
                    <p><strong>Expires:</strong> {new Date(codeOfDayInfo.expiresAt).toLocaleString()}</p>
                    <p style={{ marginTop: '1rem' }}>Any gymnast in your club can use this code to access their progress.</p>
                  </div>
                  <div style={{ marginTop: '1rem', display: 'flex', gap: '1rem' }}>
                    <button onClick={handleGenerateCodeOfDay} className="btn btn-outline">
                      Generate New Code
                    </button>
                    <button onClick={() => clearCodeOfTheDay().then(() => setCodeOfDayModal(false))} className="btn btn-secondary">
                      Clear Code
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <p>No active code of the day. Generate one for club-wide access.</p>
                  <button onClick={handleGenerateCodeOfDay} className="btn btn-primary">
                    Generate Code of the Day
                  </button>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button
                onClick={() => setCodeOfDayModal(false)}
                className="btn btn-secondary"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
