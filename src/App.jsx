import React, { useState, useEffect, useRef } from 'react';
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
  const surveyFormRef = useRef(null);

  // idle timeout (15 minutes)
  const IDLE_TIMEOUT_MS = 15 * 60 * 1000;

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
      timeoutId = setTimeout(async () => {
        try {
          // セッションタイムアウト時に自動一時保存を実行
          if (surveyFormRef.current && surveyFormRef.current.performAutomaticSave) {
            await surveyFormRef.current.performAutomaticSave();
          }
          
          // セッションタイムアウト時の処理：一時保存完了後、ResumeInfo画面に遷移
          const answerNumber = sessionStorage.getItem('answerNumber');
          const respondentEmail = sessionStorage.getItem('respondentEmail');
          
          // ResumeInfo画面を表示（セッションは保持）
          setResumePayload({ answerNumber, email: respondentEmail });
          setShowResumeInfo(true);
          
          // ユーザーに通知
          try { 
            window.alert('セッションがタイムアウトしました。回答が自動保存されました。アセスメントを再開するには、表示されたアセスメント番号を使用してください。'); 
          } catch (e) {}
        } catch (error) {
          console.error('自動保存中にエラーが発生しました:', error);
          // エラーが発生した場合でもResumeInfo画面を表示
          const answerNumber = sessionStorage.getItem('answerNumber');
          const respondentEmail = sessionStorage.getItem('respondentEmail');
          
          setResumePayload({ answerNumber, email: respondentEmail });
          setShowResumeInfo(true);
          
          try { 
            window.alert('セッションがタイムアウトしました。アセスメントを再開するには、アセスメント番号を使用してください。'); 
          } catch (e) {}
        }
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
        <div className="absolute top-4 left-6 z-40" style={{ transformOrigin: 'left top' }}>
          <img src="/logo_shironuki.svg" alt="SYNTHESY" style={{ height: '2.2rem', display: 'block' }} />
        </div>
        <div
          className="h-48 bg-gradient-to-r from-purple-600 via-pink-500 to-orange-400 flex items-center"
          style={{
            backgroundImage: "url('/obi.jpg')",
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat'
          }}
        >
          <div className="w-full">
            <div className="max-w-6xl mx-auto px-6 flex justify-center items-center h-48">
              <h1 className="text-white text-3xl md:text-4xl font-extrabold text-center">AI時代の内部情報漏洩対策アセスメント</h1>
            </div>
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
            ref={surveyFormRef}
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