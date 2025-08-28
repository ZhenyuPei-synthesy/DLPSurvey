import React, { useState } from 'react';
import SurveyForm from './SurveyForm';
import Welcome from './Welcome';
import Report from './Report';

function App() {
  const [started, setStarted] = useState(false);
  const [respondentId, setRespondentId] = useState(null);
  const [showReport, setShowReport] = useState(false);
  const [surveyAnswers, setSurveyAnswers] = useState({});
  const [surveyData, setSurveyData] = useState([]);

  const handleNext = (id) => {
    if (id) setRespondentId(id);
    setStarted(true);
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