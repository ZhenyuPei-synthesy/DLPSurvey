import React, { useState, useEffect } from 'react';
import SurveyForm from './SurveyForm';
import Welcome from './Welcome';
import Report from './Report';

function App() {
  const [started, setStarted] = useState(false);
  const [respondentId, setRespondentId] = useState(null);
  const [showReport, setShowReport] = useState(false);
  const [surveyAnswers, setSurveyAnswers] = useState({});
  const [surveyData, setSurveyData] = useState([]);

  // 初期化時にセッションから回答者IDを復元
  useEffect(() => {
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

  const handleNext = (id) => {
    if (id) setRespondentId(id);
    setStarted(true);
    // アンケート開始フラグをセット
    sessionStorage.setItem('surveyStarted', 'true');
  };

  const handleSurveyComplete = (answers, data) => {
    setSurveyAnswers(answers);
    setSurveyData(data);
    setShowReport(true);
  };

  const handleRestart = () => {
    setStarted(false);
    setShowReport(false);
    setSurveyAnswers({});
    setSurveyData([]);
    setRespondentId(null);
    // セッションストレージをクリア
    sessionStorage.removeItem('respondentId');
    sessionStorage.removeItem('surveyStarted');
  };

  return (
    <div>
      {!started ? (
        <Welcome onNext={handleNext} />
      ) : showReport ? (
        <Report 
          answers={surveyAnswers} 
          surveyData={surveyData} 
          onRestart={handleRestart}
        />
      ) : (
        <SurveyForm 
          respondentId={respondentId} 
          onComplete={handleSurveyComplete}
        />
      )}
    </div>
  );
}

export default App;