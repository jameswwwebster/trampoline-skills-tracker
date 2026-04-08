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

  const unreadCount = noticeboardPosts.filter(p => !p.isRead).length;
  const latestPost = noticeboardPosts[0] || null;
  const latestUnread = noticeboardPosts.find(p => !p.isRead) || null;

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
  const noticeboardPanel = (
    <Link to="/booking/noticeboard" className="dashboard-noticeboard-panel">
      <div className="dashboard-noticeboard-panel__header">
        <span className="dashboard-noticeboard-panel__title">Noticeboard</span>
        {unreadCount > 0 && (
          <span className="dashboard-noticeboard-panel__badge">{unreadCount} unread</span>
        )}
      </div>
      {noticeboardLoading ? (
        <span className="dashboard-noticeboard-panel__empty">Loading...</span>
      ) : noticeboardPosts.length === 0 ? (
        <span className="dashboard-noticeboard-panel__empty">No notices yet.</span>
      ) : (
        <ul className="dashboard-noticeboard-panel__list">
          {noticeboardPosts.slice(0, 3).map(post => (
            <li key={post.id} className={`dashboard-noticeboard-panel__item${post.isRead ? '' : ' dashboard-noticeboard-panel__item--unread'}`}>
              {!post.isRead && <span className="dashboard-noticeboard-panel__dot" />}
              {post.title}
            </li>
          ))}
        </ul>
      )}
      <div className="dashboard-noticeboard-panel__footer">
        <span className="dashboard-noticeboard-panel__cta">View noticeboard →</span>
      </div>
    </Link>
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
