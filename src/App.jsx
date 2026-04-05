import React, { useState, useEffect, useMemo, useRef } from 'react';
import './App.css';

// --- Utilities ---
const formatDate = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
const getFirstDayOfMonth = (year, month) => new Date(year, month, 1).getDay();

const App = () => {
  // --- States ---
  const [viewDate, setViewDate] = useState(new Date()); // Year/Month view
  const [selectedDate, setSelectedDate] = useState(formatDate(new Date()));
  const [schedules, setSchedules] = useState(() => {
    const saved = localStorage.getItem('schedules');
    return saved ? JSON.parse(saved) : [];
  });
  const [anniversaries, setAnniversaries] = useState(() => {
    const saved = localStorage.getItem('anniversaries');
    return saved ? JSON.parse(saved) : [];
  });

  // Form States
  const [hour, setHour] = useState('09');
  const [minute, setMinute] = useState('00');
  const [alertOffset, setAlertOffset] = useState(0); // minutes
  const [memo, setMemo] = useState('');
  const [isDirty, setIsDirty] = useState(false);
  const [showConfirm, setShowConfirm] = useState({ active: false, nextDate: null });

  // Anniversary Form
  const [anniMonth, setAnniMonth] = useState('01');
  const [anniDay, setAnniDay] = useState('01');
  const [anniContent, setAnniContent] = useState('');

  // Search States
  const [searchStart, setSearchStart] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return formatDate(d);
  });
  const [searchEnd, setSearchEnd] = useState(formatDate(new Date()));
  const [searchQuery, setSearchQuery] = useState('');
  const [searchTrigger, setSearchTrigger] = useState(0); // Trigger search
  const [lastSearchParams, setLastSearchParams] = useState(null); // Locked params
  const [currentPage, setCurrentPage] = useState(1);

  // --- Persistent Storage ---
  useEffect(() => {
    localStorage.setItem('schedules', JSON.stringify(schedules));
  }, [schedules]);

  useEffect(() => {
    localStorage.setItem('anniversaries', JSON.stringify(anniversaries));
  }, [anniversaries]);

  // --- Initialization & Notifications ---
  useEffect(() => {
    if ("Notification" in window) {
      Notification.requestPermission();
    }
  }, []);

  // Alarm Checker
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      const nowStr = formatDate(now);
      
      schedules.forEach(s => {
        if (!s.time) return;
        
        // Calculate alarm time
        const [sh, sm] = s.time.split(':').map(Number);
        const scheduleTime = new Date(s.date);
        scheduleTime.setHours(sh, sm, 0, 0);
        
        const alarmTimeRaw = new Date(scheduleTime.getTime() - (s.alertOffset || 0) * 60000);
        const alarmDateStr = formatDate(alarmTimeRaw);
        const alarmTimeStr = alarmTimeRaw.toTimeString().slice(0, 5);

        const currentHHmm = now.toTimeString().slice(0, 5);

        if (nowStr === alarmDateStr && currentHHmm === alarmTimeStr) {
          const prefix = s.alertOffset > 0 ? `[${s.alertOffset < 60 ? s.alertOffset + '분' : (s.alertOffset/60) + '시간'} 전 알림] ` : '[일정 알림] ';
          if (Notification.permission === "granted") {
            new Notification(prefix, { body: s.memo, icon: "/vite.svg" });
          } else {
            alert(`${prefix}${s.memo}`);
          }
        }
      });
    }, 60000);
    return () => clearInterval(timer);
  }, [schedules]);

  // --- Calendar Logic ---
  const currentYear = viewDate.getFullYear();
  const currentMonth = viewDate.getMonth();

  const daysGrid = useMemo(() => {
    const totalDays = getDaysInMonth(currentYear, currentMonth);
    const firstDay = getFirstDayOfMonth(currentYear, currentMonth);
    const grid = [];
    // Prefix empty
    for (let i = 0; i < firstDay; i++) grid.push(null);
    // Real days
    for (let i = 1; i <= totalDays; i++) grid.push(i);
    return grid;
  }, [currentYear, currentMonth]);

  const changeMonth = (offset) => {
    const nextDate = new Date(currentYear, currentMonth + offset, 1);
    setViewDate(nextDate);
  };

  const handleDateClick = (day) => {
    if (!day) return;
    const dateStr = formatDate(new Date(currentYear, currentMonth, day));
    
    if (isDirty) {
      setShowConfirm({ active: true, nextDate: dateStr });
    } else {
      selectDate(dateStr);
    }
  };

  const selectDate = (dateStr) => {
    setSelectedDate(dateStr);
    setMemo(''); // Clear typing
    setIsDirty(false);
    setShowConfirm({ active: false, nextDate: null });
  };

  // --- Actions ---
  const saveSchedule = () => {
    if (!memo.trim()) return;
    const timeStr = `${hour}:${minute}`;
    const newSchedule = {
      id: Date.now(),
      date: selectedDate,
      memo,
      time: timeStr,
      alertOffset
    };
    setSchedules(prev => [...prev, newSchedule]);
    setMemo(''); // Requirement: clear input
    setIsDirty(false);
    alert('저장되었습니다.');
  };

  const deleteSchedule = (id) => {
    setSchedules(prev => prev.filter(s => s.id !== id));
  };

  const addAnniversary = () => {
    if (!anniContent) return;
    const anniMD = `${anniMonth}-${anniDay}`;
    const newAnni = { id: Date.now(), monthDay: anniMD, content: anniContent };
    setAnniversaries(prev => [...prev, newAnni]);
    setAnniContent('');
  };

  const deleteAnniversary = (id) => {
    setAnniversaries(prev => prev.filter(a => a.id !== id));
  };

  // --- Search Logic ---
  const handleSearch = () => {
    setLastSearchParams({ start: searchStart, end: searchEnd, query: searchQuery });
    setCurrentPage(1);
    setSearchTrigger(prev => prev + 1);
  };

  const filteredResults = useMemo(() => {
    if (!lastSearchParams) return [];
    return schedules
      .filter(s => {
        const inRange = s.date >= lastSearchParams.start && s.date <= lastSearchParams.end;
        const matchesQuery = s.memo.toLowerCase().includes(lastSearchParams.query.toLowerCase());
        return inRange && matchesQuery;
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [schedules, lastSearchParams, searchTrigger]);

  const itemsPerPage = 10;
  const totalPages = Math.ceil(filteredResults.length / itemsPerPage);
  const paginatedResults = filteredResults.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  // --- Render Helpers ---
  const checkHasSchedule = (day) => {
    if (!day) return false;
    const dStr = formatDate(new Date(currentYear, currentMonth, day));
    return schedules.some(s => s.date === dStr);
  };

  const checkHasAnniversary = (day) => {
    if (!day) return false;
    const mStr = String(currentMonth + 1).padStart(2, '0');
    const dStr = String(day).padStart(2, '0');
    const targetMD = `${mStr}-${dStr}`;
    return anniversaries.some(a => a.monthDay === targetMD);
  };

  return (
    <div className="container">
      {/* 1. Calendar Card */}
      <section className="card">
        <header className="calendar-header">
          <button className="nav-btn" onClick={() => changeMonth(-1)} aria-label="이전 달">&lt;</button>
          <h2>{currentYear}년 {currentMonth + 1}월</h2>
          <button className="nav-btn" onClick={() => changeMonth(1)} aria-label="다음 달">&gt;</button>
        </header>
        
        <div className="calendar-grid">
          {['일', '월', '화', '수', '목', '금', '토'].map(w => (
            <div key={w} className="weekday">{w}</div>
          ))}
          {daysGrid.map((day, idx) => {
            const dateStr = day ? formatDate(new Date(currentYear, currentMonth, day)) : null;
            const isToday = day && dateStr === formatDate(new Date());
            const isSelected = day && dateStr === selectedDate;
            
            return (
              <div 
                key={idx} 
                className={`day ${!day ? 'other-month' : ''} ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''}`}
                onClick={() => handleDateClick(day)}
              >
                {day}
                {(checkHasSchedule(day) || checkHasAnniversary(day)) && (
                  <div className="day-indicator">
                    {checkHasSchedule(day) && <span className="dot schedule"></span>}
                    {checkHasAnniversary(day) && <span className="dot anniversary">★</span>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* 2. Schedule Form Card */}
      <section className="card">
        <h3 style={{marginBottom: '15px'}}>{selectedDate} 일정</h3>
        <div className="input-group">
          <label>메모 입력</label>
          <textarea 
            rows="2"
            value={memo}
            onChange={(e) => { setMemo(e.target.value); setIsDirty(true); }}
            placeholder="할 일을 입력하세요"
          />
        </div>
        <div className="input-group">
          <label>알람 시간</label>
          <div style={{display: 'flex', gap: '8px'}}>
            <select 
              className="glass-select"
              value={hour}
              onChange={(e) => { setHour(e.target.value); setIsDirty(true); }}
            >
              {Array.from({length: 24}, (_, i) => String(i).padStart(2, '0')).map(h => (
                <option key={h} value={h}>{h}시</option>
              ))}
            </select>
            <select 
              className="glass-select"
              value={minute}
              onChange={(e) => { setMinute(e.target.value); setIsDirty(true); }}
            >
              {Array.from({length: 60}, (_, i) => String(i).padStart(2, '0')).map(m => (
                <option key={m} value={m}>{m}분</option>
              ))}
            </select>
          </div>
        </div>
        <div className="input-group">
          <label>사전 알림</label>
          <select 
            className="glass-select"
            value={alertOffset}
            onChange={(e) => setAlertOffset(Number(e.target.value))}
          >
            <option value={0}>정시 알림</option>
            <option value={10}>10분 전</option>
            <option value={30}>30분 전</option>
            <option value={60}>1시간 전</option>
            <option value={120}>2시간 전</option>
            <option value={1440}>1일 전</option>
          </select>
        </div>
        <button className="primary-btn" onClick={saveSchedule}>일정 저장</button>

        {/* Selected Date List Area */}
        <div className="item-list" style={{marginTop: '20px'}}>
          <h4 style={{fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '10px'}}>등록된 일정 내역 ({selectedDate})</h4>
          
          {/* 1. Show Anniversaries first */}
          {anniversaries
            .filter(a => a.monthDay === selectedDate.slice(5)) // slice(5) gets MM-DD
            .map(a => (
              <div key={a.id} className="item-card" style={{borderColor: 'var(--accent-gold)'}}>
                <div className="item-info">
                  <div className="date-label" style={{color: 'var(--accent-gold)'}}>★ 기념일</div>
                  <div className="content-label">{a.content}</div>
                </div>
              </div>
            ))
          }

          {/* 2. Show Schedules */}
          {schedules.filter(s => s.date === selectedDate).length > 0 ? (
            schedules.filter(s => s.date === selectedDate).map(s => (
              <div key={s.id} className="item-card">
                <div className="item-info">
                  <div className="date-label">{s.time} {s.alertOffset > 0 ? `(${s.alertOffset >= 60 ? s.alertOffset/60 + '시간' : s.alertOffset + '분'} 전 알림)` : ''}</div>
                  <div className="content-label">{s.memo}</div>
                </div>
                <button className="delete-btn" onClick={() => deleteSchedule(s.id)}>삭제</button>
              </div>
            ))
          ) : (
            anniversaries.filter(a => a.monthDay === selectedDate.slice(5)).length === 0 && (
              <p style={{fontSize: '0.8rem', color: 'rgba(255,255,255,0.2)', textAlign: 'center'}}>내역이 없습니다.</p>
            )
          )}
        </div>
      </section>

      {/* 3. Anniversary Card */}
      <section className="card">
        <h3 style={{marginBottom: '15px'}}>기념일 등록</h3>
        <div style={{display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '15px'}}>
          <select 
            className="glass-select"
            style={{flex: 1}}
            value={anniMonth}
            onChange={(e) => setAnniMonth(e.target.value)}
          >
            {Array.from({length: 12}, (_, i) => String(i + 1).padStart(2, '0')).map(m => (
              <option key={m} value={m}>{m}월</option>
            ))}
          </select>
          <select 
            className="glass-select"
            style={{flex: 1}}
            value={anniDay}
            onChange={(e) => setAnniDay(e.target.value)}
          >
            {Array.from({length: 31}, (_, i) => String(i + 1).padStart(2, '0')).map(d => (
              <option key={d} value={d}>{d}일</option>
            ))}
          </select>
          <input 
            type="text" 
            placeholder="기념일 내용" 
            style={{flex: '1 1 100%'}}
            value={anniContent}
            onChange={(e) => setAnniContent(e.target.value)}
          />
          <button 
            className="primary-btn" 
            style={{width: '100%'}}
            onClick={addAnniversary}
          >기념일 추가</button>
        </div>
        <div className="item-list">
          {anniversaries.map(a => (
            <div key={a.id} className="item-card">
              <div className="item-info">
                <div className="date-label">{a.monthDay}</div>
                <div className="content-label">{a.content}</div>
              </div>
              <button className="delete-btn" onClick={() => deleteAnniversary(a.id)}>삭제</button>
            </div>
          ))}
        </div>
      </section>

      {/* 4. Search & History Card */}
      <section className="card">
        <h3 style={{marginBottom: '15px'}}>전체 일정 검색</h3>
        <div className="search-form">
          <div className="date-range-row">
            <input type="date" value={searchStart} onChange={(e) => setSearchStart(e.target.value)} />
            <span style={{alignSelf: 'center'}}>~</span>
            <input type="date" value={searchEnd} onChange={(e) => setSearchEnd(e.target.value)} />
          </div>
          <div className="keyword-row" style={{display: 'flex', gap: '8px'}}>
            <input 
              type="text" 
              placeholder="검색어 입력" 
              style={{flex: 1}}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <button className="primary-btn" style={{width: '80px', padding: '0'}} onClick={handleSearch}>검색</button>
          </div>
        </div>

        <div className="item-list" style={{marginTop: '20px'}}>
          {paginatedResults.map((s) => (
            <div key={s.id} className="item-card">
              <div className="item-info">
                <div className="date-label">{s.date} {s.time}</div>
                <div className="content-label">{s.memo}</div>
              </div>
              <button className="nav-btn" style={{border: 'none', background: 'transparent'}} onClick={() => selectDate(s.date)}>보기</button>
            </div>
          ))}
          {lastSearchParams && paginatedResults.length === 0 && <p style={{textAlign: 'center', color: 'var(--text-muted)'}}>검색 결과가 없습니다.</p>}
          {!lastSearchParams && <p style={{textAlign: 'center', color: 'rgba(255,255,255,0.2)'}}>조건 입력 후 검색을 눌러주세요.</p>}
        </div>

        {totalPages > 1 && (
          <div className="pagination">
            {Array.from({ length: totalPages }, (_, i) => (
              <button 
                key={i + 1} 
                className={`page-btn ${currentPage === i + 1 ? 'active' : ''}`}
                onClick={() => setCurrentPage(i + 1)}
              >
                {i + 1}
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Confirm Backdrop */}
      {showConfirm.active && (
        <>
          <div className="overlay" onClick={() => setShowConfirm({ active: false, nextDate: null })}></div>
          <div className="custom-confirm">
            <p style={{marginBottom: '20px', lineHeight: '1.5'}}>다른 일자를 체크하면 메모가 지워집니다.<br/>계속하시겠습니까?</p>
            <div style={{display: 'flex', gap: '10px'}}>
              <button 
                className="primary-btn" 
                style={{background: 'rgba(255,255,255,0.05)', color: 'white'}}
                onClick={() => setShowConfirm({ active: false, nextDate: null })}
              >아니오</button>
              <button 
                className="primary-btn" 
                onClick={() => selectDate(showConfirm.nextDate)}
              >예</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default App;
