import React, { useState } from 'react';
import SurveyForm from './SurveyForm';
import Welcome from './Welcome';

function App() {
  const [started, setStarted] = useState(false);
  const [respondentId, setRespondentId] = useState(null);

  const handleNext = (id) => {
    if (id) setRespondentId(id);
    setStarted(true);
  };

  return (
    <div>
      {!started ? <Welcome onNext={handleNext} /> : <SurveyForm respondentId={respondentId} />}
    </div>
  );
}

export default App;