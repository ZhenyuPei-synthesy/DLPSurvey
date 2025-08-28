import React, { useState, useEffect } from 'react';
import SurveyForm from './SurveyForm';
import Welcome from './Welcome';
import Report from './Report';
import ResumeInfo from './ResumeInfo';

function App() {
  const [started, setStarted] = useState(false);
  const [respondentId, setRespondentId] = useState(null);
  const [showReport, setShowReport] = useState(false);
  const [surveyAnswers, setSurveyAnswers] = useState({});
  const [surveyData, setSurveyData] = useState([]);
  const [showResumeInfo, setShowResumeInfo] = useState(false);
  const [resumePayload, setResumePayload] = useState({ email: null, answerNumber: null });

  // idle timeout (10 minutes)
  const IDLE_TIMEOUT_MS = 10 * 60 * 1000;

  // 初期化時にセッションから回答者IDを復元
  useEffect(() => {
    // ブラウザのリロード（F5など）で読み込まれた場合のみセッションをクリアしてWelcome画面に戻す
    // Navigation Timing API を利用してリロード判定を行う
    let isReload = false;
    try {
      if (window.performance && window.performance.getEntriesByType) {
        const entries = window.performance.getEntriesByType('navigation');
        if (entries && entries.length > 0) {
          isReload = entries[0].type === 'reload';
        }
      }
      // 古いブラウザ向けフォールバック
      if (!isReload && window.performance && window.performance.navigation) {
        isReload = window.performance.navigation.type === 1; // 1 === reload
      }
    } catch (e) {
      // 安全にフォールバック: 判定に失敗したらリロード扱いにしない
      isReload = false;
    }

    if (isReload) {
      // セッションをクリアして初期画面に戻す
      sessionStorage.removeItem('respondentId');
      sessionStorage.removeItem('surveyStarted');
      setRespondentId(null);
      setStarted(false);
      return;
    }

    // 通常の初期復元処理
    const storedRespondentId = sessionStorage.getItem('respondentId');
    const surveyStarted = sessionStorage.getItem('surveyStarted');

    // 回答者IDとsurveyStartedフラグの両方があることを確認
    if (storedRespondentId && surveyStarted === 'true') {
      setRespondentId(storedRespondentId);
      setStarted(true);
    } else {
      // どちらかが欠けている場合は初期状態に戻す
      sessionStorage.removeItem('respondentId');
      sessionStorage.removeItem('surveyStarted');
    }
  }, []);

  // global inactivity watcher: when survey has started, clear session after idle period
  useEffect(() => {
    if (!started) return;

    let timeoutId = null;

    const resetTimer = () => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        // clear session and reset app state
        sessionStorage.removeItem('respondentId');
        sessionStorage.removeItem('surveyStarted');
        setRespondentId(null);
        setStarted(false);
        setShowReport(false);
        setSurveyAnswers({});
        setSurveyData([]);
        // notify user
        try { window.alert('セッションが一定時間操作されなかったためタイムアウトしました。最初の画面に戻ります。'); } catch (e) {}
      }, IDLE_TIMEOUT_MS);
    };

    const events = ['mousemove', 'keydown', 'click', 'touchstart', 'scroll'];
    events.forEach(ev => window.addEventListener(ev, resetTimer, { passive: true }));

    // start timer
    resetTimer();

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      events.forEach(ev => window.removeEventListener(ev, resetTimer));
    };
  }, [started]);

  const handleNext = (id) => {
    if (id) setRespondentId(id);
    setStarted(true);
    // アンケート開始フラグをセット
    sessionStorage.setItem('surveyStarted', 'true');
  };

  const handleSurveyComplete = (answers, data) => {
    window.scrollTo(0, 0);
    setSurveyAnswers(answers);
    setSurveyData(data);
    setShowReport(true);
  };

  const handleTemporarySaved = (answerNumber, email) => {
    setResumePayload({ answerNumber, email });
    setShowResumeInfo(true);
  };

  // ResumeInfo の「トップへ戻る」を押したときにセッションを完全にクリアして
  // Welcome を最初にアクセスした状態に戻すハンドラ
  const handleResumeBack = () => {
    // クリアするキーを明示的に削除
    try {
      sessionStorage.removeItem('respondentId');
      sessionStorage.removeItem('surveyStarted');
      sessionStorage.removeItem('answerNumber');
      sessionStorage.removeItem('respondentEmail');
    } catch (e) {
      // sessionStorage が無効な環境でも安全に処理
    }

    // ローカル state を初期化して Welcome を表示
    setRespondentId(null);
    setStarted(false);
    setShowReport(false);
    setSurveyAnswers({});
    setSurveyData([]);
    setResumePayload({ email: null, answerNumber: null });
    setShowResumeInfo(false);
  };

  return (
  <div className="flex flex-col min-h-screen">
      {/* 固定ヘッダ */}
      <header className="fixed top-0 left-0 right-0 z-30">
        <div className="absolute top-4 left-6 text-white font-semibold z-40" style={{ fontSize: '1.2rem', transform: 'scale(1.2)', transformOrigin: 'left top' }}>Synthesy株式会社</div>
        <div className="h-48 bg-gradient-to-r from-purple-600 via-pink-500 to-orange-400 flex items-center">
          <div className="max-w-6xl mx-auto px-6">
            <h1 className="text-white text-3xl md:text-4xl font-extrabold">AI時代の内部情報漏洩対策アセスメント</h1>
          </div>
        </div>
      </header>

    {/* コンテンツ領域：ヘッダー高さ (h-48 = 12rem) 分の上パディングを付与 */}
    <div style={{ minHeight: 'calc(100vh - 12rem)', paddingTop: '12rem' }}>
        {!started ? (
          <Welcome onNext={handleNext} />
        ) : showResumeInfo ? (
          <ResumeInfo email={resumePayload.email} answerNumber={resumePayload.answerNumber} onBack={handleResumeBack} />
        ) : showReport ? (
          <Report 
            answers={surveyAnswers} 
            surveyData={surveyData} 
          />
        ) : (
          <SurveyForm 
            respondentId={respondentId} 
            onComplete={handleSurveyComplete}
            onTemporarySaved={handleTemporarySaved}
          />
        )}
    </div>
    </div>
  );
}

export default App;