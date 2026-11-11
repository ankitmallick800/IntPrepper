import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Calendar, Trash2, ChevronDown, ChevronUp, Trophy, BarChart3, AlertCircle, Award, BookOpen, Loader2, ListChecks, TrendingUp, PlayCircle } from 'lucide-react'
import { api } from '../../api/client'
import { readLocalHistory, writeLocalHistory } from '../../lib/historyStorage'
import './History.css'

function parseSqliteTimestamp(tsString) {
  if (!tsString) return new Date()
  return new Date(String(tsString).replace(' ', 'T') + 'Z')
}

function mergeHistory(localHistory, dbHistory) {
  const merged = [...localHistory]

  dbHistory.forEach((dbItem) => {
    const dbTime = parseSqliteTimestamp(dbItem.created_at).getTime()
    const isDuplicate = localHistory.some((localItem) => {
      const localTime = new Date(localItem.timestamp).getTime()
      return (
        localItem.interviewName === dbItem.interview_name &&
        Math.abs(localItem.score - dbItem.score) < 0.05 &&
        Math.abs(localTime - dbTime) < 60000
      )
    })

    if (!isDuplicate) {
      merged.push({
        id: `db_${dbItem.id}`,
        dbId: dbItem.id,
        interviewName: dbItem.interview_name,
        score: dbItem.score,
        totalQuestions: dbItem.total_questions,
        timestamp: parseSqliteTimestamp(dbItem.created_at).toISOString(),
        questions: dbItem.questions || [],
        config: dbItem.config || { mode: 'N/A', difficulty: 'N/A', duration: 'N/A' },
        source: 'db',
      })
    }
  })

  merged.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
  return merged
}

export default function History() {
  const navigate = useNavigate()
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState(null)
  const [expandedQIndex, setExpandedQIndex] = useState(null)

  const fetchHistory = async () => {
    let dbHistory = []
    try {
      const data = await api.interviewHistory()
      dbHistory = data.interviews || []
    } catch (err) {
      console.error('Failed to fetch backend history:', err)
    }
    setHistory(mergeHistory(readLocalHistory(), dbHistory))
    setLoading(false)
  }

  useEffect(() => {
    let active = true
    api.interviewHistory()
      .then((data) => {
        if (!active) return null
        return data.interviews || []
      })
      .catch((err) => {
        console.error('Failed to fetch backend history:', err)
        return []
      })
      .then((dbHistory) => {
        if (!active || !dbHistory) return
        setHistory(mergeHistory(readLocalHistory(), dbHistory))
        setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  const handleDelete = async (item, e) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this interview from your history?')) return;

    const localHistory = readLocalHistory();

    const updatedLocal = localHistory.filter(localItem => {
      if (item.source !== 'db') {
        return localItem.id !== item.id;
      }
      const dbTime = new Date(item.timestamp).getTime();
      const localTime = new Date(localItem.timestamp).getTime();
      const timeDiff = Math.abs(localTime - dbTime);

      const isMatch = localItem.interviewName === item.interviewName &&
        Math.abs(localItem.score - item.score) < 0.05 &&
        timeDiff < 60000;
      return !isMatch;
    });

    writeLocalHistory(updatedLocal);

    const dbIdToDelete = item.source === 'db' ? item.dbId : null;

    if (dbIdToDelete) {
      try {
        await api.deleteInterview(dbIdToDelete);
      } catch (err) {
        console.error('Failed to delete backend interview:', err);
      }
    } else {
      try {
        const data = await api.interviewHistory();
        if (data.interviews) {
          const matchedDb = data.interviews.find(dbItem => {
            const dbTime = parseSqliteTimestamp(dbItem.created_at).getTime();
            const localTime = new Date(item.timestamp).getTime();
            const timeDiff = Math.abs(localTime - dbTime);
            return dbItem.interview_name === item.interviewName &&
              Math.abs(dbItem.score - item.score) < 0.05 &&
              timeDiff < 60000;
          });
          if (matchedDb) {
            await api.deleteInterview(matchedDb.id);
          }
        }
      } catch (err) {
        console.error(err);
      }
    }

    if (expandedId === item.id) setExpandedId(null);
    fetchHistory();
  };

  const handleClearAll = async () => {
    if (!confirm('Are you sure you want to permanently clear all of your interview history? This cannot be undone.')) return;

    writeLocalHistory([]);

    try {
      await api.clearInterviews();
    } catch (err) {
      console.error('Failed to clear backend history:', err);
    }

    setHistory([]);
    setExpandedId(null);
  };

  const formatDate = (isoString) => {
    const d = new Date(isoString);
    return d.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getScoreColor = (score) => {
    if (score >= 7) return 'high';
    if (score >= 4) return 'mid';
    return 'low';
  };

  const getGrade = (score) => {
    const percentage = score * 10;
    if (percentage >= 80) return { label: 'Excellent', color: 'emerald' };
    if (percentage >= 60) return { label: 'Good', color: 'blue' };
    if (percentage >= 40) return { label: 'Average', color: 'amber' };
    return { label: 'Needs Work', color: 'rose' };
  };

  // Global metrics calculations
  const totalSessions = history.length;
  const avgScore = history.length > 0 ? (history.reduce((sum, h) => sum + h.score, 0) / history.length) : 0;
  const bestScore = history.length > 0 ? Math.max(...history.map(h => h.score)) : 0;
  const totalQuestionsPracticed = history.reduce((sum, h) => sum + h.totalQuestions, 0);

  return (
    <div className="history-page">
      <div className="history-container page-container">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          {/* Header */}
          <div className="history-header">
            <div>
              <h1><BookOpen size={24} />Interview History</h1>
              <p>Review past Interviews</p>
            </div>
            {history.length > 0 && !loading && (
              <button className="btn btn-danger btn-sm clear-all-btn" onClick={handleClearAll}>
                <Trash2 size={14} /> Clear All History
              </button>
            )}
          </div>

          {/* Loader */}
          {loading ? (
            <div className="flex-center" style={{ padding: '60px' }}>
              <Loader2 size={32} className="spinning" style={{ color: 'var(--accent-blue)' }} />
            </div>
          ) : history.length === 0 ? (
            <motion.div
              className="empty-history glass-card"
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.1 }}
            >
              <div className="empty-icon-wrapper">
                <BarChart3 size={40} className="empty-icon" />
              </div>
              <h3>No History Found</h3>
              <p>You haven't completed any interviews yet. Complete your first interview to see your results here.</p>
              <button
                className="btn btn-primary btn-sm"
                onClick={() => navigate('/interview')}
                style={{ marginTop: '20px', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
              >
                <PlayCircle size={18} /> Start Your First Interview
              </button>
            </motion.div>
          ) : (
            <>
              {/* Global Analytics Section */}
              <div className="analytics-section">
                <div className="analytics-grid">
                  <div className="analytics-card glass-card">
                    <div className="analytics-icon-wrapper score">
                      <Trophy size={20} />
                    </div>
                    <div className="analytics-info">
                      <span className="analytics-label">Average Score</span>
                      <span className="analytics-value">{(avgScore * 10).toFixed(0)}%</span>
                      <span className="analytics-sub">Across {totalSessions} session{totalSessions !== 1 ? 's' : ''}</span>
                    </div>
                  </div>

                  <div className="analytics-card glass-card">
                    <div className="analytics-icon-wrapper practice">
                      <ListChecks size={20} />
                    </div>
                    <div className="analytics-info">
                      <span className="analytics-label">Total Practice</span>
                      <span className="analytics-value">{totalQuestionsPracticed}</span>
                      <span className="analytics-sub">Questions answered</span>
                    </div>
                  </div>

                  <div className="analytics-card glass-card">
                    <div className="analytics-icon-wrapper peak">
                      <TrendingUp size={20} />
                    </div>
                    <div className="analytics-info">
                      <span className="analytics-label">Peak Performance</span>
                      <span className="analytics-value">{(bestScore * 10).toFixed(0)}%</span>
                      <span className="analytics-sub">Highest session score</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* History List */}
              <div className="history-list">
                {history.map((item, index) => {
                  const grade = getGrade(item.score);
                  const isExpanded = expandedId === item.id;

                  return (
                    <motion.div
                      key={item.id}
                      className={`history-card glass-card ${isExpanded ? 'expanded' : ''}`}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                    >
                      {/* Collapsed view header */}
                      <div
                        className="history-card-header"
                        onClick={() => {
                          setExpandedId(isExpanded ? null : item.id);
                          setExpandedQIndex(null);
                        }}
                      >
                        <div className="history-summary-left">
                          <div className={`history-score-badge score-${getScoreColor(item.score)}`}>
                            <span className="badge-value">{item.score.toFixed(1)}</span>
                            <span className="badge-total">/10</span>
                          </div>
                          <div className="history-meta">
                            <h3>{item.interviewName}</h3>
                            <div className="history-meta-sub">
                              <span className="meta-item">
                                <Calendar size={12} /> {formatDate(item.timestamp)}
                              </span>
                              <span className="meta-divider">•</span>
                              <span className="meta-item">
                                <Award size={12} /> {item.totalQuestions} Questions
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="history-actions">
                          <span className={`grade-label-badge grade-${grade.color}`}>
                            {grade.label}
                          </span>
                          <button
                            className="btn btn-icon btn-ghost delete-single-btn"
                            onClick={(e) => handleDelete(item, e)}
                            title="Delete Interview"
                          >
                            <Trash2 size={16} />
                          </button>
                          {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                        </div>
                      </div>

                      {/* Detailed expanded content */}
                      {isExpanded && (
                        <motion.div
                          className="history-card-details"
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.3 }}
                        >
                          {(!item.questions || item.questions.length === 0) ? (
                            <div className="db-fallback-notice">
                              <AlertCircle size={18} />
                              <p>Detailed question-by-question breakdown is only available for interviews taken on this device.</p>
                            </div>
                          ) : (
                            <>
                              {/* Session Configuration Stat bar */}
                              <div className="details-stats-bar">
                                <div className="d-stat">
                                  <span className="d-stat-label">Interview Mode</span>
                                  <span className="d-stat-val">
                                    {item.config?.mode === 'text' ? 'Text-based' : 'Video/Voice'}
                                  </span>
                                </div>
                                <div className="d-stat-line" />
                                <div className="d-stat">
                                  <span className="d-stat-label">Difficulty</span>
                                  <span className="d-stat-val">{item.config?.difficulty || 'Mixed'}</span>
                                </div>
                                <div className="d-stat-line" />
                                <div className="d-stat">
                                  <span className="d-stat-label">Target Duration</span>
                                  <span className="d-stat-val">{item.config?.duration}s per Q</span>
                                </div>
                              </div>

                              {/* Interactive Score Distribution Chart */}
                              <div className="report-chart-section">
                                <h4 className="section-subtitle"><BarChart3 size={15} /> Score Distribution Graph</h4>
                                <div className="chart-container">
                                  <div className="chart-y-axis">
                                    <span>10</span>
                                    <span>5</span>
                                    <span>0</span>
                                  </div>
                                  <div className="chart-bars">
                                    {item.questions.map((q, qIdx) => {
                                      const qScore = q.evaluation?.score || 0;
                                      const heightPercent = (qScore / 10) * 100;
                                      const scoreColorClass = getScoreColor(qScore);

                                      return (
                                        <div key={qIdx} className="chart-bar-wrapper">
                                          <div className="chart-bar-tooltip">
                                            <span className="tooltip-score">{qScore}/10</span>
                                            <span className="tooltip-q">Q{qIdx + 1}</span>
                                          </div>
                                          <div
                                            className={`chart-bar bar-${scoreColorClass}`}
                                            style={{ height: `${heightPercent}%` }}
                                          />
                                          <span className="chart-bar-label">Q{qIdx + 1}</span>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              </div>

                              {/* Aggregated AI Summary Report */}
                              <div className="report-summary-section">
                                <h4 className="section-subtitle"><Award size={15} /> Key Insights Summary</h4>
                                <div className="ai-report-summary">
                                  <div className="summary-item-card strengths-summary">
                                    <h5>Aggregated Strengths</h5>
                                    <div className="summary-list-content">
                                      {item.questions.some(q => q.evaluation?.strengths?.length > 0) ? (
                                        item.questions.flatMap((q, qIdx) =>
                                          (q.evaluation?.strengths || []).map((str, sIdx) => (
                                            <div key={`${qIdx}-${sIdx}`} className="summary-pill strength">
                                              <span className="pill-q-ref">Q{qIdx + 1}</span>
                                              <span className="pill-text">{str}</span>
                                            </div>
                                          ))
                                        )
                                      ) : (
                                        <span className="summary-empty-msg">No specific strengths highlighted yet.</span>
                                      )}
                                    </div>
                                  </div>

                                  <div className="summary-item-card improvements-summary">
                                    <h5>Key Areas to Improve</h5>
                                    <div className="summary-list-content">
                                      {item.questions.some(q => q.evaluation?.improvements?.length > 0) ? (
                                        item.questions.flatMap((q, qIdx) =>
                                          (q.evaluation?.improvements || []).map((imp, iIdx) => (
                                            <div key={`${qIdx}-${iIdx}`} className="summary-pill improvement">
                                              <span className="pill-q-ref">Q{qIdx + 1}</span>
                                              <span className="pill-text">{imp}</span>
                                            </div>
                                          ))
                                        )
                                      ) : (
                                        <span className="summary-empty-msg">No key improvement areas highlighted.</span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>

                              {/* Question-by-Question breakdown */}
                              <h4 className="questions-title"><ListChecks size={15} /> Question-by-Question Review</h4>
                              <div className="questions-review-list">
                                {item.questions.map((q, qIdx) => {
                                  const isQExpanded = expandedQIndex === qIdx;
                                  const qScore = q.evaluation?.score || 0;

                                  return (
                                    <div key={qIdx} className="q-review-item">
                                      <div
                                        className="q-review-header"
                                        onClick={() => setExpandedQIndex(isQExpanded ? null : qIdx)}
                                      >
                                        <div className="q-review-left">
                                          <span className={`q-review-score score-${getScoreColor(qScore)}`}>
                                            {qScore}/10
                                          </span>
                                          <span className="q-review-text">Q{qIdx + 1}: {q.question}</span>
                                        </div>
                                        {isQExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                      </div>

                                      {isQExpanded && (
                                        <motion.div
                                          className="q-review-body"
                                          initial={{ opacity: 0, height: 0 }}
                                          animate={{ opacity: 1, height: 'auto' }}
                                        >
                                          <div className="review-section">
                                            <h5>Your Answer</h5>
                                            <p className="review-answer">
                                              {q.transcription || 'No answer recorded.'}
                                            </p>
                                          </div>
                                          <div className="review-section">
                                            <h5>AI Evaluation & Feedback</h5>
                                            <p className="review-feedback">
                                              {q.evaluation?.feedback || 'No feedback provided.'}
                                            </p>
                                          </div>
                                          {q.evaluation?.strengths?.length > 0 && (
                                            <div className="review-section">
                                              <h5 className="text-emerald">✅ Strengths</h5>
                                              <ul className="review-list">
                                                {q.evaluation.strengths.map((str, sIdx) => (
                                                  <li key={sIdx}>{str}</li>
                                                ))}
                                              </ul>
                                            </div>
                                          )}
                                          {q.evaluation?.improvements?.length > 0 && (
                                            <div className="review-section">
                                              <h5 className="text-amber">💡 Areas for Improvement</h5>
                                              <ul className="review-list">
                                                {q.evaluation.improvements.map((imp, iIdx) => (
                                                  <li key={iIdx}>{imp}</li>
                                                ))}
                                              </ul>
                                            </div>
                                          )}
                                        </motion.div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </>
                          )}
                        </motion.div>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            </>
          )}
        </motion.div>
      </div>
    </div>
  )
}
